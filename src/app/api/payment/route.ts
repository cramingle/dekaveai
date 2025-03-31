import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_PACKAGES, getDanaAccessToken } from '@/lib/dana';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';
import crypto from 'crypto';
import { DANA_API_KEY, DANA_API_SECRET, DANA_MERCHANT_ID, DANA_ENVIRONMENT, DANA_CLIENT_ID, DANA_CLIENT_SECRET, getUrl } from '@/lib/env';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';

// DANA API base URL based on environment
const DANA_API_BASE_URL = DANA_ENVIRONMENT === 'production'
  ? 'https://api.saas.dana.id'
  : 'https://api.sandbox.dana.id';

// Payment Gateway Plugin endpoint from the documentation
const DANA_PAYMENT_ENDPOINT = '/v1.0/payment-gateway/payment.htm';

// Simple in-memory rate limiting for payment endpoint
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute per IP

// Store rate limiting data
const rateLimitTracker: Record<string, { count: number, resetTime: number }> = {};

// Add a helper function for retry logic at the top of the file after imports

/**
 * Helper function to retry a promise-based operation with exponential backoff
 * @param operation Function that returns a promise to retry
 * @param maxRetries Maximum number of retry attempts
 * @param baseDelay Base delay in ms (will be multiplied by 2^retryCount)
 * @returns Result of the operation or throws the last error
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3,
  baseDelay: number = 300
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (retryCount === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, retryCount);
      logger.info(`Retrying operation after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

// Add this function after the retryWithBackoff function

/**
 * Get a user-friendly error message based on DANA error code
 * @param responseCode DANA response code
 * @returns User-friendly error message
 */
function getDanaErrorMessage(responseCode: string): string {
  const errorMessages: Record<string, string> = {
    '4000000': 'Bad request. Please check your payment details.',
    '4010000': 'Authentication failed. Please try again later.',
    '4010003': 'Access token expired. Please try again.',
    '4040000': 'Requested resource not found.',
    '4040018': 'Inconsistent payment request.',
    '4080000': 'Request timeout. Please try again.',
    '4290000': 'Too many requests. Please try again later.',
    '5000000': 'Internal server error. Please try again later.',
    '5030000': 'Service unavailable. Please try again later.',
    '6010000': 'Invalid parameter format.',
    '6040000': 'Business rule validation failed.',
    '6220000': 'Duplicate transaction detected.'
  };
  
  return errorMessages[responseCode] || 'Payment processing failed. Please try again later.';
}

// Create a payment for purchasing tokens
export async function POST(request: NextRequest) {
  try {
    // Log initial request
    logger.info('Payment request received', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });

    // Check if Dana is configured
    if (!DANA_API_KEY || !DANA_API_SECRET || !DANA_MERCHANT_ID || !DANA_CLIENT_ID || !DANA_CLIENT_SECRET) {
      logger.error('Dana payment is not configured', {
        DANA_API_KEY: DANA_API_KEY ? '✓ Set' : '✗ Missing',
        DANA_API_SECRET: DANA_API_SECRET ? '✓ Set' : '✗ Missing',
        DANA_MERCHANT_ID: DANA_MERCHANT_ID ? '✓ Set' : '✗ Missing',
        DANA_CLIENT_ID: DANA_CLIENT_ID ? '✓ Set' : '✗ Missing',
        DANA_CLIENT_SECRET: DANA_CLIENT_SECRET ? '✓ Set' : '✗ Missing'
      });
      return NextResponse.json(
        { error: 'Payment system is not configured' },
        { status: 503 }
      );
    }

    // Apply rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Initialize rate limit data for this IP if it doesn't exist
    if (!rateLimitTracker[ip]) {
      rateLimitTracker[ip] = {
        count: 0,
        resetTime: Date.now() + RATE_LIMIT_WINDOW
      };
    }
    
    // Reset count if the window has passed
    if (Date.now() > rateLimitTracker[ip].resetTime) {
      rateLimitTracker[ip] = {
        count: 0,
        resetTime: Date.now() + RATE_LIMIT_WINDOW
      };
    }
    
    // Increment request count
    rateLimitTracker[ip].count++;
    
    // Check if rate limit is exceeded
    if (rateLimitTracker[ip].count > MAX_REQUESTS_PER_WINDOW) {
      logger.warn(`Rate limit exceeded for payment endpoint from ${ip}`);
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitTracker[ip].resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitTracker[ip].resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
      logger.info('Payment request body', { body: requestBody });
    } catch (error) {
      logger.error('Failed to parse request body', { error });
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { email, userId, packageId = 'basic' } = requestBody;

    // Validate input
    if (!email) {
      logger.warn('Missing email in payment request');
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      logger.warn('Missing userId in payment request');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get package details
    const packageDetails = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES] || TOKEN_PACKAGES.basic;
    const amount = packageDetails.price;
    const description = `${packageDetails.tokens} Token Package - ${packageDetails.tier}`;

    logger.info('Creating Dana payment', { email, userId, packageId, amount, description });

    try {
      // First, get a B2B access token from DANA
      logger.info('Acquiring DANA B2B access token');
      
      const accessToken = await getDanaAccessToken();
      
      if (!accessToken) {
        logger.error('Failed to acquire DANA B2B access token');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to authenticate with payment provider' 
          },
          { status: 500 }
        );
      }
      
      logger.info('Successfully acquired DANA B2B access token');
      
      // Generate unique order reference number (partnerReferenceNo)
      const timestamp = Math.floor(Date.now()).toString();
      const partnerReferenceNo = `DEKAVE${userId.substring(0, 6)}${timestamp.substring(timestamp.length - 9)}`;
      
      // Generate X-EXTERNAL-ID for the header (similar to partnerReferenceNo but must be unique within a day)
      const externalId = `DKVE${timestamp.substring(timestamp.length - 10)}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      // Format timestamp in DANA format (YYYY-MM-DDTHH:mm:ss+07:00)
      const date = new Date();
      const offset = 7 * 60; // GMT+7 in minutes
      const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000));
      
      const pad = (num: number) => num.toString().padStart(2, '0');
      const year = adjustedDate.getUTCFullYear();
      const month = pad(adjustedDate.getUTCMonth() + 1);
      const day = pad(adjustedDate.getUTCDate());
      const hours = pad(adjustedDate.getUTCHours());
      const minutes = pad(adjustedDate.getUTCMinutes());
      const seconds = pad(adjustedDate.getUTCSeconds());
      const danaTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
      
      // Generate expiration time (30 minutes from now)
      const expiryDate = new Date(date.getTime() + (30 * 60 * 1000) + (offset * 60 * 1000));
      const expiryYear = expiryDate.getUTCFullYear();
      const expiryMonth = pad(expiryDate.getUTCMonth() + 1);
      const expiryDay = pad(expiryDate.getUTCDate());
      const expiryHours = pad(expiryDate.getUTCHours());
      const expiryMinutes = pad(expiryDate.getUTCMinutes());
      const expirySeconds = pad(expiryDate.getUTCSeconds());
      const validUpTo = `${expiryYear}-${expiryMonth}-${expiryDay}T${expiryHours}:${expiryMinutes}:${expirySeconds}+07:00`;
      
      // Generate channel ID based on user agent (5 chars max)
      const userAgent = request.headers.get('user-agent') || 'unknown';
      const channelId = crypto
        .createHash('md5')
        .update(userAgent)
        .digest('hex')
        .substring(0, 5)
        .toUpperCase();
      
      // Create request payload based on Payment Gateway Plugin documentation
      const payload = {
        partnerReferenceNo: partnerReferenceNo,
        merchantId: DANA_MERCHANT_ID,
        amount: {
          value: amount.toFixed(2),
          currency: "IDR"
        },
        validUpTo: validUpTo,
        urlParams: [
          {
            url: getUrl('/api/webhooks/dana/redirect'),
            type: "PAY_RETURN",
            isDeeplink: "N"
          },
          {
            url: getUrl('/api/webhooks/dana/payment'),
            type: "NOTIFICATION",
            isDeeplink: "N"
          }
        ],
        additionalInfo: {
          order: {
            orderTitle: description,
            scenario: "REDIRECTION",
            goods: [
              {
                category: "digital_goods/software",
                price: {
                  value: amount.toFixed(2),
                  currency: "IDR"
                },
                merchantGoodsId: packageId,
                description: description,
                quantity: "1"
              }
            ],
            buyer: {
              nickname: email.split('@')[0],
              externalUserId: userId.substring(0, 30)
            }
          },
          envInfo: {
            sessionId: externalId,
            websiteLanguage: "id_ID",
            clientIp: ip,
            sourcePlatform: "IPG",
            terminalType: "WEB",
            orderTerminalType: "WEB"
          }
        },
        mcc: "5734" // Computer Software
      };
      
      // Store transaction in database
      try {
        await db.insert(transactions).values({
          id: crypto.randomUUID(),
          userId: userId,
          packageId: packageId,
          amount: amount.toString(),
          status: "PENDING",
          provider: "dana",
          description: description,
          metadata: {
            partnerReferenceNo: partnerReferenceNo,
            externalId: externalId,
            email: email,
            description: description
          },
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        logger.info('Created transaction record', { partnerReferenceNo, externalId });
      } catch (dbError) {
        logger.error('Failed to create transaction record', { error: dbError });
        // Continue processing even if the DB insert fails
      }
      
      // Generate payload hash for signature
      const stringifiedPayload = JSON.stringify(payload);
      const payloadHash = crypto.createHash('sha256')
        .update(stringifiedPayload)
        .digest('hex')
        .toLowerCase();
      
      // Generate signature using HMAC-SHA512 as per documentation
      const signatureBase = `POST:${DANA_PAYMENT_ENDPOINT}:${accessToken}:${payloadHash}:${danaTimestamp}`;
      
      logger.info('Generating signature', { 
        signatureBasePreview: signatureBase.substring(0, 50) + '...',
        timestamp: danaTimestamp,
        payloadHashPreview: payloadHash.substring(0, 20) + '...'
      });
      
      const signature = crypto
        .createHmac('sha512', DANA_API_SECRET)
        .update(signatureBase)
        .digest('base64');
      
      // Update headers to use the actual access token
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // Use the access token from B2B token request
        'X-TIMESTAMP': danaTimestamp,
        'X-SIGNATURE': signature,
        'ORIGIN': getUrl('/').replace(/^https?:\/\//, '').replace(/\/$/, ''),
        'X-PARTNER-ID': DANA_CLIENT_ID,
        'X-EXTERNAL-ID': externalId,
        'CHANNEL-ID': channelId
      };
      
      logger.info('Making Dana payment request', {
        url: `${DANA_API_BASE_URL}${DANA_PAYMENT_ENDPOINT}`,
        partnerReferenceNo,
        merchantId: DANA_MERCHANT_ID,
        amount: payload.amount.value,
        headers: {
          ...headers,
          'X-SIGNATURE': signature.substring(0, 20) + '...',
          'Authorization': 'Bearer ****'
        }
      });
      
      // Make the API request to Dana with retry logic for 5xx errors
      const response = await retryWithBackoff(
        async () => {
          const resp = await fetch(`${DANA_API_BASE_URL}${DANA_PAYMENT_ENDPOINT}`, {
            method: 'POST',
            headers,
            body: stringifiedPayload
          });
          
          // Only retry on 5xx server errors
          if (resp.status >= 500 && resp.status < 600) {
            throw new Error(`Server error: ${resp.status}`);
          }
          
          return resp;
        }, 
        2, // Max 2 retries (3 attempts total)
        500 // Start with 500ms delay
      );
      
      // Log response details
      logger.info('Dana API response received', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      // Parse response
      let data;
      try {
        data = await response.json();
        logger.info('Dana API response parsed', {
          responseCode: data.responseCode,
          responseMessage: data.responseMessage,
          hasRedirectUrl: !!data.webRedirectUrl
        });
      } catch (error) {
        const text = await response.text();
        logger.error('Failed to parse Dana API response', { 
          status: response.status,
          body: text.substring(0, 500)
        });
        return NextResponse.json(
          { error: 'Invalid response from payment provider' }, 
          { status: 502 }
        );
      }
      
      // Handle successful response
      if (response.ok && data.responseCode === '2000000') {
        // The webRedirectUrl is the payment URL for the user
        const paymentUrl = data.webRedirectUrl;
        
        if (!paymentUrl) {
          logger.error('Dana payment URL missing in response', { response: data });
          return NextResponse.json(
            { error: 'Payment provider returned an invalid response' },
            { status: 502 }
          );
        }
        
        // Try to update transaction with reference number
        try {
          // Find existing transaction first
          const existingTransaction = await db
            .select()
            .from(transactions)
            .where(sql`metadata->>'partnerReferenceNo' = ${partnerReferenceNo}`)
            .limit(1)
            .then(rows => rows[0]);

          if (existingTransaction) {
            // Update transaction with new metadata
            await db.update(transactions)
              .set({ 
                updatedAt: new Date(),
                metadata: {
                  ...(existingTransaction.metadata || {}),
                  partnerReferenceNo,
                  externalId,
                  email,
                  description,
                  referenceNo: data.referenceNo,
                  responseCode: data.responseCode,
                  responseMessage: data.responseMessage
                }
              })
              .where(eq(transactions.id, existingTransaction.id));
          }
        } catch (dbError) {
          logger.error('Failed to update transaction with referenceNo', { error: dbError });
          // Continue even if DB update fails
        }
        
        logger.info('Dana payment created successfully', {
          partnerReferenceNo,
          referenceNo: data.referenceNo,
          paymentUrlPreview: paymentUrl.substring(0, 50) + '...'
        });
        
        // Track successful payment URL generation
        trackEvent(EventType.TOKEN_PURCHASE, {
          userId,
          packageId,
          provider: 'dana',
          status: 'payment_url_generated',
          partnerReferenceNo,
          referenceNo: data.referenceNo,
          timestamp: new Date().toISOString()
        });
        
        // Return successful response with payment URL
        return NextResponse.json({
          success: true,
          paymentUrl: paymentUrl,
          partnerReferenceNo: partnerReferenceNo
        });
      } 
      // Handle error response
      else {
        const errorMessage = getDanaErrorMessage(data.responseCode);
        
        logger.error('Dana payment failed - API returned error', {
          status: response.status,
          responseCode: data.responseCode,
          responseMessage: data.responseMessage,
          friendlyMessage: errorMessage
        });
        
        // Track failure
        trackEvent(EventType.TOKEN_PURCHASE, {
          userId,
          packageId,
          provider: 'dana',
          status: 'payment_url_generation_failed',
          responseCode: data.responseCode,
          responseMessage: data.responseMessage,
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json(
          { 
            success: false,
            error: 'Payment initiation failed',
            code: data.responseCode,
            message: errorMessage
          },
          { status: 400 }
        );
      }
    } catch (error) {
      logger.error('Error creating Dana payment:', error);
      return NextResponse.json(
        { error: 'Failed to create payment' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error processing payment request:', error);
    return NextResponse.json(
      { error: 'Failed to process payment request' },
      { status: 500 }
    );
  }
}
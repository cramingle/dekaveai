import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_PACKAGES } from '@/lib/dana';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';
import crypto from 'crypto';
import { DANA_API_KEY, DANA_API_SECRET, DANA_MERCHANT_ID, DANA_ENVIRONMENT, DANA_CLIENT_ID, DANA_CLIENT_SECRET, getUrl } from '@/lib/env';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';

// DANA API base URL
const DANA_API_BASE_URL = DANA_ENVIRONMENT === 'production'
  ? 'https://api.saas.dana.id'
  : 'https://api.sandbox.dana.id';

// Updated endpoint from the new documentation
const DANA_PAYMENT_ENDPOINT = '/v1.0/payment-gateway/payment.htm';

// Simple in-memory rate limiting for payment endpoint
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute per IP

// Store rate limiting data
const rateLimitTracker: Record<string, { count: number, resetTime: number }> = {};

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
    if (!DANA_API_KEY || !DANA_API_SECRET || !DANA_MERCHANT_ID) {
      logger.error('Dana payment is not configured', {
        DANA_API_KEY: DANA_API_KEY ? '✓ Set' : '✗ Missing',
        DANA_API_SECRET: DANA_API_SECRET ? '✓ Set' : '✗ Missing',
        DANA_MERCHANT_ID: DANA_MERCHANT_ID ? '✓ Set' : '✗ Missing'
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
      // Calculate timestamp for request
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      // Generate unique order ID
      const merchantOrderNo = `DEKAVE${userId.substring(0, 6)}${timestamp}${Math.floor(Math.random() * 1000)}`;
      
      // Format timestamp in DANA format (YYYY-MM-DDTHH:mm:ss+07:00)
      const date = new Date();
      const pad = (num: number) => num.toString().padStart(2, '0');
      const year = date.getUTCFullYear();
      const month = pad(date.getUTCMonth() + 1);
      const day = pad(date.getUTCDate());
      const hours = pad(date.getUTCHours() + 7); // Add 7 hours for Indonesia timezone
      const minutes = pad(date.getUTCMinutes());
      const seconds = pad(date.getUTCSeconds());
      const danaTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
      
      // Generate channel ID based on user agent (5 chars max)
      const userAgent = request.headers.get('user-agent') || 'unknown';
      const channelIdHash = crypto
        .createHash('md5')
        .update(userAgent)
        .digest('hex')
        .substring(0, 5)
        .toUpperCase();
      
      // Create request payload based on Payment Gateway Plugin documentation
      const payload = {
        partnerReferenceNo: merchantOrderNo,
        merchantId: DANA_MERCHANT_ID,
        subMerchantId: "", // Optional
        amount: {
          value: amount.toFixed(2),
          currency: "IDR"
        },
        externalStoreId: "DEKAVE", // Optional store identifier
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
                category: "digital_goods",
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
          mcc: "5817", // Digital Goods
          envInfo: {
            sourcePlatform: "IPG",
            terminalType: "WEB",
            orderTerminalType: "WEB"
          }
        }
      };
      
      // Generate signature using DANA's signature format
      // Need to include B2B access token and use HMAC-SHA512 as per Dana documentation
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').toLowerCase();
      const signatureBase = `POST:${DANA_PAYMENT_ENDPOINT}:${DANA_CLIENT_SECRET}:${payloadHash}:${danaTimestamp}`;
      
      logger.info('Generating signature with base', { 
        signatureBase: signatureBase.substring(0, 50) + '...',
        secretLength: DANA_API_SECRET.length
      });
      
      const signature = crypto
        .createHmac('sha512', DANA_API_SECRET)
        .update(signatureBase)
        .digest('base64');
      
      logger.info('Generated signature', { signature });
        
      // Create headers as specified in the documentation
      const headers = {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': danaTimestamp,
        'X-SIGNATURE': signature,
        'ORIGIN': getUrl('/').replace(/^https?:\/\//, '').replace(/\/$/, ''),
        'X-PARTNER-ID': DANA_CLIENT_ID || "",
        'X-EXTERNAL-ID': merchantOrderNo,
        'CHANNEL-ID': channelIdHash
      };
      
      logger.info('Making Dana payment request', {
        url: `${DANA_API_BASE_URL}${DANA_PAYMENT_ENDPOINT}`,
        merchantOrderNo: payload.partnerReferenceNo,
        merchantId: DANA_MERCHANT_ID,
        amount: payload.amount.value,
        headers: headers,
        payload: JSON.stringify(payload).substring(0, 100) + '...'
      });
      
      // Make the API request to Dana
      const response = await fetch(`${DANA_API_BASE_URL}${DANA_PAYMENT_ENDPOINT}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      // Log response details
      logger.info('Dana API response received', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      // Clone the response before reading it, to avoid "body already read" errors
      const responseClone = response.clone();
      
      // Attempt to get the response text first for debugging
      const responseText = await responseClone.text();
      logger.info('Dana API raw response', {
        text: responseText || '(empty response)',
        contentLength: responseText.length
      });
      
      try {
        if (response.ok) {
          const data = await response.json();
          
          // Check if the response is successful based on DANA documentation
          if (data.responseCode === "2000000" && data.webRedirectUrl) {
            // The webRedirectUrl is the payment URL for the user
            const paymentUrl = data.webRedirectUrl;
            
            // Update the successful transaction in database
            await db.insert(transactions).values({
              id: crypto.randomUUID(),
              userId,
              packageId,
              amount: amount.toString(),
              status: "PENDING", // Initial status is pending until callback
              provider: "DANA",
              description,
              metadata: {
                merchantOrderNo: payload.partnerReferenceNo,
                paymentUrl,
                orderAmount: amount,
                currency: "IDR",
                referenceNo: data.referenceNo || ""
              },
              createdAt: new Date()
            });
            
            // Log success
            logger.info('Dana payment created successfully', {
              orderId: payload.partnerReferenceNo,
              packageId,
              userId,
              paymentUrl: paymentUrl.substring(0, 50) + '...' // Log only part of URL
            });
            
            // Track successful payment URL generation
            trackEvent(EventType.TOKEN_PURCHASE, { 
              userId,
              email,
              packageId,
              provider: 'dana',
              status: 'payment_url_generated',
              timestamp: new Date().toISOString()
            });
            
            // Return successful response with payment URL
            return NextResponse.json({
              success: true,
              orderId: payload.partnerReferenceNo,
              paymentUrl: paymentUrl,
              expireTime: 15 // minutes
            });
          } else {
            // Handle API error response
            logger.error('Dana payment failed - API returned error', {
              error: data.responseMessage || data.errorMessage || 'Unknown error',
              code: data.responseCode || data.errorCode || 'UNKNOWN',
              orderId: payload.partnerReferenceNo
            });
            
            // Track failure
            trackEvent(EventType.TOKEN_PURCHASE, { 
              userId,
              email,
              packageId,
              provider: 'dana',
              status: 'payment_url_generation_failed',
              error: data.responseMessage || data.errorMessage || 'Unknown error',
              timestamp: new Date().toISOString()
            });

            return NextResponse.json(
              { 
                success: false, 
                message: 'Payment initiation failed',
                errorCode: data.responseCode || data.errorCode || 'UNKNOWN',
                errorMessage: data.responseMessage || data.errorMessage || 'Unknown error from payment provider'
              },
              { status: 400 }
            );
          }
        } else {
          // Handle HTTP error response
          const errorData = await response.json().catch(() => ({ 
            errorCode: 'HTTP_ERROR', 
            errorMessage: `HTTP Error ${response.status}`
          }));
          
          const isRetryable = response.status >= 500 || response.status === 429;
          
          logger.error('Dana payment failed - HTTP error', {
            status: response.status,
            errorCode: errorData.errorCode || 'UNKNOWN',
            errorMessage: errorData.errorMessage || 'Unknown error',
            isRetryable: isRetryable,
            merchantOrderNo
          });
          
          // Track failure
          trackEvent(EventType.TOKEN_PURCHASE, { 
            userId,
            email,
            packageId,
            provider: 'dana',
            status: 'api_error',
            errorCode: errorData.errorCode || 'UNKNOWN',
            errorMessage: errorData.errorMessage || 'Unknown error',
            timestamp: new Date().toISOString()
          });
          
          return NextResponse.json(
            { 
              success: false, 
              message: 'Payment service error',
              errorCode: errorData.errorCode || 'UNKNOWN',
              errorMessage: errorData.errorMessage || 'Unknown error from payment provider',
              isRetryable
            },
            { status: isRetryable ? 503 : 400 }
          );
        }
      } catch (parseError) {
        logger.error('Error parsing Dana API response', {
          error: parseError,
          responseText
        });
        
        return NextResponse.json(
          { 
            success: false, 
            message: 'Error processing payment provider response',
            error: 'RESPONSE_PARSING_ERROR'
          },
          { status: 500 }
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
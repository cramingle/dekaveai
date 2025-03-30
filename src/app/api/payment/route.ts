import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_PACKAGES } from '@/lib/dana';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';
import crypto from 'crypto';
import { DANA_API_KEY, DANA_API_SECRET, DANA_MERCHANT_ID, DANA_ENVIRONMENT, getUrl } from '@/lib/env';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';

// DANA API base URL
const DANA_API_BASE_URL = DANA_ENVIRONMENT === 'production'
  ? 'https://api.dana.id'
  : 'https://api-sandbox.dana.id';

// DANA payment endpoint for QRIS MPM (Acquirer)
const DANA_PAYMENT_ENDPOINT = '/qr/api/merchant/acquirer/v1/orders/qrcode';

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
      const danaTimestamp = new Date().toISOString().replace('Z', '+07:00');
      
      // Create request payload based on QRIS MPM (Acquirer) Generate QRIS API
      const payload = {
        request: {
          merchantId: DANA_MERCHANT_ID,
          merchantOrderNo: merchantOrderNo,
          orderTitle: description,
          orderDesc: `Token purchase for user ${email}`,
          orderAmount: {
            currency: "IDR",
            value: amount.toFixed(2)
          },
          merchantRedirectUrl: getUrl('/api/webhooks/dana/redirect'),
          merchantCallbackUrl: getUrl('/api/webhooks/dana/payment'),
          expireTime: 15, // QR code expires in 15 minutes
          notifyUrl: getUrl('/api/webhooks/dana/notify'),
          paymentChannels: ["QRIS"],
          orderTerminalType: "WEB",
          productCode: packageId,
          productQuantity: 1,
          merchantTransInfo: {
            merchantTransType: "ONLINE_PURCHASE",
            merchantUserId: userId,
            userInfo: {
              userId: userId,
              userEmail: email
            }
          }
        }
      };
      
      // Generate signature using DANA's signature format
      const signatureBase = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', DANA_API_SECRET)
        .update(signatureBase)
        .digest('hex');
        
      // Log the API request for debugging
      logger.info('Making Dana payment request', {
        url: `${DANA_API_BASE_URL}${DANA_PAYMENT_ENDPOINT}`,
        merchantOrderNo,
        merchantId: DANA_MERCHANT_ID,
        amount: amount.toFixed(2),
        payload: JSON.stringify(payload)
      });
      
      // Make the API request to Dana
      const response = await fetch(`${DANA_API_BASE_URL}${DANA_PAYMENT_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${DANA_API_KEY}`, // Authorization with bearer token
          'X-TIMESTAMP': danaTimestamp,
          'X-SIGNATURE': signature,
          'ORIGIN': getUrl('/'),
          'X-PARTNER-ID': DANA_MERCHANT_ID,
          'X-EXTERNAL-ID': merchantOrderNo,
          'CHANNEL-ID': '00001' // Web channel ID
        },
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
          
          // Check if the response is successful
          if (data.response && data.response.qrCode) {
            // The QRIS qrCode is the string representation of the QR Code
            const qrCode = data.response.qrCode;
            
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
                merchantOrderNo,
                qrCode,
                orderAmount: amount,
                currency: "IDR"
              },
              createdAt: new Date()
            });
            
            // Log success
            logger.info('Dana payment created successfully', {
              orderId: merchantOrderNo,
              packageId,
              userId,
              qrCode: qrCode.substring(0, 20) + '...' // Log only part of QR code for security
            });
            
            // Track successful payment QR generation
            trackEvent(EventType.TOKEN_PURCHASE, { 
              userId,
              email,
              packageId,
              provider: 'dana',
              status: 'qr_generated',
              timestamp: new Date().toISOString()
            });
            
            // Return successful response with QR code
            return NextResponse.json({
              success: true,
              orderId: merchantOrderNo,
              qrCode: qrCode,
              expireTime: 15 // minutes
            });
          } else {
            // Handle API error response
            logger.error('Dana payment failed - API returned error', {
              error: data.response?.errorMessage || 'Unknown error',
              code: data.response?.errorCode || 'UNKNOWN',
              merchantOrderNo
            });
            
            // Track failure
            trackEvent(EventType.TOKEN_PURCHASE, { 
              userId,
              email,
              packageId,
              provider: 'dana',
              status: 'qr_generation_failed',
              error: data.response?.errorMessage || 'Unknown error',
              timestamp: new Date().toISOString()
            });

            return NextResponse.json(
              { 
                success: false, 
                message: 'Payment initiation failed',
                errorCode: data.response?.errorCode || 'UNKNOWN',
                errorMessage: data.response?.errorMessage || 'Unknown error from payment provider'
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
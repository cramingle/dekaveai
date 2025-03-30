import { NextRequest, NextResponse } from 'next/server';
import { createDanaPayment, IS_DANA_CONFIGURED, TOKEN_PACKAGES } from '@/lib/dana';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';
import crypto from 'crypto';
import { DANA_API_KEY, DANA_API_SECRET, DANA_MERCHANT_ID, DANA_ENVIRONMENT, getUrl } from '@/lib/env';

// DANA API base URL
const DANA_API_BASE_URL = DANA_ENVIRONMENT === 'production'
  ? 'https://api.dana.id' // Production URL
  : 'https://api.sandbox.dana.id'; // Sandbox URL

// DANA API endpoint for payment creation
const DANA_PAYMENT_ENDPOINT = '/payments/create'; // Use the API path without version prefix

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
    if (!IS_DANA_CONFIGURED) {
      logger.error('Dana payment is not configured', {
        IS_DANA_CONFIGURED,
        DANA_ENVIRONMENT: process.env.NEXT_PUBLIC_DANA_ENVIRONMENT,
        DANA_API_KEY: process.env.DANA_API_KEY ? '✓ Set' : '✗ Missing',
        DANA_API_SECRET: process.env.DANA_API_SECRET ? '✓ Set' : '✗ Missing',
        DANA_MERCHANT_ID: process.env.DANA_MERCHANT_ID ? '✓ Set' : '✗ Missing'
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

    // Check if Dana API keys are configured on the server
    if (!DANA_API_KEY || !DANA_API_SECRET || !DANA_MERCHANT_ID) {
      logger.error('Dana payment is not configured on the server', {
        DANA_API_KEY: DANA_API_KEY ? '✓ Set' : '✗ Missing',
        DANA_API_SECRET: DANA_API_SECRET ? '✓ Set' : '✗ Missing',
        DANA_MERCHANT_ID: DANA_MERCHANT_ID ? '✓ Set' : '✗ Missing'
      });
      return NextResponse.json(
        { error: 'Dana payment is not configured on the server' },
        { status: 500 }
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
      
      // Generate order ID
      const orderId = `order_${userId}_${timestamp}_${Math.floor(Math.random() * 1000)}`;
      
      // Create request payload
      const payload = {
        merchant_id: DANA_MERCHANT_ID,
        order_id: orderId,
        amount: amount.toFixed(2),
        currency: 'IDR',
        item_description: description,
        customer_email: email,
        timestamp: timestamp,
        sandbox_mode: DANA_ENVIRONMENT === 'sandbox', // Add explicit sandbox mode flag
        notification_urls: {
          payment: getUrl('/api/webhooks/dana/payment'),
          refund: getUrl('/api/webhooks/dana/refund'),
          payment_code: getUrl('/api/webhooks/dana/payment-code'),
        },
        redirect_url: getUrl('/api/webhooks/dana/redirect'),
        metadata: {
          userId: userId,
          packageId: packageId
        }
      };
      
      // Generate signature
      const signatureBase = `${DANA_MERCHANT_ID}|${orderId}|${amount.toFixed(2)}|${timestamp}`;
      const signature = crypto
        .createHmac('sha256', DANA_API_SECRET)
        .update(signatureBase)
        .digest('hex');
        
      // Log the API request for debugging
      logger.info('Making Dana payment request', {
        url: `${DANA_API_BASE_URL}${DANA_PAYMENT_ENDPOINT}`,
        orderId,
        merchantId: DANA_MERCHANT_ID,
        amount: amount.toFixed(2),
        timestamp,
        payload: JSON.stringify(payload)
      });
      
      // Make the API request to Dana
      const response = await fetch(`${DANA_API_BASE_URL}${DANA_PAYMENT_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Dana-Merchant-ID': DANA_MERCHANT_ID,
          'X-Dana-Signature': signature,
          'X-Dana-Timestamp': timestamp,
          'X-Dana-API-Key': DANA_API_KEY,
          'User-Agent': 'Dekave-AI-App/1.0',
          'Cache-Control': 'no-cache'
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
      
      if (!response.ok) {
        // Get the error response
        let errorData;
        try {
          // Try to parse as JSON if possible
          errorData = responseText && responseText.length > 0 ? JSON.parse(responseText) : { error: 'Empty response' };
        } catch (e: any) {
          // If JSON parsing fails, use the text
          errorData = { text: responseText, parseError: e.message };
        }
        
        logger.error('Dana payment creation failed', {
          status: response.status,
          error: errorData,
          request: {
            url: `${DANA_API_BASE_URL}${DANA_PAYMENT_ENDPOINT}`,
            payload: JSON.stringify(payload)
          }
        });
        
        // Track failure
        trackEvent(EventType.TOKEN_PURCHASE, { 
          userId,
          email,
          packageId,
          provider: 'dana',
          status: 'failed',
          error: 'API Error',
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json(
          { error: 'Failed to create Dana payment', details: errorData },
          { status: response.status }
        );
      }
      
      // For success response, try to parse the JSON data from the text we already read
      let data;
      try {
        data = responseText && responseText.length > 0 ? JSON.parse(responseText) : {};
      } catch (e: any) {
        logger.error('Failed to parse Dana API success response', {
          error: e.message,
          text: responseText
        });
        data = {}; // Empty object as fallback
      }
      
      // Log success
      logger.info('Dana payment created successfully', {
        orderId,
        packageId,
        userId,
        data
      });
      
      // Check if we received a payment URL
      if (!data.payment_url) {
        logger.error('Dana API response missing payment_url', { data, responseText });
        
        return NextResponse.json(
          { error: 'Missing payment URL in Dana response' },
          { status: 500 }
        );
      }
      
      // Track successful payment URL creation
      trackEvent(EventType.TOKEN_PURCHASE, { 
        userId,
        email,
        packageId,
        provider: 'dana',
        status: 'payment_created',
        timestamp: new Date().toISOString()
      });
      
      // Return success response with payment URL
      return NextResponse.json({
        success: true,
        orderId: orderId,
        paymentUrl: data.payment_url
      });
    } catch (error) {
      logger.error('Error creating Dana payment directly:', error);
      
      // If direct Dana API fails, fall back to previous implementation
      logger.info('Falling back to library implementation');
      
      // Create Dana payment using the library function
      const paymentUrl = await createDanaPayment(
        email,
        userId,
        packageId
      );

      if (!paymentUrl) {
        // Track failure
        trackEvent(EventType.TOKEN_PURCHASE, { 
          userId,
          email,
          packageId,
          provider: 'dana',
          status: 'failed',
          error: 'Failed to create payment',
          timestamp: new Date().toISOString()
        });
        
        logger.error('Fallback also failed - Cannot create Dana payment', { email, userId, packageId });
        
        return NextResponse.json(
          { error: 'Failed to create payment. Dana payment service may not be configured properly.' },
          { status: 500 }
        );
      }

      // Track successful payment URL creation
      trackEvent(EventType.TOKEN_PURCHASE, { 
        userId,
        email,
        packageId,
        provider: 'dana',
        status: 'payment_created',
        timestamp: new Date().toISOString()
      });

      logger.info('Payment URL created successfully via fallback', { paymentUrl });

      return NextResponse.json({ paymentUrl });
    }
  } catch (error) {
    logger.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
} 
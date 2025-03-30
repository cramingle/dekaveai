import { NextRequest, NextResponse } from 'next/server';
import { createDanaPayment, IS_DANA_CONFIGURED } from '@/lib/dana';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';

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

    logger.info('Creating Dana payment', { email, userId, packageId });

    // Create Dana payment
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
      
      logger.error('Failed to create Dana payment', { email, userId, packageId });
      
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

    logger.info('Payment URL created successfully', { paymentUrl });

    return NextResponse.json({ paymentUrl });
  } catch (error) {
    logger.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
} 
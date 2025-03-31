import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_PACKAGES, createCheckoutSession } from '@/lib/stripe';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';

// Simple in-memory rate limiting for payment endpoint
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute per IP

// Store rate limiting data
const rateLimitTracker: Record<string, { count: number, resetTime: number }> = {};

export async function POST(request: NextRequest) {
  try {
    // Log initial request
    logger.info('Payment request received', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });

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
      logger.warn('Rate limit exceeded for payment endpoint', { ip });
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, userId, packageId = 'basic' } = body;

    // Validate required fields
    if (!email || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get package details
    const packageDetails = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES];
    if (!packageDetails) {
      return NextResponse.json(
        { error: 'Invalid package selected' },
        { status: 400 }
      );
    }

    // Create success and cancel URLs
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const successUrl = `${origin}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/`;
      
    // Create Stripe checkout session
    const checkoutUrl = await createCheckoutSession(
      email,
      successUrl,
      cancelUrl,
      userId,
      packageId
    );

    if (!checkoutUrl) {
      logger.error('Failed to create checkout session', {
        email,
        userId,
        packageId
        });
        
        // Track failure
        trackEvent(EventType.TOKEN_PURCHASE, {
          userId,
          packageId,
        provider: 'stripe',
        status: 'failed',
        error: 'Failed to create checkout session',
          timestamp: new Date().toISOString()
        });
        
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    // Track success
    trackEvent(EventType.TOKEN_PURCHASE, {
      userId,
      packageId,
      provider: 'stripe',
      status: 'checkout_created',
      timestamp: new Date().toISOString()
    });

    // Return checkout URL
    return NextResponse.json({
      success: true,
      url: checkoutUrl
    });

  } catch (error) {
    logger.error('Error processing payment request:', error);
    return NextResponse.json(
      { error: 'Failed to process payment request' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import logger from '@/lib/logger';

// Simple in-memory rate limiting for payment endpoint
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute per IP

// Store rate limiting data
const rateLimitTracker: Record<string, { count: number, resetTime: number }> = {};

// Create a checkout session for purchasing tokens
export async function POST(request: NextRequest) {
  try {
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

    const { email, userId } = await request.json();

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Create the base URL for success and cancel URLs
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const successUrl = `${origin}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/`;

    // Create a checkout session with userId
    const checkoutUrl = await createCheckoutSession(
      email,
      successUrl,
      cancelUrl,
      userId
    );

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

// Demo route for simulating payment success
export async function GET(request: NextRequest) {
  try {
    // In a real app, we would verify the payment and create a user account
    // For demo, we'll just return a success message
    
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Mock user creation and token assignment
    return NextResponse.json({
      success: true,
      message: 'Payment successful! 10 tokens added to your account.',
      userId: 'demo-user-123',
      email,
      tokens: 10
    });
  } catch (error) {
    console.error('Error processing demo payment:', error);
    return NextResponse.json(
      { error: 'Failed to process demo payment' },
      { status: 500 }
    );
  }
} 
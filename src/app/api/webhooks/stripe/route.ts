import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { updateUserTokens, getUserData } from '@/lib/supabase';
import logger from '@/lib/logger';

// Initialize Stripe with the webhook secret
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Rate limiting for webhook endpoint (should be higher than regular endpoints)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // Higher limit for Stripe webhooks

// Store rate limiting data
const rateLimitTracker: Record<string, { count: number, resetTime: number }> = {};

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting by IP
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
      logger.warn(`Rate limit exceeded for Stripe webhook from ${ip}`);
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Get the raw request body for signature verification
    const rawBody = await request.text();
    
    // Get the Stripe signature header
    const headersList = headers();
    const signature = headersList.get('stripe-signature');
    
    if (!signature || !endpointSecret) {
      logger.error('Missing Stripe signature or webhook secret');
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }
    
    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        endpointSecret
      );
    } catch (err: any) {
      logger.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }
    
    // Handle specific event types
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Get the customer email
      const customerEmail = session.customer_details?.email;
      
      if (!customerEmail) {
        logger.error('No customer email in completed checkout session');
        return NextResponse.json(
          { error: 'Missing customer email in session' },
          { status: 400 }
        );
      }
      
      // Find the user by email in your database
      // For simplicity, we'll assume users are stored with their email in Supabase
      // In a real app, you'd have a more robust way to link Stripe customers to your users
      
      try {
        // This is a placeholder - you'd need to implement a function to get user by email
        // For example: const userData = await getUserByEmail(customerEmail);
        
        // Instead, for demo, assuming userId is stored in the client_reference_id
        const userId = session.client_reference_id;
        
        if (!userId) {
          logger.error('No userId found in session client_reference_id');
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }
        
        // Get current user data
        const userData = await getUserData(userId as string);
        if (!userData) {
          logger.error(`User not found with id ${userId}`);
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }
        
        // Add 10 tokens to the user's account
        const newTokenCount = userData.tokens + 10;
        await updateUserTokens(userId as string, newTokenCount);
        
        logger.info(`Added 10 tokens to user ${userId}, new count: ${newTokenCount}`);
      } catch (error) {
        logger.error('Error processing webhook payment:', error);
        return NextResponse.json(
          { error: 'Failed to process payment' },
          { status: 500 }
        );
      }
    }
    
    // Return a success response to Stripe
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
} 
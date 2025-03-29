import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateUserTokensWithExpiry, getUserData } from '@/lib/supabase';
import logger from '@/lib/logger';

// Initialize Stripe with the webhook secret
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Rate limiting for webhook endpoint (should be higher than regular endpoints)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // Higher limit for Stripe webhooks

// Store rate limiting data
const rateLimitTracker: Record<string, { count: number, resetTime: number }> = {};

// Token packages mapping from price IDs to token amounts
const TOKEN_PACKAGES: Record<string, number> = {
  'price_basic': 100000,    // $5.00
  'price_value': 250000,    // $10.00
  'price_pro': 600000,      // $20.00
  'price_max': 1000000,     // $25.00
};

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
    
    // Get the Stripe signature directly from request headers
    const signature = request.headers.get('stripe-signature');
    
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
      
      // Get the user ID from client_reference_id
      const userId = session.client_reference_id;
      
      if (!userId) {
        logger.error('No userId found in session client_reference_id');
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      try {
        // Get current user data
        const userData = await getUserData(userId);
        if (!userData) {
          logger.error(`User not found with id ${userId}`);
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }
        
        // Get the line items to determine which package was purchased
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;
        
        if (!priceId) {
          logger.error('No price ID found in checkout session');
          return NextResponse.json(
            { error: 'Missing price ID in session' },
            { status: 400 }
          );
        }
        
        // Map the price ID to token quantity or use default (100k) if not found
        const tokenQuantity = TOKEN_PACKAGES[priceId] || 100000;
        
        // Calculate expiration date (28 days from now)
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 28);
        
        // Update user's tokens with expiration date
        const updated = await updateUserTokensWithExpiry(
          userId,
          userData.tokens + tokenQuantity,
          expirationDate.toISOString()
        );
        
        if (!updated) {
          throw new Error(`Failed to update tokens for user ${userId}`);
        }
        
        logger.info(`Added ${tokenQuantity.toLocaleString()} tokens to user ${userId}, expires on ${expirationDate.toISOString()}`);
        
        // Return success response
        return NextResponse.json({ 
          success: true,
          message: 'Payment processed successfully',
          userId: userId,
          tokensAdded: tokenQuantity,
          expirationDate: expirationDate.toISOString(),
          newTokenCount: userData.tokens + tokenQuantity
        });
      } catch (error) {
        logger.error('Error processing webhook payment:', error);
        return NextResponse.json(
          { error: 'Failed to process payment' },
          { status: 500 }
        );
      }
    }
    
    // Return a success response to Stripe for other event types
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
} 
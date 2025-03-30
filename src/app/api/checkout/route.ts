import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    const userId = session.user.id;
    const email = session.user.email || '';
    
    // Create the base URL for success and cancel URLs
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const successUrl = `${origin}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/`;
    
    // Create a checkout session
    const checkoutUrl = await createCheckoutSession(
      email,
      successUrl,
      cancelUrl,
      userId as string
    );
    
    if (!checkoutUrl) {
      // If checkout creation fails, redirect to homepage
      logger.error('Failed to create checkout session for new user');
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    // Redirect to Stripe checkout
    return NextResponse.redirect(new URL(checkoutUrl, request.url));
  } catch (error) {
    logger.error('Error in checkout route:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
} 
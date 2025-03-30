import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';

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
    
    // Get the packageId from the query string
    const searchParams = new URL(request.url).searchParams;
    const packageId = searchParams.get('package') || 'basic'; // Default to basic package
    const isNewUser = searchParams.get('newUser') === 'true';
    
    // Create the base URL for success and cancel URLs
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const successUrl = `${origin}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/`;
    
    // Create a checkout session
    const checkoutUrl = await createCheckoutSession(
      email,
      successUrl,
      cancelUrl,
      userId as string,
      packageId
    );
    
    if (!checkoutUrl) {
      // If checkout creation fails, redirect to homepage
      logger.error('Failed to create checkout session for new user');
      
      // Track failure
      trackEvent(EventType.TOKEN_PURCHASE, {
        userId: userId as string,
        email,
        packageId,
        isNewUser,
        status: 'failed',
        error: 'Failed to create checkout session',
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    // Track successful checkout URL creation
    trackEvent(EventType.TOKEN_PURCHASE, {
      userId: userId as string,
      email,
      packageId,
      isNewUser,
      status: 'checkout_created',
      timestamp: new Date().toISOString() 
    });
    
    // Redirect to Stripe checkout
    return NextResponse.redirect(new URL(checkoutUrl, request.url));
  } catch (error) {
    logger.error('Error in checkout route:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
} 
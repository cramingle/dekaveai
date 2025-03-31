import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';
import { TOKEN_PACKAGES } from '@/lib/stripe/constants';

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
    
    const packageDetails = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES];
    if (!packageDetails) {
      logger.error('Invalid package selected');
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    // Create a checkout session
    const checkoutUrl = await createCheckoutSession(
      email,
      successUrl,
      cancelUrl,
      userId as string,
      packageId,
      packageDetails
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

export async function POST(request: Request) {
  try {
    const { email, userId, packageId } = await request.json();

    if (!email || !userId || !packageId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const packageDetails = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES];
    if (!packageDetails) {
      return NextResponse.json(
        { error: 'Invalid package selected' },
        { status: 400 }
      );
    }

    const successUrl = `${request.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${request.headers.get('origin')}/cancel`;

    const checkoutUrl = await createCheckoutSession(
      email,
      successUrl,
      cancelUrl,
      userId,
      packageId,
      packageDetails
    );

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
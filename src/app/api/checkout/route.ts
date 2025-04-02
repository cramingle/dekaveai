import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';
import { TOKEN_PACKAGES } from '@/lib/stripe/constants';
import { encrypt } from '@/lib/crypto';

export async function POST(request: Request) {
  try {
    // Get Supabase client and session
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { session } } = await supabase.auth.getSession();
    
    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { packageId, email, userId } = body;

    // Validate user matches session
    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: 'User mismatch' },
        { status: 403 }
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

    // Create the base URL for success and cancel URLs
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const successUrl = `${origin}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/`;
    
    // Create a checkout session
    const checkoutUrl = await createCheckoutSession(
      email,
      successUrl,
      cancelUrl,
      userId,
      packageId,
      packageDetails
    );
    
    if (!checkoutUrl) {
      logger.error('Failed to create checkout session');
      
      // Track failure
      trackEvent(EventType.TOKEN_PURCHASE, {
        userId,
        email,
        packageId,
        status: 'failed',
        error: 'Failed to create checkout session',
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }
    
    // Track successful checkout URL creation
    trackEvent(EventType.TOKEN_PURCHASE, {
      userId,
      email,
      packageId,
      status: 'checkout_created',
      timestamp: new Date().toISOString() 
    });
    
    // Return encrypted redirect URL
    return NextResponse.json({
      redirectUrl: encrypt(checkoutUrl)
    });
  } catch (error) {
    logger.error('Error in checkout route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
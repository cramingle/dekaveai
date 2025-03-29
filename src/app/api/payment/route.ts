import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';

// Create a checkout session for purchasing tokens
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
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
      cancelUrl
    );

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error('Error creating checkout session:', error);
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
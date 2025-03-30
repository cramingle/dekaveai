import Stripe from 'stripe';

// Stripe configuration
const STRIPE_CONFIG = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  priceId: process.env.STRIPE_PRICE_ID,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  // Map price IDs to token quantities and tiers
  tokenPackages: {
    'price_basic': { tokens: 100000, tier: 'Pioneer' },
    'price_value': { tokens: 250000, tier: 'Voyager' },
    'price_pro': { tokens: 600000, tier: 'Dominator' },
    'price_max': { tokens: 1000000, tier: 'Overlord' },
  }
};

// Check for required environment variables
if (!STRIPE_CONFIG.secretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set. Please set this environment variable to use Stripe services.');
}

if (!STRIPE_CONFIG.publishableKey) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Please set this environment variable to use Stripe services.');
}

if (!STRIPE_CONFIG.priceId) {
  throw new Error('STRIPE_PRICE_ID is not set. Please set this environment variable to use Stripe services.');
}

// Initialize the real Stripe client with the latest API version
const stripe = new Stripe(STRIPE_CONFIG.secretKey, {
  apiVersion: '2024-04-10', // Latest API version
  typescript: true
});

// Export the price ID and token package mapping
export const PRICE_ID = STRIPE_CONFIG.priceId;
export const TOKEN_PACKAGES = STRIPE_CONFIG.tokenPackages;
export const PUBLISHABLE_KEY = STRIPE_CONFIG.publishableKey;

// Create a Checkout Session for token purchase
export async function createCheckoutSession(
  customerEmail: string,
  successUrl: string,
  cancelUrl: string,
  userId: string,
  packageId: string = 'basic' // Default to basic package
): Promise<string | null> {
  try {
    // Map packageId to priceId
    const priceId = packageId === 'basic' ? PRICE_ID : 
                   packageId === 'value' ? 'price_value' :
                   packageId === 'pro' ? 'price_pro' :
                   packageId === 'max' ? 'price_max' : PRICE_ID;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        packageId: packageId
      }
    });

    return session.url;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return null;
  }
}

// Verify payment status using session ID
export async function verifyPayment(sessionId: string): Promise<boolean> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.payment_status === 'paid';
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
}

// Get customer information from a session
export async function getCustomerFromSession(sessionId: string): Promise<{
  email?: string;
  userId?: string;
  packageId?: string;
} | null> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      email: session.customer_details?.email || undefined,
      userId: session.client_reference_id || undefined,
      packageId: session.metadata?.packageId || undefined
    };
  } catch (error) {
    console.error('Error retrieving customer info:', error);
    return null;
  }
}

export default stripe; 
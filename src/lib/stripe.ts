import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID;

// Create a real or mock Stripe client based on available credentials
let stripe: any;

// If we don't have the required environment variables, use a mock implementation
if (!stripeSecretKey) {
  // Mock Stripe implementation
  stripe = {
    checkout: {
      sessions: {
        create: async (options: any) => {
          console.log('Mock Stripe: Creating checkout session', options);
          return {
            url: '/success?session_id=mock_session_123',
            id: 'mock_session_123'
          };
        },
        retrieve: async (sessionId: string) => {
          console.log('Mock Stripe: Retrieving session', sessionId);
          return {
            payment_status: 'paid',
            customer_email: 'mock@example.com'
          };
        }
      }
    }
  };
  
  console.log('Using mock Stripe client for demo purposes');
} else {
  // Initialize the real Stripe client with the latest API version (or default to one provided by Stripe)
  stripe = new Stripe(stripeSecretKey);
}

// Price ID for 10 tokens (Rp 10,000)
export const PRICE_ID = stripePriceId || 'mock_price_123';

// Create a Checkout Session for token purchase
export async function createCheckoutSession(
  customerEmail: string,
  successUrl: string,
  cancelUrl: string,
  userId: string
): Promise<string | null> {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      client_reference_id: userId,
    });

    return session.url;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return null;
  }
}

// Verify payment status using webhook
export async function verifyPayment(sessionId: string): Promise<boolean> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.payment_status === 'paid';
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
}

export default stripe; 
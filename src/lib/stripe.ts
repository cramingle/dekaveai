'use server';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { TokenPackage } from './stripe/constants';

// MCP Stripe function declarations
declare function mcp_stripe_create_customer(params: {
  name: string;
  email?: string;
}): Promise<{ id: string }>;

declare function mcp_stripe_create_payment_link(params: {
  price: string;
  quantity: number;
}): Promise<{ url: string }>;

declare function mcp_stripe_list_payment_intents(params: {
  customer?: string;
  limit?: number;
}): Promise<{
  data: Array<{
    id: string;
    amount: number;
    status: string;
    created: number;
  }>;
}>;

// Server-side functions only
export async function createOrRetrieveCustomer(userId: string, email: string, name: string) {
  try {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then(rows => rows[0]);

    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await mcp_stripe_create_customer({
      name,
      email,
    });

    await db.update(users)
      .set({ stripeCustomerId: customer.id })
      .where(eq(users.id, userId));

    return customer.id;
  } catch (error) {
    console.error('Error in createOrRetrieveCustomer:', error);
    throw error;
  }
}

export async function createCheckoutSession(
  email: string,
  successUrl: string,
  cancelUrl: string,
  userId: string,
  packageId: string,
  packageDetails: TokenPackage
) {
  try {
    const customerId = await createOrRetrieveCustomer(userId, email, email);
    
    if (!packageDetails) {
      throw new Error('Invalid package selected');
    }

    const paymentLink = await mcp_stripe_create_payment_link({
      price: packageDetails.priceId,
      quantity: 1
    });

    return paymentLink.url;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return null;
  }
}

export async function verifyPayment(sessionId: string): Promise<boolean> {
  try {
    const payments = await mcp_stripe_list_payment_intents({
      limit: 1
    });

    return payments.data.some(payment => 
      payment.id === sessionId && payment.status === 'succeeded'
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
}

export async function getPaymentHistory(customerId: string) {
  try {
    const paymentIntents = await mcp_stripe_list_payment_intents({
      customer: customerId,
      limit: 10
    });

    return paymentIntents.data.map(payment => ({
      id: payment.id,
      amount: payment.amount / 100,
      status: payment.status,
      date: new Date(payment.created * 1000).toISOString()
    }));
  } catch (error) {
    console.error('Error fetching payment history:', error);
    throw error;
  }
}
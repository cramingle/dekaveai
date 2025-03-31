import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, transactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TOKEN_PACKAGES } from '@/lib/stripe/constants';
import { env } from '@/lib/env';
import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
      console.error('Missing signature or webhook secret');
      return new NextResponse('Configuration error', { status: 400 });
    }

    // Verify webhook signature
    let event;
    try {
      const rawBody = await req.text();
      event = Stripe.webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new NextResponse('Invalid signature', { status: 400 });
    }

    // Handle different webhook events
    switch (event.type) {
      case 'payment_intent.succeeded':
        return handlePaymentSuccess(event.data.object);

      case 'payment_intent.payment_failed':
        return handlePaymentFailure(event.data.object);

      case 'payment_intent.requires_action':
        return handlePaymentActionRequired(event.data.object);

      default:
        console.log(`Unhandled event type: ${event.type}`);
        return new NextResponse('Unhandled event type', { status: 200 });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return new NextResponse('Webhook error', { status: 500 });
  }
}

async function handlePaymentSuccess(paymentIntent: any) {
  const { metadata } = paymentIntent;

  if (!metadata?.userId || !metadata?.packageId || !metadata?.transactionId) {
    console.error('Missing metadata in payment intent');
    return new NextResponse('Missing metadata', { status: 400 });
  }

  const packageDetails = TOKEN_PACKAGES[metadata.packageId as keyof typeof TOKEN_PACKAGES];
  if (!packageDetails) {
    console.error('Invalid package ID in metadata');
    return new NextResponse('Invalid package', { status: 400 });
  }

  try {
    // Update transaction status
    await db.update(transactions)
      .set({
        status: 'completed',
        metadata: {
          paymentIntentId: paymentIntent.id,
          customerId: paymentIntent.customer
        }
      })
      .where(eq(transactions.id, metadata.transactionId));

    // Update user tokens and tier
    const user = await db.select().from(users).where(eq(users.id, metadata.userId)).limit(1).then(rows => rows[0]);

    if (!user) {
      console.error('User not found');
      return new NextResponse('User not found', { status: 404 });
    }

    await db.update(users)
      .set({
        tokens: (user.tokens || 0) + packageDetails.tokens,
        tier: packageDetails.tier
      })
      .where(eq(users.id, metadata.userId));

    // Track analytics
    console.log('Payment successful:', {
      userId: metadata.userId,
      packageId: metadata.packageId,
      amount: paymentIntent.amount,
      tokens: packageDetails.tokens,
      status: 'completed',
      customer: paymentIntent.customer
    });

    return new NextResponse('Payment processed successfully', { status: 200 });
  } catch (error) {
    console.error('Error processing payment success:', error);
    return new NextResponse('Error processing payment', { status: 500 });
  }
}

async function handlePaymentFailure(paymentIntent: any) {
  const { metadata } = paymentIntent;

  if (!metadata?.transactionId) {
    return new NextResponse('Missing transaction ID', { status: 400 });
  }

  try {
    // Update transaction status
    await db.update(transactions)
      .set({
        status: 'failed',
        metadata: {
          paymentIntentId: paymentIntent.id,
          error: paymentIntent.last_payment_error?.message
        }
      })
      .where(eq(transactions.id, metadata.transactionId));

    console.log('Payment failed:', {
      transactionId: metadata.transactionId,
      error: paymentIntent.last_payment_error?.message
    });

    return new NextResponse('Payment failure recorded', { status: 200 });
  } catch (error) {
    console.error('Error processing payment failure:', error);
    return new NextResponse('Error processing payment failure', { status: 500 });
  }
}

async function handlePaymentActionRequired(paymentIntent: any) {
  const { metadata } = paymentIntent;

  if (!metadata?.transactionId) {
    return new NextResponse('Missing transaction ID', { status: 400 });
  }

  try {
    // Update transaction status
    await db.update(transactions)
      .set({
        status: 'requires_action',
        metadata: {
          paymentIntentId: paymentIntent.id,
          action: paymentIntent.next_action?.type
        }
      })
      .where(eq(transactions.id, metadata.transactionId));

    console.log('Payment requires action:', {
      transactionId: metadata.transactionId,
      action: paymentIntent.next_action?.type
    });

    return new NextResponse('Payment action requirement recorded', { status: 200 });
  } catch (error) {
    console.error('Error processing payment action requirement:', error);
    return new NextResponse('Error processing payment action requirement', { status: 500 });
  }
} 
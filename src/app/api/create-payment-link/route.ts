import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

declare function mcp_stripe_create_payment_link(params: {
  price: string;
  quantity: number;
}): Promise<{ url: string }>;

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per second
});

export async function POST(request: Request) {
  try {
    // Rate limiting
    try {
      await limiter.check(5, 'CREATE_PAYMENT_LINK'); // 5 requests per minute
    } catch {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Get session and verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { priceId, email, userId, packageId } = body;

    if (!priceId || !email || !userId || !packageId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create payment link using MCP Stripe tool
    const paymentLink = await mcp_stripe_create_payment_link({
      price: priceId,
      quantity: 1
    });

    return NextResponse.json({ url: paymentLink.url });
  } catch (error) {
    console.error('Error creating payment link:', error);
    return NextResponse.json(
      { error: 'Failed to create payment link' },
      { status: 500 }
    );
  }
} 
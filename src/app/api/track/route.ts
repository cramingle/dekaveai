import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { decrypt } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { EventType } from '@/lib/analytics';

// In a real production app, this would typically write to a database
// or send events to an external analytics service like Datadog, NewRelic, etc.

// Rate limit configuration
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

export async function POST(request: Request) {
  try {
    // Apply rate limiting - 100 requests per minute
    await limiter.check(100, 'TRACK_EVENT');

    const body = await request.json();
    
    if (!body || !body.eventData) {
      return NextResponse.json({ error: 'Missing event data' }, { status: 400 });
    }

    let decryptedData;
    try {
      // Decrypt and parse event data
      decryptedData = JSON.parse(decrypt(body.eventData));
    } catch (decryptError) {
      logger.error('Failed to decrypt event data:', decryptError);
      return NextResponse.json(
        { error: 'Invalid event data format' },
        { status: 400 }
      );
    }

    const { type, properties } = decryptedData;

    // Validate event type
    if (!Object.values(EventType).includes(type)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    // Log the event
    logger.info('Tracking event:', { type, ...properties });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error tracking event:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

// Remove GET method to enforce POST-only
export const GET = undefined; 
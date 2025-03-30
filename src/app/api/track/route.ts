import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

// In a real production app, this would typically write to a database
// or send events to an external analytics service like Datadog, NewRelic, etc.

export async function POST(request: NextRequest) {
  try {
    // Get the IP address for analytics
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Get the event data
    const { event, data, timestamp } = await request.json();
    
    if (!event) {
      return NextResponse.json(
        { error: 'Missing event type' },
        { status: 400 }
      );
    }
    
    // Prepare the event data
    const eventData = {
      event,
      data,
      timestamp: timestamp || new Date().toISOString(),
      ip: ip.split(',')[0] // Only get the first IP in case of proxies
    };
    
    // Log the event
    logger.info(`Tracking event: ${event}`, eventData);
    
    // This would call an external analytics service
    // Example: await sendToAnalyticsService(eventData);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error tracking event:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
} 
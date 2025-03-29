import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

// In a real production app, this would typically write to a database
// or send events to an external analytics service like Datadog, NewRelic, etc.

// Simple in-memory cache for recent events (for development purposes)
// This will be cleared on server restart
const recentEvents: Array<{
  event: string;
  data: any;
  timestamp: string;
  ip?: string;
}> = [];

// Maximum events to keep in memory
const MAX_EVENTS = 1000;

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
    
    // Store the event (in production this would go to a database or analytics service)
    const eventData = {
      event,
      data,
      timestamp: timestamp || new Date().toISOString(),
      ip: ip.split(',')[0] // Only get the first IP in case of proxies
    };
    
    // Log the event
    logger.info(`Tracking event: ${event}`, eventData);
    
    // Store in memory for development
    if (process.env.NODE_ENV === 'development') {
      recentEvents.unshift(eventData);
      
      // Keep the list at a manageable size
      if (recentEvents.length > MAX_EVENTS) {
        recentEvents.length = MAX_EVENTS;
      }
    }
    
    // In production, this would call an external analytics service
    if (process.env.NODE_ENV === 'production') {
      // Example: await sendToAnalyticsService(eventData);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error tracking event:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

// Endpoint to get recent events for debugging (development only)
export async function GET(request: NextRequest) {
  // Only allow in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }
  
  return NextResponse.json({ events: recentEvents });
} 
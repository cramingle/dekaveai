import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

/**
 * Compatibility route - forwards to the main /api/payment endpoint
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('Dana payment create endpoint accessed, forwarding to main payment endpoint');
    
    // Forward the request to the main payment endpoint
    const response = await fetch(new URL('/api/payment', request.url), {
      method: 'POST',
      headers: request.headers,
      body: request.body
    });
    
    // Return the response from the main endpoint
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
    
  } catch (error) {
    logger.error('Error forwarding request to payment endpoint', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
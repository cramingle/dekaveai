import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';
import { getUrl } from '@/lib/env';

/**
 * Dana Payment Redirect Handler
 * 
 * Users are redirected to this endpoint after completing (or canceling) a Dana payment.
 * This endpoint processes the redirect parameters and redirects the user to the appropriate page.
 */
export async function GET(req: NextRequest) {
  try {
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const merchantOrderNo = searchParams.get('merchantOrderNo') || searchParams.get('transaction_id');
    const errorCode = searchParams.get('errorCode') || searchParams.get('error_code');
    
    logger.info('Dana payment redirect received', { 
      status, 
      merchantOrderNo,
      errorCode,
      allParams: Object.fromEntries(searchParams.entries())
    });

    // Track the redirect event
    trackEvent(EventType.PAYMENT_REDIRECT, {
      status,
      merchantOrderNo,
      errorCode,
      timestamp: new Date().toISOString()
    });

    // Determine redirect based on status
    if (status === 'SUCCESS' || status === 'COMPLETED') {
      // Redirect to success page with transaction ID
      return NextResponse.redirect(getUrl(`/success?transaction_id=${merchantOrderNo}`));
    } else {
      // Redirect to homepage with error parameter
      let errorMessage = 'Payment canceled or failed';
      if (errorCode) {
        // Map error codes to user-friendly messages
        switch(errorCode) {
          case 'PAYMENT_EXPIRED':
            errorMessage = 'Payment session expired';
            break;
          case 'PAYMENT_CANCELLED':
            errorMessage = 'Payment was cancelled';
            break;
          case 'INSUFFICIENT_BALANCE':
            errorMessage = 'Insufficient balance';
            break;
          default:
            errorMessage = `Payment failed: ${errorCode}`;
        }
      }
      
      return NextResponse.redirect(getUrl(`/?error=${encodeURIComponent(errorMessage)}`));
    }
  } catch (error) {
    logger.error('Error processing Dana redirect', { error });
    // In case of error, redirect to homepage with generic error
    return NextResponse.redirect(getUrl(`/?error=${encodeURIComponent('An error occurred during payment')}`));
  }
} 
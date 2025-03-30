import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

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
    const transactionId = searchParams.get('transaction_id');
    const errorCode = searchParams.get('error_code');
    
    logger.info('Dana payment redirect received', { 
      status, 
      transactionId, 
      errorCode 
    });

    // Base redirect URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    // Determine redirect based on status
    if (status === 'SUCCESS') {
      // Redirect to success page with transaction ID
      // The success page will verify the payment server-side
      return NextResponse.redirect(`${baseUrl}/success?session_id=${transactionId}`);
    } else {
      // Redirect to homepage with error parameter
      let errorMessage = 'Payment canceled or failed';
      if (errorCode) {
        // Map error codes to user-friendly messages
        // This would be based on Dana's actual error codes
        switch(errorCode) {
          case 'INSUFFICIENT_BALANCE':
            errorMessage = 'Insufficient balance in your Dana account';
            break;
          case 'PAYMENT_REJECTED':
            errorMessage = 'Payment was rejected';
            break;
          default:
            errorMessage = `Payment failed: ${errorCode}`;
        }
      }
      
      return NextResponse.redirect(`${baseUrl}/?error=${encodeURIComponent(errorMessage)}`);
    }
  } catch (error) {
    logger.error('Error processing Dana redirect', error);
    // In case of error, redirect to homepage with generic error
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/?error=${encodeURIComponent('An error occurred during payment')}`);
  }
} 
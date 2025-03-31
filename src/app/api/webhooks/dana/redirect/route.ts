import { NextRequest, NextResponse } from 'next/server';
import { getUrl } from '@/lib/env';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * Dana Payment Redirect Handler
 * 
 * Users are redirected to this endpoint after completing (or canceling) a Dana payment.
 * This handles redirecting them to the appropriate page based on the payment result.
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const errorCode = searchParams.get('error_code');
    const partnerReferenceNo = searchParams.get('partner_reference_no');
    const referenceNo = searchParams.get('reference_no');
    
    // Log the redirect event
    logger.info('Dana payment redirect received', {
      status,
      errorCode,
      partnerReferenceNo,
      referenceNo,
      allParams: Object.fromEntries(searchParams.entries())
    });
    
    // Track redirect event
    trackEvent(EventType.PAYMENT_REDIRECT, {
      status,
      errorCode,
      partnerReferenceNo,
      referenceNo,
      timestamp: new Date().toISOString()
    });
    
    // Success case - redirect to success page
    if (status === 'SUCCESS') {
      // Attempt to find transaction to include in redirect
      if (partnerReferenceNo) {
        try {
          const transaction = await db
            .select()
            .from(transactions)
            .where(sql`metadata->>'partnerReferenceNo' = ${partnerReferenceNo}`)
            .limit(1)
            .then(rows => rows[0]);
          
          if (transaction) {
            // Redirect to success page with transaction ID
            return NextResponse.redirect(getUrl(`/success?transactionId=${transaction.id}`));
          }
        } catch (dbError) {
          logger.error('Error fetching transaction for success redirect', { 
            error: dbError, 
            partnerReferenceNo
          });
          // Fall through to generic success if DB query fails
        }
      }
      
      // Generic success redirect if no transaction found
      return NextResponse.redirect(getUrl('/success'));
    }
    
    // All other cases are treated as errors or cancellations
    let errorMessage = 'Payment canceled or failed';
    let severity = 'warning';
    
    // Map error codes to user-friendly messages
    if (errorCode) {
      switch (errorCode) {
        case 'PAYMENT_EXPIRED':
          errorMessage = 'Payment session expired';
          break;
        case 'PAYMENT_CANCELLED':
          errorMessage = 'Payment was cancelled';
          break;
        case 'INSUFFICIENT_BALANCE':
          errorMessage = 'Insufficient balance to complete payment';
          severity = 'error';
          break;
        default:
          errorMessage = `Payment failed: ${errorCode}`;
          severity = 'error';
      }
    }
    
    // Log the error redirect
    logger.info('Payment redirect error', { 
      errorCode, 
      errorMessage, 
      severity,
      partnerReferenceNo
    });
    
    // Redirect to home with error message
    return NextResponse.redirect(
      getUrl(`/?error=${encodeURIComponent(errorMessage)}&severity=${severity}`)
    );
  } catch (error) {
    logger.error('Error processing Dana payment redirect', { error });
    return NextResponse.redirect(getUrl(`/?error=${encodeURIComponent('An error occurred during payment')}`));
  }
} 
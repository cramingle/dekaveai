import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';
import { trackEvent, EventType } from '@/lib/analytics';

/**
 * Payment Verification API
 * 
 * Verifies if a transaction has been successfully completed
 * This is used by the success page after payment
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { transactionId } = body;
    
    if (!transactionId) {
      logger.warn('Missing transactionId in payment verification request');
      return NextResponse.json(
        { verified: false, error: 'Transaction ID is required' },
        { status: 400 }
      );
    }
    
    logger.info('Verifying payment transaction', { transactionId });
    
    // Look up transaction in database
    const transaction = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1)
      .then(rows => rows[0]);
    
    if (!transaction) {
      logger.warn('Transaction not found during verification', { transactionId });
      
      trackEvent(EventType.PAYMENT_VERIFICATION, {
        transactionId,
        status: 'not_found',
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json(
        { verified: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }
    
    // Check if transaction is completed
    const isCompleted = transaction.status === 'COMPLETED';
    
    logger.info('Payment verification result', { 
      transactionId,
      status: transaction.status,
      verified: isCompleted 
    });
    
    trackEvent(EventType.PAYMENT_VERIFICATION, {
      transactionId,
      status: transaction.status,
      verified: isCompleted,
      packageId: transaction.packageId,
      provider: transaction.provider,
      timestamp: new Date().toISOString()
    });
    
    // Return verification result
    return NextResponse.json({
      verified: isCompleted,
      status: transaction.status,
      packageId: transaction.packageId,
      timestamp: transaction.updatedAt
    });
    
  } catch (error) {
    logger.error('Error verifying payment', { error });
    
    return NextResponse.json(
      { verified: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
} 
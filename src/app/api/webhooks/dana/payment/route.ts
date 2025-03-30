import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { updateUserTokens, getUserTokens } from '@/lib/supabase';
import { TOKEN_PACKAGES } from '@/lib/dana';
import { DANA_API_SECRET } from '@/lib/env';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { trackEvent, EventType } from '@/lib/analytics';
import { sql, eq } from 'drizzle-orm';

/**
 * Dana Payment Notification Webhook
 * 
 * This endpoint receives payment notifications from Dana when a payment is completed.
 * It verifies the signature, processes the payment, and updates user tokens.
 */
export async function POST(req: NextRequest) {
  try {
    // Log headers for debugging
    logger.info('Dana payment webhook headers', {
      headers: Object.fromEntries(req.headers.entries())
    });
    
    // Get the request body
    const payload = await req.json();
    logger.info('Dana payment notification received', { payload });

    // Verify signature if provided
    const signature = req.headers.get('X-SIGNATURE');
    if (signature && DANA_API_SECRET) {
      const calculatedSignature = crypto
        .createHmac('sha256', DANA_API_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
        
      if (calculatedSignature !== signature) {
        logger.warn('Invalid Dana signature', { 
          providedSignature: signature,
          calculatedSignature
        });
        return NextResponse.json(
          { success: false, message: 'Invalid signature' }, 
          { status: 401 }
        );
      }
    }

    // Extract payment details from the payload
    // Adjust based on actual DANA QRIS notification structure
    const {
      merchantId,
      merchantOrderNo,
      acquirementStatus,
      orderAmount,
      transactionAmount,
      acquirementTime
    } = payload.response || {};

    // Check if payment status is successful (FULL_PAYMENT)
    if (acquirementStatus !== 'FULL_PAYMENT') {
      logger.warn('Payment not successful', { 
        acquirementStatus, 
        merchantOrderNo 
      });
      return NextResponse.json({ success: false, message: 'Payment not successful' });
    }

    // Find the transaction in our database
    const transaction = await db
      .select()
      .from(transactions)
      .where(sql`metadata->>'merchantOrderNo' = ${merchantOrderNo}`)
      .limit(1)
      .then(rows => rows[0]);

    if (!transaction) {
      logger.error('Transaction not found', { merchantOrderNo });
      return NextResponse.json(
        { success: false, message: 'Transaction not found' }, 
        { status: 404 }
      );
    }

    // Extract user and package information from transaction
    const userId = transaction.userId;
    const packageId = transaction.packageId;

    if (!userId) {
      logger.error('User ID not found in transaction', { transaction });
      return NextResponse.json(
        { success: false, message: 'User ID not found' }, 
        { status: 400 }
      );
    }

    // Update transaction status
    await db
      .update(transactions)
      .set({ 
        status: 'COMPLETED',
        updatedAt: new Date()
      })
      .where(eq(transactions.id, transaction.id));

    // Get token amount from package
    const tokenAmount = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES]?.tokens || 
                        TOKEN_PACKAGES.basic.tokens;
    
    // Get current user tokens
    const currentTokens = await getUserTokens(userId);
    
    // Update user tokens
    const newTokenCount = currentTokens + tokenAmount;
    const success = await updateUserTokens(userId, newTokenCount);
    
    if (!success) {
      logger.error('Failed to update user tokens', { userId, tokenAmount });
      // Note: We still return a 200 to Dana so they don't retry, but log the error
      return NextResponse.json({ success: false, message: 'Failed to update user tokens' });
    }
    
    // Track successful payment
    trackEvent(EventType.TOKEN_PURCHASE, { 
      userId,
      packageId,
      provider: 'dana',
      status: 'payment_completed',
      amount: transactionAmount?.value || orderAmount?.value,
      currency: transactionAmount?.currency || orderAmount?.currency || 'IDR',
      merchantOrderNo,
      timestamp: new Date().toISOString()
    });
    
    logger.info('Payment processed successfully', { 
      userId, 
      packageId, 
      tokenAmount, 
      newTokenCount,
      merchantOrderNo
    });
    
    // Return success to Dana
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error processing Dana payment webhook', { error });
    return NextResponse.json(
      { success: false, message: 'Error processing webhook' },
      { status: 500 }
    );
  }
}

// Helper function to summarize payload for logging without sensitive data
function summarizePayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  
  const { response } = payload;
  if (!response) return payload;
  
  return {
    merchantId: response.merchantId,
    merchantOrderNo: response.merchantOrderNo,
    acquirementStatus: response.acquirementStatus,
    orderAmount: response.orderAmount,
    acquirementTime: response.acquirementTime
  };
} 
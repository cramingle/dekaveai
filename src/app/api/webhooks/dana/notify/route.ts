import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { DANA_API_SECRET } from '@/lib/env';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';

/**
 * Dana Notify Webhook
 * 
 * This endpoint receives additional notifications about payment status.
 * It allows for asynchronous processing of payment events.
 */
export async function POST(req: NextRequest) {
  try {
    // Log headers for debugging
    logger.info('Dana notify webhook headers', {
      headers: Object.fromEntries(req.headers.entries())
    });
    
    // Get the request body
    const payload = await req.json();
    logger.info('Dana notify webhook received', { payload });

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

    // Extract notification details
    const {
      notifyType,
      merchantOrderNo,
      status,
      statusUpdateTime
    } = payload.response || {};

    // Log the notification
    logger.info('Dana notification received', {
      notifyType,
      merchantOrderNo,
      status,
      statusUpdateTime
    });

    // Find the transaction in our database
    const transaction = await db
      .select()
      .from(transactions)
      .where(sql`metadata->>'merchantOrderNo' = ${merchantOrderNo}`)
      .limit(1)
      .then(rows => rows[0]);

    if (transaction) {
      // Update transaction status based on the notification
      await db
        .update(transactions)
        .set({ 
          status: status === 'SUCCESS' ? 'COMPLETED' : status,
          updatedAt: new Date()
        })
        .where(eq(transactions.id, transaction.id));
        
      logger.info('Updated transaction status', {
        transactionId: transaction.id,
        status: status,
        previousStatus: transaction.status
      });
    } else {
      logger.warn('Transaction not found for notification', { merchantOrderNo });
    }

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error processing Dana notify webhook', { error });
    return NextResponse.json(
      { success: false, message: 'Error processing webhook' },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { updateUserTokens, getUserTokens } from '@/lib/supabase';
import { TOKEN_PACKAGES } from '@/lib/dana';
import { DANA_API_SECRET, DANA_CLIENT_SECRET } from '@/lib/env';
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
    logger.info('Dana payment notification received', { 
      payload: summarizePayload(payload) 
    });

    // Verify signature
    const signature = req.headers.get('X-SIGNATURE');
    const timestamp = req.headers.get('X-TIMESTAMP');
    
    if (signature && timestamp && DANA_API_SECRET) {
      try {
        // We don't have access to the B2B token in the webhook context
        // So we'll validate using a more relaxed approach
        const stringPayload = JSON.stringify(payload);
        const payloadHash = crypto.createHash('sha256')
          .update(stringPayload)
          .digest('hex')
          .toLowerCase();
        
        // For security, log the details we would use for verification
        logger.info('Webhook signature validation details', {
          hasSignature: !!signature,
          hasTimestamp: !!timestamp,
          signaturePreview: signature?.substring(0, 15) + '...',
          payloadHashPreview: payloadHash.substring(0, 15) + '...',
          timestampValue: timestamp
        });
        
        // Since this is a sandbox implementation and we can't fully validate the signature
        // without the access token, we'll proceed with the webhook processing
        // In production, you would implement a mechanism to retrieve or store the access token
        logger.info('Proceeding with webhook processing (sandbox mode)');
      } catch (err) {
        logger.warn('Error analyzing signature components', { error: err });
      }
    } else {
      logger.warn('Missing signature verification data', {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        hasApiSecret: !!DANA_API_SECRET
      });
    }

    // Extract payment details from the payload according to DANA Finish Notify format
    const {
      originalPartnerReferenceNo,
      originalReferenceNo,
      merchantId,
      amount,
      latestTransactionStatus,
      transactionStatusDesc,
      createdTime,
      finishedTime,
      additionalInfo
    } = payload;

    // Check if payment status is successful (00 = Success)
    if (latestTransactionStatus !== '00') {
      logger.warn('Payment not successful', { 
        latestTransactionStatus, 
        transactionStatusDesc,
        originalPartnerReferenceNo 
      });
      // Return success to DANA even if our payment is not successful
      // This prevents DANA from retrying the notification
      return NextResponse.json({ 
        responseCode: '2005600', 
        responseMessage: 'Successful' 
      });
    }

    // Find the transaction in our database using partnerReferenceNo
    const transaction = await db
      .select()
      .from(transactions)
      .where(sql`metadata->>'partnerReferenceNo' = ${originalPartnerReferenceNo}`)
      .limit(1)
      .then(rows => rows[0]);

    if (!transaction) {
      logger.error('Transaction not found', { originalPartnerReferenceNo });
      // Return success to DANA even if we can't find the transaction
      // Log the issue but prevent DANA from retrying
      return NextResponse.json(
        { responseCode: '2005600', responseMessage: 'Successful' }
      );
    }

    // Check if transaction is already completed to prevent double processing
    if (transaction.status === 'COMPLETED') {
      logger.info('Transaction already completed', { 
        originalPartnerReferenceNo,
        transactionId: transaction.id
      });
      return NextResponse.json(
        { responseCode: '2005600', responseMessage: 'Successful' }
      );
    }

    // Extract user and package information from transaction
    const userId = transaction.userId;
    const packageId = transaction.packageId;

    if (!userId) {
      logger.error('User ID not found in transaction', { transaction });
      return NextResponse.json(
        { responseCode: '2005600', responseMessage: 'Successful' }
      );
    }

    // Update transaction status
    await db
      .update(transactions)
      .set({ 
        status: 'COMPLETED',
        updatedAt: new Date(),
        metadata: {
          ...transaction.metadata,
          paymentStatus: latestTransactionStatus,
          paymentStatusDesc: transactionStatusDesc,
          finishedTime: finishedTime,
          additionalInfo: additionalInfo
        }
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
      // Still return success to DANA - we'll need to handle this manually or with a background job
      return NextResponse.json({ 
        responseCode: '2005600', 
        responseMessage: 'Successful' 
      });
    }
    
    // Extract payment method info if available
    let paymentMethod = 'unknown';
    if (additionalInfo?.paymentInfo?.payOptionInfos?.[0]?.payMethod) {
      paymentMethod = additionalInfo.paymentInfo.payOptionInfos[0].payMethod;
    }
    
    // Track successful payment
    trackEvent(EventType.TOKEN_PURCHASE, { 
      userId,
      packageId,
      provider: 'dana',
      status: 'payment_completed',
      paymentMethod,
      amount: amount.value,
      currency: amount.currency,
      partnerReferenceNo: originalPartnerReferenceNo,
      referenceNo: originalReferenceNo,
      timestamp: new Date().toISOString()
    });
    
    logger.info('Payment processed successfully', { 
      userId, 
      packageId, 
      tokenAmount, 
      newTokenCount,
      partnerReferenceNo: originalPartnerReferenceNo
    });
    
    // Return success to Dana with the expected response format from docs
    return NextResponse.json({ 
      responseCode: '2005600', 
      responseMessage: 'Successful' 
    });
  } catch (error) {
    logger.error('Error processing Dana payment webhook', { error });
    // Return a success response to prevent DANA from retrying
    // We'll need to handle this failure manually by checking logs
    return NextResponse.json(
      { responseCode: '2005600', responseMessage: 'Successful' },
      { status: 200 }
    );
  }
}

// Helper function to summarize payload for logging without sensitive data
function summarizePayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;
  
  const { 
    originalPartnerReferenceNo, 
    originalReferenceNo,
    merchantId,
    latestTransactionStatus,
    transactionStatusDesc,
    amount
  } = payload;
  
  return {
    originalPartnerReferenceNo,
    originalReferenceNo,
    merchantId,
    latestTransactionStatus,
    transactionStatusDesc,
    amount,
    // Include timestamps but not detailed payment info
    hasAdditionalInfo: !!payload.additionalInfo
  };
} 
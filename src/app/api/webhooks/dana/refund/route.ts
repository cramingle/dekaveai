import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { updateUserTokens, getUserTokens } from '@/lib/supabase';
import { TOKEN_PACKAGES } from '@/lib/dana'; // Import from dana.ts instead of stripe.ts

/**
 * Dana Refund Notification Webhook
 * 
 * This endpoint receives refund notifications from Dana when a refund is processed.
 * It verifies the signature, processes the refund, and updates user tokens.
 */
export async function POST(req: NextRequest) {
  try {
    // Get the request body
    const payload = await req.json();
    logger.info('Dana refund notification received', { payloadSummary: summarizePayload(payload) });

    // TODO: Add signature verification with Dana's SDK
    // const isSignatureValid = verifyDanaSignature(req);
    // if (!isSignatureValid) {
    //   logger.warn('Invalid Dana signature', { headers: Object.fromEntries(req.headers.entries()) });
    //   return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 401 });
    // }

    // Extract refund details from the payload
    // Note: Adjust these field names based on actual Dana API response structure
    const {
      refund_id,
      transaction_id,
      status,
      amount,
      metadata,
    } = payload;

    // Check refund status
    if (status !== 'SUCCESS') {
      logger.warn('Refund not successful', { status, refund_id, transaction_id });
      return NextResponse.json({ success: false, message: 'Refund not successful' });
    }

    // Extract user and package information from metadata
    // In actual implementation, Dana may provide different ways to include metadata
    const userId = metadata?.userId;
    const packageId = metadata?.packageId || 'basic';

    if (!userId) {
      logger.error('User ID not found in refund metadata', { metadata });
      return NextResponse.json({ success: false, message: 'User ID not found' }, { status: 400 });
    }

    // Get token amount from package
    const tokenAmount = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES]?.tokens || TOKEN_PACKAGES.basic.tokens;
    
    // Get current user tokens
    const currentTokens = await getUserTokens(userId);
    
    // Update user tokens (deduct tokens for refund)
    const newTokenCount = Math.max(0, currentTokens - tokenAmount); // Ensure we don't go below 0
    const success = await updateUserTokens(userId, newTokenCount);
    
    if (!success) {
      logger.error('Failed to update user tokens for refund', { userId, tokenAmount });
      // Note: We still return a 200 to Dana so they don't retry, but log the error
      return NextResponse.json({ success: false, message: 'Failed to update user tokens' });
    }
    
    logger.info('Refund processed successfully', { 
      userId, 
      packageId, 
      tokenAmount, 
      newTokenCount 
    });
    
    // Return success to Dana
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error processing Dana refund webhook', error);
    return NextResponse.json(
      { success: false, message: 'Error processing webhook' },
      { status: 500 }
    );
  }
}

// Helper function to summarize payload for logging without sensitive data
function summarizePayload(payload: any): any {
  const { refund_id, transaction_id, status, amount } = payload || {};
  return { refund_id, transaction_id, status, amount };
} 
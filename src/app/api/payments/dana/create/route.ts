import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { TOKEN_PACKAGES } from '@/lib/dana';
import logger from '@/lib/logger';
import { 
  DANA_API_KEY, 
  DANA_API_SECRET, 
  DANA_MERCHANT_ID, 
  DANA_ENVIRONMENT,
  getUrl 
} from '@/lib/env';

// Dana API base URL
const DANA_API_BASE_URL = DANA_ENVIRONMENT === 'production'
  ? 'https://api.dana.com' // Replace with actual production URL
  : 'https://api.sandbox.dana.id'; // Sandbox URL

/**
 * API Route to create a Dana payment
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Dana is configured
    if (!DANA_API_KEY || !DANA_API_SECRET || !DANA_MERCHANT_ID) {
      return NextResponse.json(
        { error: 'Dana payment is not configured on the server' },
        { status: 500 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { email, userId, packageId, amount, description } = body;
    
    // Validate required fields
    if (!email || !userId || !packageId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Calculate timestamp for request
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Generate order ID
    const orderId = `order_${userId}_${timestamp}_${Math.floor(Math.random() * 1000)}`;
    
    // Create request payload
    const payload = {
      merchant_id: DANA_MERCHANT_ID,
      order_id: orderId,
      amount: amount.toFixed(2),
      currency: 'IDR',
      item_description: description,
      customer_email: email,
      timestamp: timestamp,
      notification_urls: {
        payment: getUrl('/api/webhooks/dana/payment'),
        refund: getUrl('/api/webhooks/dana/refund'),
        payment_code: getUrl('/api/webhooks/dana/payment-code'),
      },
      redirect_url: getUrl('/api/webhooks/dana/redirect'),
      metadata: {
        userId: userId,
        packageId: packageId
      }
    };
    
    // Generate signature
    const signatureBase = `${DANA_MERCHANT_ID}|${orderId}|${amount.toFixed(2)}|${timestamp}`;
    const signature = crypto
      .createHmac('sha256', DANA_API_SECRET)
      .update(signatureBase)
      .digest('hex');
      
    // Log the API request for debugging
    logger.info('Making Dana payment request', {
      url: `${DANA_API_BASE_URL}/v2/payments/create`,
      orderId,
      merchantId: DANA_MERCHANT_ID,
      amount: amount.toFixed(2)
    });
    
    // Make the API request to Dana
    const response = await fetch(`${DANA_API_BASE_URL}/v2/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dana-Merchant-ID': DANA_MERCHANT_ID,
        'X-Dana-Signature': signature,
        'X-Dana-Timestamp': timestamp,
        'X-Dana-API-Key': DANA_API_KEY
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      // Get the error response
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = await response.text();
      }
      
      logger.error('Dana payment creation failed', {
        status: response.status,
        error: errorData
      });
      
      return NextResponse.json(
        { error: 'Failed to create Dana payment', details: errorData },
        { status: response.status }
      );
    }
    
    // Parse the successful response
    const data = await response.json();
    
    // Log success
    logger.info('Dana payment created successfully', {
      orderId,
      packageId,
      userId
    });
    
    // Return success response
    return NextResponse.json({
      success: true,
      orderId: orderId,
      paymentUrl: data.payment_url
    });
    
  } catch (error) {
    logger.error('Server error creating Dana payment', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
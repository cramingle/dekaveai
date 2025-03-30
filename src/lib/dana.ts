import logger from './logger';
import crypto from 'crypto';

// Define Dana configuration interface
interface DanaConfig {
  apiKey: string | undefined;
  apiSecret: string | undefined;
  merchantId: string | undefined;
  environment: 'sandbox' | 'production';
  endpoints: {
    paymentNotification: string;
    refundNotification: string;
    paymentCodeNotification: string;
    redirectUrl: string;
  };
}

// Dana configuration
const DANA_CONFIG: DanaConfig = {
  apiKey: process.env.DANA_API_KEY,
  apiSecret: process.env.DANA_API_SECRET,
  merchantId: process.env.DANA_MERCHANT_ID,
  environment: (process.env.DANA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  endpoints: {
    paymentNotification: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/dana/payment`,
    refundNotification: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/dana/refund`,
    paymentCodeNotification: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/dana/payment-code`,
    redirectUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/webhooks/dana/redirect`,
  }
};

// Flag to track if Dana is properly configured
export const IS_DANA_CONFIGURED = !!(
  DANA_CONFIG.apiKey && 
  DANA_CONFIG.apiSecret && 
  DANA_CONFIG.merchantId
);

// Log configuration status
if (!IS_DANA_CONFIGURED) {
  logger.warn('Dana payment is not properly configured. Set DANA_API_KEY, DANA_API_SECRET, and DANA_MERCHANT_ID environment variables.');
} else {
  logger.info('Dana payment is configured for', { environment: DANA_CONFIG.environment });
}

// Token package mapping 
export const TOKEN_PACKAGES = {
  'basic': { tokens: 100000, tier: 'Pioneer', price: 75000 },
  'value': { tokens: 250000, tier: 'Voyager', price: 150000 },
  'pro': { tokens: 600000, tier: 'Dominator', price: 300000 },
  'max': { tokens: 1000000, tier: 'Overlord', price: 450000 },
};

/**
 * Generate a DANA payment URL
 * 
 * This function creates a payment request with Dana and returns the URL
 * where the user should be redirected to complete the payment.
 * 
 * @param customerEmail - Customer's email address
 * @param userId - User ID in our system
 * @param packageId - Package ID to purchase (basic, value, pro, max)
 * @returns URL to redirect the user to or null if payment creation fails
 */
export async function createDanaPayment(
  customerEmail: string,
  userId: string,
  packageId: string = 'basic'
): Promise<string | null> {
  try {
    if (!IS_DANA_CONFIGURED) {
      logger.error('Dana payment is not configured. Payment creation failed.', {
        apiKey: !!DANA_CONFIG.apiKey,
        apiSecret: !!DANA_CONFIG.apiSecret,
        merchantId: !!DANA_CONFIG.merchantId
      });
      return null;
    }

    // Get package details
    const packageDetails = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES] || TOKEN_PACKAGES.basic;
    const amount = packageDetails.price;

    // Calculate timestamp for request
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Generate order ID
    const orderId = `order_${userId}_${timestamp}_${Math.floor(Math.random() * 1000)}`;
    
    // Create request payload
    const payload = {
      merchant_id: DANA_CONFIG.merchantId,
      order_id: orderId,
      amount: amount.toFixed(2),
      currency: 'IDR', // Changed from USD to IDR for DANA payments
      item_description: `${packageDetails.tokens} Token Package - ${packageDetails.tier}`,
      customer_email: customerEmail,
      timestamp: timestamp,
      notification_urls: {
        payment: DANA_CONFIG.endpoints.paymentNotification,
        refund: DANA_CONFIG.endpoints.refundNotification,
        payment_code: DANA_CONFIG.endpoints.paymentCodeNotification,
      },
      redirect_url: DANA_CONFIG.endpoints.redirectUrl,
      metadata: {
        userId: userId,
        packageId: packageId
      }
    };
    
    // Generate signature
    const signatureBase = `${DANA_CONFIG.merchantId}|${orderId}|${amount.toFixed(2)}|${timestamp}`;
    const signature = crypto
      .createHmac('sha256', DANA_CONFIG.apiSecret || '')
      .update(signatureBase)
      .digest('hex');
      
    // Determine API base URL based on environment
    const apiBaseUrl = DANA_CONFIG.environment === 'production'
      ? 'https://api.dana.com' // Replace with actual production URL
      : 'https://api.sandbox.dana.id'; // Correct sandbox URL
      
    // Log API request for debugging
    logger.info('Making Dana payment request', {
      url: `${apiBaseUrl}/v2/payments/create`,
      orderId,
      merchantId: DANA_CONFIG.merchantId,
      amount: amount.toFixed(2)
    });
    
    // Make the API request to Dana
    const response = await fetch(`${apiBaseUrl}/v2/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dana-Merchant-ID': DANA_CONFIG.merchantId || '',
        'X-Dana-Signature': signature,
        'X-Dana-Timestamp': timestamp,
        'X-Dana-API-Key': DANA_CONFIG.apiKey || ''
      },
      body: JSON.stringify(payload)
    });
    
    // Log detailed response information
    logger.info('Dana API response received', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // If the response is not OK, try to parse the error or handle the response text
    if (!response.ok) {
      try {
        const errorData = await response.json();
        logger.error('Dana payment creation failed with JSON error', { 
          status: response.status, 
          error: errorData 
        });
      } catch (jsonError) {
        // If JSON parsing fails, get text response instead
        const textResponse = await response.text();
        logger.error('Dana payment creation failed with text response', {
          status: response.status,
          text: textResponse
        });
      }
      return null;
    }
    
    // Try to parse the response as JSON
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      // If JSON parsing fails, try to get the text response
      const textResponse = await response.text();
      logger.error('Failed to parse Dana API response as JSON', {
        text: textResponse,
        error: jsonError
      });
      return null;
    }
    
    // Log success
    logger.info('Dana payment created successfully', { 
      orderId, 
      packageId, 
      userId,
      responseData: data
    });
    
    // Check for payment_url in the response
    if (!data.payment_url) {
      logger.error('Dana API response missing payment_url', { data });
      return null;
    }
    
    // Return the payment URL where the user should be redirected
    return data.payment_url;
  } catch (error) {
    logger.error('Error creating Dana payment', error);
    return null;
  }
}

/**
 * Verify a Dana payment
 * 
 * This function verifies the status of a payment with the Dana API.
 * 
 * @param transactionId - The Dana transaction ID to verify
 * @returns Boolean indicating whether the payment is valid and completed
 */
export async function verifyDanaPayment(transactionId: string): Promise<boolean> {
  try {
    if (!IS_DANA_CONFIGURED) {
      logger.warn('Attempted to verify Dana payment but Dana is not configured');
      return false;
    }
    
    // Calculate timestamp for request
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Generate signature (example implementation - adjust based on Dana's requirements)
    const signatureBase = `${DANA_CONFIG.merchantId}|${transactionId}|${timestamp}`;
    const signature = crypto
      .createHmac('sha256', DANA_CONFIG.apiSecret || '')
      .update(signatureBase)
      .digest('hex');
      
    // Determine API base URL based on environment
    const apiBaseUrl = DANA_CONFIG.environment === 'production'
      ? 'https://api.dana.com' // Replace with actual production URL
      : 'https://api.sandbox.dana.id'; // Correct sandbox URL
      
    // Make the API request to Dana
    // Note: This is an example implementation - adjust based on Dana's actual API
    const response = await fetch(`${apiBaseUrl}/payments/${transactionId}/status`, {
      method: 'GET',
      headers: {
        'X-Dana-Merchant-ID': DANA_CONFIG.merchantId || '',
        'X-Dana-Signature': signature,
        'X-Dana-Timestamp': timestamp,
        'X-Dana-API-Key': DANA_CONFIG.apiKey || ''
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Dana payment verification failed', { 
        status: response.status, 
        error: errorData,
        transactionId 
      });
      return false;
    }
    
    const data = await response.json();
    
    // Check payment status
    const isSuccessful = data.status === 'SUCCESS'; // Adjust based on Dana's actual status codes
    
    // Log result
    if (isSuccessful) {
      logger.info('Dana payment verified successfully', { transactionId });
    } else {
      logger.warn('Dana payment verification failed - payment not successful', { 
        transactionId,
        status: data.status 
      });
    }
    
    return isSuccessful;
  } catch (error) {
    logger.error('Error verifying Dana payment', error);
    return false;
  }
}

/**
 * Verify a Dana signature from webhook
 * 
 * This function verifies that a webhook request actually came from Dana.
 * 
 * @param signature - The signature from the request header
 * @param payload - The request body (payload)
 * @returns Boolean indicating whether the signature is valid
 */
export function verifyDanaSignature(signature: string, payload: any): boolean {
  try {
    if (!IS_DANA_CONFIGURED) {
      logger.warn('Attempted to verify Dana signature but Dana is not configured');
      return false;
    }
    
    // Example signature verification - adjust based on Dana's actual requirements
    const payloadString = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload);
      
    const expectedSignature = crypto
      .createHmac('sha256', DANA_CONFIG.apiSecret || '')
      .update(payloadString)
      .digest('hex');
      
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Error verifying Dana signature', error);
    return false;
  }
}

/**
 * Get customer information from a Dana transaction
 * 
 * This function retrieves customer information from a Dana transaction.
 * 
 * @param transactionId - The Dana transaction ID
 * @returns Customer information or null if retrieval fails
 */
export async function getCustomerFromDanaTransaction(
  transactionId: string
): Promise<{
  email?: string;
  userId?: string;
  packageId?: string;
} | null> {
  try {
    if (!IS_DANA_CONFIGURED) {
      logger.warn('Attempted to get customer from Dana transaction but Dana is not configured');
      return null;
    }
    
    // Calculate timestamp for request
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Generate signature (example implementation - adjust based on Dana's requirements)
    const signatureBase = `${DANA_CONFIG.merchantId}|${transactionId}|${timestamp}`;
    const signature = crypto
      .createHmac('sha256', DANA_CONFIG.apiSecret || '')
      .update(signatureBase)
      .digest('hex');
      
    // Determine API base URL based on environment
    const apiBaseUrl = DANA_CONFIG.environment === 'production'
      ? 'https://api.dana.com' // Replace with actual production URL
      : 'https://api.sandbox.dana.id'; // Correct sandbox URL
      
    // Make the API request to Dana
    // Note: This is an example implementation - adjust based on Dana's actual API
    const response = await fetch(`${apiBaseUrl}/payments/${transactionId}`, {
      method: 'GET',
      headers: {
        'X-Dana-Merchant-ID': DANA_CONFIG.merchantId || '',
        'X-Dana-Signature': signature,
        'X-Dana-Timestamp': timestamp,
        'X-Dana-API-Key': DANA_CONFIG.apiKey || ''
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Dana transaction retrieval failed', { 
        status: response.status, 
        error: errorData,
        transactionId 
      });
      return null;
    }
    
    const data = await response.json();
    
    // Extract metadata from the response
    // Note: Adjust based on Dana's actual API response structure
    return {
      email: data.customer_email,
      userId: data.metadata?.userId,
      packageId: data.metadata?.packageId
    };
  } catch (error) {
    logger.error('Error retrieving Dana transaction', error);
    return null;
  }
}

// Export default client
export default {
  IS_DANA_CONFIGURED,
  TOKEN_PACKAGES,
  createDanaPayment,
  verifyDanaPayment,
  verifyDanaSignature,
  getCustomerFromDanaTransaction
}; 
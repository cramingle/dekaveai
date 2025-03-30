import logger from './logger';
import { getUrl, DANA_ENABLED, DANA_ENVIRONMENT } from './env';

// Define Dana configuration interface
interface DanaConfig {
  environment: 'sandbox' | 'production';
  endpoints: {
    paymentNotification: string;
    refundNotification: string;
    paymentCodeNotification: string;
    redirectUrl: string;
  };
}

// Dana configuration - client-safe version
const DANA_CONFIG: DanaConfig = {
  environment: DANA_ENVIRONMENT,
  endpoints: {
    paymentNotification: getUrl('/api/webhooks/dana/payment'),
    refundNotification: getUrl('/api/webhooks/dana/refund'),
    paymentCodeNotification: getUrl('/api/webhooks/dana/payment-code'),
    redirectUrl: getUrl('/api/webhooks/dana/redirect'),
  }
};

// Flag to track if Dana is properly configured - just check for presence of public flag
export const IS_DANA_CONFIGURED = DANA_ENABLED;

// Log configuration status
if (!IS_DANA_CONFIGURED) {
  logger.warn('Dana payment appears to not be configured. Set NEXT_PUBLIC_DANA_ENABLED environment variable.');
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
 * Note: This now uses a server API route to handle the actual payment creation.
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
      logger.error('Dana payment is not configured. Payment creation failed.');
      return null;
    }

    // Get package details
    const packageDetails = TOKEN_PACKAGES[packageId as keyof typeof TOKEN_PACKAGES] || TOKEN_PACKAGES.basic;
    
    // Now we'll call our API route to create the payment instead of doing it client-side
    const response = await fetch(
      typeof window === 'undefined' 
        ? getUrl('/api/payment')
        : '/api/payment',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: customerEmail,
          userId: userId,
          packageId: packageId,
          amount: packageDetails.price,
          description: `${packageDetails.tokens} Token Package - ${packageDetails.tier}`
        }),
      });
    
    // Log detailed response information
    logger.info('Dana API response received', {
      status: response.status,
      statusText: response.statusText,
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
      packageId, 
      userId,
    });
    
    // Check for payment_url in the response
    if (!data.paymentUrl) {
      logger.error('Dana API response missing paymentUrl', { data });
      return null;
    }
    
    // Return the payment URL where the user should be redirected
    return data.paymentUrl;
  } catch (error) {
    logger.error('Error creating Dana payment', error);
    return null;
  }
}

// Export default client
export default {
  IS_DANA_CONFIGURED,
  TOKEN_PACKAGES,
  createDanaPayment
}; 
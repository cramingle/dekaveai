import logger from './logger';
import { getUrl, DANA_ENABLED, DANA_ENVIRONMENT, BASE_URL, DANA_CLIENT_ID, DANA_API_SECRET } from './env';
import crypto from 'crypto';

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

// Simple in-memory token cache
interface TokenCache {
  token: string;
  expiresAt: number; // Timestamp when token expires
}

let accessTokenCache: TokenCache | null = null;

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
    const apiUrl = typeof window === 'undefined' 
      ? (BASE_URL.includes('REQUIRED') 
          ? 'https://dekaveai.vercel.app/api/payment' 
          : `${BASE_URL}/api/payment`)
      : '/api/payment';
      
    logger.info('Making Dana payment request to', { url: apiUrl });
    
    const response = await fetch(apiUrl, {
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
          statusText: response.statusText,
          url: apiUrl,
          error: errorData,
          timestamp: new Date().toISOString()
        });
      } catch (jsonError) {
        // If JSON parsing fails, get text response instead
        const textResponse = await response.text();
        logger.error('Dana payment creation failed with text response', {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          text: textResponse,
          timestamp: new Date().toISOString()
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

/**
 * Verify a DANA payment status
 * 
 * This checks if a transaction was successfully completed
 * Used by the success page to confirm payment before showing success
 * 
 * @param transactionId - The transaction ID to verify
 * @returns Boolean indicating if payment is verified
 */
export async function verifyDanaPayment(transactionId: string): Promise<boolean> {
  try {
    if (!IS_DANA_CONFIGURED) {
      logger.warn('Dana payment is not configured. Verification failed.');
      return false;
    }

    // In a real implementation, we would query our database 
    // to check if this transaction is marked as COMPLETED
    const verifyUrl = typeof window === 'undefined' 
      ? (BASE_URL.includes('REQUIRED') 
          ? 'https://dekaveai.vercel.app/api/payment/verify' 
          : `${BASE_URL}/api/payment/verify`)
      : '/api/payment/verify';
    
    logger.info('Verifying Dana payment', { transactionId, url: verifyUrl });
    
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transactionId }),
    });
    
    if (!response.ok) {
      logger.error('Dana payment verification failed', { 
        status: response.status,
        statusText: response.statusText
      });
      return false;
    }

    const data = await response.json();
    
    if (!data.verified) {
      logger.warn('Dana payment not verified', { 
        transactionId,
        status: data.status 
      });
      return false;
    }
    
    logger.info('Dana payment verified successfully', { transactionId });
    return true;
  } catch (error) {
    logger.error('Error verifying Dana payment', { error, transactionId });
    return false;
  }
}

/**
 * Get a B2B access token from DANA
 * This token is required for API authentication
 * Uses an in-memory cache to avoid requesting a new token for every payment
 * 
 * @returns The access token or null if acquisition fails
 */
export async function getDanaAccessToken(): Promise<string | null> {
  try {
    // Check if we have a valid cached token
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
      logger.info('Using cached DANA B2B access token', {
        expiresIn: Math.round((accessTokenCache.expiresAt - Date.now()) / 1000) + ' seconds'
      });
      return accessTokenCache.token;
    }
    
    if (!IS_DANA_CONFIGURED) {
      logger.warn('Dana payment is not configured. Cannot get access token.');
      return null;
    }

    // Check if required credentials are available
    if (!DANA_CLIENT_ID || !DANA_API_SECRET) {
      logger.error('Missing required DANA credentials for token acquisition', {
        hasClientId: !!DANA_CLIENT_ID,
        hasApiSecret: !!DANA_API_SECRET
      });
      return null;
    }

    const DANA_API_BASE_URL = DANA_ENVIRONMENT === 'production'
      ? 'https://api.saas.dana.id'
      : 'https://api.sandbox.dana.id';

    const TOKEN_ENDPOINT = '/v1.0/partner/accessToken.apply';
    
    // Generate timestamp in DANA format (YYYY-MM-DDTHH:mm:ss+07:00)
    const date = new Date();
    const offset = 7 * 60; // GMT+7 in minutes
    const adjustedDate = new Date(date.getTime() + (offset * 60 * 1000));
    
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = adjustedDate.getUTCFullYear();
    const month = pad(adjustedDate.getUTCMonth() + 1);
    const day = pad(adjustedDate.getUTCDate());
    const hours = pad(adjustedDate.getUTCHours());
    const minutes = pad(adjustedDate.getUTCMinutes());
    const seconds = pad(adjustedDate.getUTCSeconds());
    const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
    
    // Generate signature for token request using asymmetric signature
    // Format: <X-CLIENT-KEY> + "|" + <X-TIMESTAMP>
    const clientKey = DANA_CLIENT_ID;
    const signatureBase = `${clientKey}|${timestamp}`;
    
    logger.info('Generating B2B token signature', { 
      signatureBasePreview: signatureBase,
      timestamp
    });
    
    // For asymmetric signature, we should use RSA, but since we're using the provided
    // DANA_API_SECRET for simplicity in this implementation
    const signature = crypto
      .createHmac('sha512', DANA_API_SECRET)
      .update(signatureBase)
      .digest('base64');
    
    const headers = {
      'Content-Type': 'application/json',
      'X-CLIENT-KEY': clientKey,
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature
    };
    
    logger.info('Requesting DANA B2B access token', {
      url: `${DANA_API_BASE_URL}${TOKEN_ENDPOINT}`,
      clientKey: clientKey,
      headers: {
        ...headers,
        'X-SIGNATURE': signature.substring(0, 20) + '...'
      }
    });
    
    // Make the token request
    const response = await fetch(`${DANA_API_BASE_URL}${TOKEN_ENDPOINT}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    
    logger.info('DANA token API response received', {
      status: response.status,
      statusText: response.statusText
    });
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        logger.error('DANA token acquisition failed', { 
          status: response.status,
          data: errorData
        });
      } catch (e) {
        logger.error('DANA token acquisition failed with non-JSON response', { 
          status: response.status,
          text: await response.text()
        });
      }
      return null;
    }
    
    const data = await response.json();
    
    if (!data.accessToken) {
      logger.error('DANA token response missing accessToken', { data });
      return null;
    }
    
    logger.info('DANA B2B access token acquired successfully', {
      tokenPreview: data.accessToken.substring(0, 10) + '...',
      expiresIn: data.expiresIn
    });
    
    // Cache the token with a safety margin (expires 1 minute before actual expiry)
    const safetyMarginMs = 60 * 1000; // 1 minute
    accessTokenCache = {
      token: data.accessToken,
      expiresAt: Date.now() + (data.expiresIn * 1000) - safetyMarginMs
    };
    
    return data.accessToken;
  } catch (error) {
    logger.error('Error acquiring DANA B2B access token', { error });
    return null;
  }
}

// Export default client
export default {
  IS_DANA_CONFIGURED,
  TOKEN_PACKAGES,
  createDanaPayment
}; 
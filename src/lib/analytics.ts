// Custom analytics utilities for tracking app usage and key events
import logger from './logger';
import { getUrl, BASE_URL } from './env';

// Track costs for reporting and billing
export interface CostData {
  imageAnalysisCost?: number;
  promptGenerationCost?: number;
  dalleGenerationCost?: number;
  totalCostUSD: number;
}

// Define event types for consistent tracking
export enum EventType {
  PAGE_VIEW = 'page_view',
  TOKEN_PURCHASE = 'token_purchase',
  AD_GENERATION = 'ad_generation',
  AD_GENERATION_ERROR = 'ad_generation_error',
  BRAND_ANALYSIS = 'brand_analysis',
  TOKEN_USAGE = 'token_usage',
  QUALITY_SELECTION = 'quality_selection',
  IMAGE_UPLOAD = 'image_upload',
  PAYMENT_REDIRECT = 'payment_redirect',
  PAYMENT_VERIFICATION = 'payment_verification',
  SIGN_IN = 'user_sign_in',
  ERROR = 'error',
  TOKEN_PURCHASE_INITIATED = 'token_purchase_initiated',
  PAYMENT_LINK_CREATED = 'payment_link_created',
  PAYMENT_LINK_ERROR = 'payment_link_error',
}

interface EventProperties {
  [key: string]: any;
}

// Track events using Vercel Analytics
export async function trackEvent(type: EventType, properties: EventProperties = {}) {
  try {
    // Sanitize properties to ensure they're JSON-serializable
    const sanitizedProps = Object.entries(properties).reduce((acc, [key, value]) => {
      // Convert Date objects to ISO strings
      if (value instanceof Date) {
        acc[key] = value.toISOString();
      } 
      // Convert undefined/null to empty string
      else if (value === undefined || value === null) {
        acc[key] = '';
      }
      // Keep other primitive values as is
      else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    // Prepare event data
    const eventData = {
      type,
      properties: {
        ...sanitizedProps,
        timestamp: new Date().toISOString()
      }
    };

    // Get base URL for the app
    let baseUrl = '';
    try {
      // Try to get window.location if in browser
      if (typeof window !== 'undefined' && window.location) {
        baseUrl = `${window.location.protocol}//${window.location.host}`;
      } else {
        // Fallback to environment variable or hardcoded value
        baseUrl = getUrl('/');
      }
    } catch (urlError) {
      console.warn('Could not determine base URL:', urlError);
      // Default to relative URL as last resort
      baseUrl = '';
    }

    // Build absolute URL for tracking endpoint
    const trackUrl = baseUrl ? `${baseUrl}/api/track` : '/api/track';
    console.log(`Tracking event to: ${trackUrl}`);

    // Send to tracking endpoint
    const response = await fetch(trackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ eventData })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to track event:', errorText);
    }
  } catch (error) {
    // Log error but don't throw to prevent breaking the app
    console.error('Error tracking event:', error);
  }
}

// Track page views
export function trackPageView(url: string, referrer?: string) {
  trackEvent(EventType.PAGE_VIEW, { 
    url, 
    referrer: referrer || document.referrer || 'direct',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
  });
}

// Track token usage
export function trackTokenUsage(userId: string, tokensUsed: number, costData: CostData) {
  trackEvent(EventType.TOKEN_USAGE, {
    userId,
    tokensUsed,
    costData,
    timestamp: new Date().toISOString()
  });
}

// Track ad generation
export function trackAdGeneration(userId: string, isHDQuality: boolean, costData: CostData) {
  trackEvent(EventType.AD_GENERATION, {
    userId,
    isHDQuality,
    cost: costData.totalCostUSD,
    timestamp: new Date().toISOString(),
    quality: isHDQuality ? 'HD' : 'Standard'
  });
}

// Track ad generation errors
export function trackAdGenerationError(userId: string, isHD: boolean, errorMessage?: string) {
  // Track failed ad generation
  trackEvent(EventType.AD_GENERATION_ERROR, {
    userId,
    quality: isHD ? 'HD' : 'Standard',
    timestamp: new Date().toISOString(),
    error: errorMessage || 'Unknown error'
  });
}

// Track token purchases
export function trackTokenPurchase(userId: string, amount: number, packageId: string) {
  trackEvent(EventType.TOKEN_PURCHASE, {
    userId,
    amount,
    packageId,
    timestamp: new Date().toISOString()
  });
} 
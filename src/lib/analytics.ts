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
  SIGN_IN = 'user_sign_in',
  TOKEN_PURCHASE = 'token_purchase',
  AD_GENERATION = 'ad_generation',
  AD_GENERATION_ERROR = 'ad_generation_error',
  TOKEN_USAGE = 'token_usage',
  QUALITY_SELECTION = 'quality_selection',
  IMAGE_UPLOAD = 'image_upload',
  PAGE_VIEW = 'page_view'
}

// Track events using Vercel Analytics
export async function trackEvent(eventType: EventType, data: Record<string, any>) {
  try {
    // Log the event for our server-side records
    logger.info(`Analytics Event: ${eventType}`, data);
    
    // Track event with Vercel Analytics (client-side)
    if (typeof window !== 'undefined') {
      // This will be caught by the Vercel Analytics SDK
      const analyticsEvent = new CustomEvent('vercel-analytics', {
        detail: {
          name: eventType,
          properties: data
        }
      });
      
      window.dispatchEvent(analyticsEvent);
    }
    
    // For server-side events, also send to a tracking endpoint
    // This could be a custom endpoint that stores events in a database
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      try {
        const trackUrl = BASE_URL.includes('REQUIRED')
          ? 'https://dekaveai.vercel.app/api/track'
          : `${BASE_URL}/api/track`;
          
        await fetch(trackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            event: eventType, 
            data,
            timestamp: new Date().toISOString()
          })
        });
      } catch (error) {
        // Non-blocking - we don't want analytics failures to break the app
        logger.error('Failed to send server-side analytics:', error);
      }
    }
  } catch (error) {
    // Non-blocking - analytics should never break the app
    logger.error('Analytics error:', error);
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
export function trackAdGenerationError(userId: string, error: string) {
  trackEvent(EventType.AD_GENERATION_ERROR, {
    userId,
    error,
    timestamp: new Date().toISOString()
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
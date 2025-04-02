// Custom analytics utilities for tracking app usage and key events
import logger from './logger';
import { getUrl, BASE_URL } from './env';
import { encrypt } from './crypto';

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
  ERROR = 'error'
}

interface EventProperties {
  [key: string]: any;
}

// Track events using Vercel Analytics
export async function trackEvent(type: EventType, properties: EventProperties = {}) {
  try {
    // Prepare event data
    const eventData = {
      type,
      properties: {
        ...properties,
        timestamp: new Date().toISOString()
      }
    };

    // Encrypt the event data
    const encryptedData = encrypt(JSON.stringify(eventData));

    // Send to tracking endpoint
    const response = await fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ eventData: encryptedData })
    });

    if (!response.ok) {
      console.error('Failed to track event:', await response.text());
    }
  } catch (error) {
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
export function trackAdGenerationError(userId: string, error: string) {
  trackEvent(EventType.ERROR, {
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
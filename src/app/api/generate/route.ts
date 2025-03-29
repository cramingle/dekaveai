import { NextRequest, NextResponse } from 'next/server';
import { processRequest } from '@/lib/ai-processing';
import { getUserData, updateUserTokens } from '@/lib/supabase';
import logger from '@/lib/logger';
import { trackAdGeneration, trackAdGenerationError } from '@/lib/analytics';

// Simple in-memory rate limiting 
// Note: For production with multiple servers, use Redis or a similar distributed solution
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_REQUESTS_PER_WINDOW = 5; // Maximum 5 requests per minute per IP

// Store rate limiting data
const rateLimitTracker: Record<string, { count: number, resetTime: number }> = {};

// Clean up the rate limit tracker periodically
setInterval(() => {
  const now = Date.now();
  // Remove expired entries
  Object.keys(rateLimitTracker).forEach(key => {
    if (rateLimitTracker[key].resetTime < now) {
      delete rateLimitTracker[key];
    }
  });
}, 5 * 60 * 1000); // Clean up every 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    // Initialize rate limit data for this IP if it doesn't exist
    if (!rateLimitTracker[ip]) {
      rateLimitTracker[ip] = {
        count: 0,
        resetTime: Date.now() + RATE_LIMIT_WINDOW
      };
    }
    
    // Reset count if the window has passed
    if (Date.now() > rateLimitTracker[ip].resetTime) {
      rateLimitTracker[ip] = {
        count: 0,
        resetTime: Date.now() + RATE_LIMIT_WINDOW
      };
    }
    
    // Increment request count
    rateLimitTracker[ip].count++;
    
    // Check if rate limit is exceeded
    if (rateLimitTracker[ip].count > MAX_REQUESTS_PER_WINDOW) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimitTracker[ip].resetTime - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitTracker[ip].resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }
    
    const { imageUrl, prompt, userId, templateName, isHDQuality } = await request.json();

    // Validate input
    if (!imageUrl || !prompt || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl, prompt, or userId' },
        { status: 400 }
      );
    }

    // Get user data
    const userData = await getUserData(userId);
    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if tokens are expired
    if (userData.tokens_expiry_date) {
      const expiryDate = new Date(userData.tokens_expiry_date);
      if (expiryDate < new Date()) {
        return NextResponse.json(
          { error: 'Tokens have expired', tokensExpired: true, expiryDate: userData.tokens_expiry_date },
          { status: 403 }
        );
      }
    }

    // Calculate token cost based on quality
    const tokenCost = isHDQuality ? 20000 : 10000;

    // Check if user has enough tokens
    if (userData.tokens < tokenCost) {
      return NextResponse.json(
        { error: 'Not enough tokens', tokensNeeded: tokenCost, tokensAvailable: userData.tokens },
        { status: 403 }
      );
    }

    // Process the request with proper error handling
    try {
      // Call AI processing with quality option
      const result = await processRequest(
        imageUrl, 
        prompt, 
        templateName || 'sportsDrink', // Use default template if none provided
        [], // Reference URLs not implemented yet
        isHDQuality || false // Default to standard quality if not specified
      );

      // Track successful generation for analytics
      trackAdGeneration(userId, Boolean(isHDQuality), result.costData);

      // Decrement tokens based on quality
      const newTokenCount = userData.tokens - tokenCost;
      await updateUserTokens(userId, newTokenCount);

      // Return the result with cost data for transparency
      return NextResponse.json({
        adDescription: result.adDescription,
        adImageUrl: result.adImageUrl,
        costData: result.costData,
        tokensLeft: newTokenCount,
        tokensUsed: tokenCost
      });
    } catch (error: any) {
      logger.error('Error in AI processing:', error);
      
      // Track generation error for analytics
      trackAdGenerationError(userId, error.message || 'Unknown error');
      
      // Return specific error for better debugging
      return NextResponse.json(
        { 
          error: 'AI processing failed', 
          message: error.message || 'Unknown error',
          tokensLeft: userData.tokens // No tokens were used
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// Remove the GET endpoint for production as it bypasses authentication
// If you need a demo endpoint, implement proper rate limiting and safeguards 
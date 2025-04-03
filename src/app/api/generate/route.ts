import { NextRequest, NextResponse } from 'next/server';
import { processRequest } from '@/lib/ai-processing';
import { updateUserTokens, getUserTokens, getUserConversation, saveUserConversation } from '@/lib/supabase';
import logger from '@/lib/logger';
import { trackAdGeneration, trackAdGenerationError } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// Rate limiting setup
const rateLimit = 10; // Max requests per minute
const rateLimitWindow = 60 * 1000; // 1 minute
const ipRequests = new Map<string, number[]>();

// Clean up expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of ipRequests.entries()) {
    const validTimestamps = timestamps.filter(time => now - time < rateLimitWindow);
    if (validTimestamps.length === 0) {
      ipRequests.delete(ip);
    } else {
      ipRequests.set(ip, validTimestamps);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

// Add a token cost calculation function
function calculateTokenCost(imageUrl: string, prompt: string, isHDQuality?: boolean): number {
  // Base token cost
  const baseCost = isHDQuality ? 10000 : 5000;
  
  // Add complexity based on prompt length
  const promptComplexity = Math.min(1.5, 1 + (prompt.length / 500)); // Max 50% increase
  
  // Calculate final cost
  return Math.floor(baseCost * promptComplexity);
}

export const maxDuration = 60; // Set max duration to 60 seconds (1 minutes) for Vercel
export const dynamic = 'force-dynamic'; // Disable static optimization

// Update the POST function with better timeout handling and retries
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { imageUrl, prompt, userId, resetConversation, templateName, isHDQuality } = data;
    
    // Validate required inputs
    if (!imageUrl) {
      console.error('Missing imageUrl in request');
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }
    
    if (!prompt) {
      console.error('Missing prompt in request');
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }
    
    let currentTokens = 100000; // Default high token count for free mode
    
    // Check if we have a valid userId (temporary or real)
    if (!userId) {
      console.error('Missing userId in request');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Calculate the token cost for this operation
    const tokenCost = calculateTokenCost(imageUrl, prompt, isHDQuality);
    
    console.log(`Processing request for user ${userId} with token cost ${tokenCost}`);
    
    try {
      // Load previous conversation context if needed
      if (!resetConversation) {
        try {
          await getUserConversation(userId);
        } catch (convError) {
          console.warn('Could not load conversation context:', convError);
          // Continue without conversation context
        }
      }
      
      // Process the request with retries
      const MAX_RETRIES = 2;
      let lastError = null;
      
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`Retry attempt ${attempt} for user ${userId}`);
          }
          
          // Process the request with user ID to maintain conversation context
          const result = await processRequest(
            imageUrl,
            prompt,
            templateName || 'sportsDrink', // Default template if none provided
            [], // No reference URLs for now
            isHDQuality || false,
            userId // Pass userId to maintain conversation context
          );
          
          // Save the updated conversation context
          if (result.conversationSummary) {
            try {
              await saveUserConversation(userId, result.conversationSummary);
            } catch (saveError) {
              console.warn('Failed to save conversation:', saveError);
              // Continue without saving conversation
            }
          }
          
          // Track successful generation for analytics
          trackAdGeneration(userId, Boolean(isHDQuality), result.costData);
          
          // Return the generated ad
          return NextResponse.json({
            adDescription: result.adDescription,
            adImageUrl: result.adImageUrl,
            tokenUsage: {
              imageAnalysis: result.costData.imageAnalysisTokens,
              promptGeneration: result.costData.promptGenerationTokens,
              totalCost: result.costData.totalCostUSD
            },
            tokensLeft: currentTokens - tokenCost, // Return updated token count for client-side tracking
            tokensUsed: tokenCost,
            hasConversationContext: !!result.conversationSummary
          });
        } catch (error: any) {
          lastError = error;
          
          // Determine if we should retry based on error type
          if (error.status === 429 || error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504) {
            console.log(`Retryable error encountered (${error.status}), attempt ${attempt + 1} of ${MAX_RETRIES + 1}`);
            
            // Wait before retrying (exponential backoff)
            const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          
          // For non-retryable errors, break and return error response
          break;
        }
      }
      
      // If we get here, all retries failed
      console.error('All generation attempts failed:', lastError);
      trackAdGenerationError(userId, Boolean(isHDQuality), String(lastError));
      
      // Determine appropriate error message and status code
      let errorMessage = 'Failed to generate content. Please try again.';
      let statusCode = 500;
      
      if (lastError?.status === 429) {
        errorMessage = 'Our service is experiencing high demand. Please try again in a moment.';
        statusCode = 429;
      } else if (lastError?.status === 504 || lastError?.message?.includes('timeout')) {
        errorMessage = 'The request took too long to process. Try a simpler prompt or standard quality.';
        statusCode = 504;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    } catch (processingError) {
      console.error('Error processing generation request:', processingError);
      trackAdGenerationError(userId, Boolean(isHDQuality), String(processingError));
      
      return NextResponse.json(
        { error: processingError instanceof Error ? processingError.message : 'Failed to process generation request' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in generate API route:', error);
    return NextResponse.json(
      { error: 'Failed to process request. Please check your inputs and try again.' },
      { status: 500 }
    );
  }
} 
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
    
    // For tracking purposes, decrement tokens from browser localStorage
    // But we'll never actually reject based on token count
    
    try {
      // Load previous conversation context if needed
      if (!resetConversation) {
        // Get the conversation but we don't need to store it in a variable
        // since processRequest will handle the conversation state internally using userId
        await getUserConversation(userId);
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
        await saveUserConversation(userId, result.conversationSummary);
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
    } catch (processingError) {
      console.error('Error processing generation request:', processingError);
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
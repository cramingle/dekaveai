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
    
    let currentTokens = 100000; // Default high token count for free mode
    
    // Check if we have a valid userId (temporary or real)
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Calculate the token cost for this operation
    const tokenCost = calculateTokenCost(imageUrl, prompt, isHDQuality);
    
    console.log(`Processing request for user ${userId} with token cost ${tokenCost}`);
    
    /* Commented out authentication check and token validation from database
    // Validate user existence and token count
    const { data: userData, error } = await supabase
      .from('users')
      .select('tokens')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user data:', error);
      return NextResponse.json(
        { error: 'Error fetching user data' },
        { status: 500 }
      );
    }
    
    const currentTokens = userData?.tokens || 0;
    */
    
    // For tracking purposes, decrement tokens from browser localStorage
    // But we'll never actually reject based on token count
    
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
    
    /* Commented out updating user tokens in database
    // Update user tokens after successful generation
    const newTokenCount = currentTokens - tokenCost;
    await updateUserTokens(userId, newTokenCount);
    */
    
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
    
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
} 
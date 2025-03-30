import { NextRequest, NextResponse } from 'next/server';
import { processRequest } from '@/lib/ai-processing';
import { getServerSession } from 'next-auth';
import { authOptions, getUserConversation, saveUserConversation } from '@/lib/auth';
import { updateUserTokens, getUserTokens } from '@/lib/supabase';
import logger from '@/lib/logger';
import { trackAdGeneration, trackAdGenerationError } from '@/lib/analytics';

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

export async function POST(req: NextRequest) {
  try {
    // Get the current user
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Parse request body
    const { imageUrl, prompt, templateName, isHDQuality, resetConversation } = await req.json();
    
    // Validate required parameters
    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    
    // Apply rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Initialize rate limit data for this IP if it doesn't exist
    if (!ipRequests.has(ip)) {
      ipRequests.set(ip, []);
    }
    
    // Get current requests for this IP
    const requests = ipRequests.get(ip)!;
    
    // Remove timestamps outside the window
    const now = Date.now();
    const recentRequests = requests.filter(time => now - time < rateLimitWindow);
    
    // Check if rate limit exceeded
    if (recentRequests.length >= rateLimit) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    // Add current request timestamp
    recentRequests.push(now);
    ipRequests.set(ip, recentRequests);
    
    // Get user's current token count
    const currentTokens = await getUserTokens(userId);
    
    // Calculate token cost based on quality
    const tokenCost = isHDQuality ? 20000 : 10000;
    
    // Check if user has enough tokens
    if (currentTokens < tokenCost) {
      return NextResponse.json(
        { error: 'Not enough tokens', tokensNeeded: tokenCost, tokensAvailable: currentTokens },
        { status: 403 }
      );
    }
    
    // Load previous conversation context if requested
    let conversationContext = null;
    if (!resetConversation) {
      conversationContext = await getUserConversation(userId);
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
    
    // Update user tokens after successful generation
    const newTokenCount = currentTokens - tokenCost;
    await updateUserTokens(userId, newTokenCount);
    
    // Return the generated ad
    return NextResponse.json({
      adDescription: result.adDescription,
      adImageUrl: result.adImageUrl,
      tokenUsage: {
        imageAnalysis: result.costData.imageAnalysisTokens,
        promptGeneration: result.costData.promptGenerationTokens,
        totalCost: result.costData.totalCostUSD
      },
      tokensLeft: newTokenCount,
      tokensUsed: tokenCost,
      hasConversationContext: !!result.conversationSummary
    });
    
  } catch (error) {
    // Log the error
    logger.error('Error generating ad:', error);
    
    // Get user ID from error if available
    const errorObj = error as any;
    const userId = errorObj?.userId || errorObj?.user?.id;
    
    if (userId) {
      // Track generation error for analytics
      trackAdGenerationError(userId, error instanceof Error ? error.message : 'An error occurred');
    }
    
    // Return error response
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}

// Remove the GET endpoint for production as it bypasses authentication
// If you need a demo endpoint, implement proper rate limiting and safeguards 
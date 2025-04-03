/**
 * AI Processing Module
 * 
 * Handles AI tasks for generating professional marketing content
 * using OpenAI's models with cost optimization.
 */

import OpenAI from 'openai';
import { encode } from 'gpt-tokenizer'; // For token counting
import logger from './logger'; // Import the structured logger
import { ConversationManager, createConversationManager } from './conversation-manager';

// Remove fs and path imports since we're no longer using the file system
// import fs from 'fs';
// import path from 'path';

/**
 * Enhances a product image to improve quality and appeal for marketing
 * 
 * @param imageUrl - URL of the original product image to enhance
 * @returns Promise containing URL of the enhanced image
 */
export async function enhanceImage(imageUrl: string): Promise<string> {
  try {
    logger.info('Enhancing image quality:', { imageUrl });
    
    // Fetch the image data to analyze
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    // Convert blob to File object which implements the FileLike interface required by OpenAI
    const imageBlob = await imageResponse.blob();
    const imageFile = new File([imageBlob], 'product-image.png', { type: 'image/png' });
    
    // Initialize AI with upscaling instructions
    const response = await openai.images.edit({
      image: imageFile,
      prompt: "Enhance this product image. Improve lighting, color balance, and sharpness. Remove any background distractions. Make the product appear more professional and appealing for marketing.",
      n: 1,
      size: "1024x1024",
      response_format: "url"
    });
    
    const enhancedImageUrl = response.data[0]?.url;
    if (!enhancedImageUrl) {
      throw new Error("No enhanced image URL returned from API");
    }
    
    // Store the enhanced image permanently (OpenAI URLs expire)
    return await storeGeneratedImage(enhancedImageUrl);
  } catch (error) {
    logger.error('Error enhancing image:', error);
    throw new Error('Failed to enhance image');
  }
}

// AI processing logic using cost-optimized OpenAI models
// import fs from 'fs';
// import path from 'path';

// Initialize OpenAI client with better error handling
let openai: OpenAI;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  if (!process.env.OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY is not set. Set this environment variable to use OpenAI services.');
  }
} catch (error) {
  logger.error('Failed to initialize OpenAI client:', error);
  // Create a dummy client that will throw appropriate errors when used
  openai = {} as OpenAI;
}

// Cost tracking for billing and analytics
interface CostTracker {
  imageAnalysisTokens: number;
  promptGenerationTokens: number;
  dalleImageGeneration: number;
  totalCostUSD: number;
}

// Store conversation managers by user ID for persistent conversations
const userConversations = new Map<string, ConversationManager>();

// Get or create a conversation manager for a specific user
function getConversationManager(userId: string): ConversationManager {
  if (!userConversations.has(userId)) {
    userConversations.set(userId, createConversationManager({
      systemPrompt: "You are an AI assistant specializing in creating professional product advertisements. You analyze product images and generate marketing materials based on user prompts and brand templates."
    }));
  }
  return userConversations.get(userId)!;
}

// Update the function to fetch from Supabase
export async function loadBrandTemplate(templateName: string): Promise<any> {
  try {
    // Create Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    console.log(`Loading brand template: ${templateName}`);
    
    // Fetch template from brand_templates table
    const { data: template, error } = await supabase
      .from('brand_templates')
      .select('*')
      .eq('name', templateName)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      throw error;
    }

    if (!template) {
      // Fetch default template if requested template not found
      const { data: defaultTemplate, error: defaultError } = await supabase
        .from('brand_templates')
        .select('*')
        .eq('name', 'sportsDrink')
        .single();

      if (defaultError || !defaultTemplate) {
        throw new Error('No templates found in database');
      }
      
      console.warn(`Template ${templateName} not found, using default template`);
      return defaultTemplate.profile;
    }

    return template.profile;
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    throw new Error(`Failed to load template ${templateName}. Please try again.`);
  }
}

// Count tokens in text for cost estimation with error handling
function countTokens(text: string): number {
  try {
    if (!text) return 0;
    return encode(text).length;
  } catch (error) {
    logger.error('Error counting tokens:', error);
    // Fallback estimation based on characters (less accurate but better than crashing)
    return Math.ceil(text.length / 4); // Very rough approximation
  }
}

// Analyze user product image with GPT-4o-mini (more cost effective than GPT-4o)
export async function analyzeProductImage(imageUrl: string): Promise<{analysis: any, tokenUsage: number}> {
  try {
    const systemPrompt = "You are a product analyst who can extract key features and selling points from product images.";
    const userPrompt = "Analyze this product image and extract key information that would be useful for creating an advertisement. Include product type, features, colors, potential target audience, and any notable unique selling points. Return your analysis in JSON format. Be concise and focus only on the most important details to minimize token usage.";
    
    // Count input tokens for cost calculation
    const inputTokens = countTokens(systemPrompt) + countTokens(userPrompt);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Most cost-effective vision model
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text" as const,
              text: userPrompt
            },
            {
              type: "image_url" as const,
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent, concise results
      response_format: { type: "json_object" },
      max_tokens: 500 // Limit output tokens to control costs
    });
    
    // Calculate total tokens used (input + output)
    const outputTokens = response.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    
    // Parse the JSON response
    return {
      analysis: JSON.parse(response.choices[0].message.content || "{}"),
      tokenUsage: totalTokens
    };
  } catch (error) {
    console.error('Error analyzing product image:', error);
    throw new Error('Failed to analyze product image. Please try again.');
  }
}

// Create a prompt for DALL-E based on brand template and product analysis
export async function createDALLEPrompt(
  brandProfile: any,
  productAnalysis: any,
  userPrompt: string
): Promise<{prompt: string, tokenUsage: number}> {
  try {
    // Optimize input data to reduce tokens
    const optimizedBrandProfile = {
      messaging_style: brandProfile.brand_style_profile?.messaging_style,
      typography: brandProfile.brand_style_profile?.typography,
      color_scheme: brandProfile.brand_style_profile?.color_scheme,
      product_placement: brandProfile.brand_style_profile?.product_placement,
      layout_structure: brandProfile.brand_style_profile?.layout_structure
    };
    
    const systemPrompt = "Create a detailed DALL-E 3 prompt for a professional advertisement. Focus on layout, colors, product placement, and typography. Be specific but concise.";
    
    const combinedContext = {
      brandStyle: optimizedBrandProfile,
      productDetails: productAnalysis,
      userPrompt: userPrompt
    };
    
    // Count input tokens for cost tracking
    const inputJson = JSON.stringify(combinedContext);
    const inputTokens = countTokens(systemPrompt) + countTokens(inputJson);
    
    // Use GPT-3.5 Turbo instead of GPT-4o-mini for non-vision tasks to save costs
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Much cheaper than GPT-4 models for text-only tasks
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Create a detailed prompt for DALL-E 3 based on this information: ${inputJson}. The prompt should be under 1000 characters.`
        }
      ],
      temperature: 0.7,
      max_tokens: 600 // Limit token usage
    });
    
    // Calculate total tokens
    const outputTokens = response.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    
    return {
      prompt: response.choices[0].message.content || "",
      tokenUsage: totalTokens
    };
  } catch (error) {
    console.error('Error creating DALL-E prompt:', error);
    throw new Error('Failed to create DALL-E prompt. Please try again.');
  }
}

// Generate an ad image using DALL-E 3
export async function generateAdImage(prompt: string, isHDQuality: boolean): Promise<string> {
  try {
    // Trim prompt to stay within DALL-E limits and reduce costs
    const trimmedPrompt = prompt.slice(0, 900);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: trimmedPrompt,
      n: 1,
      size: "1024x1024", // Size is the same for both qualities
      quality: isHDQuality ? "hd" : "standard", // Quality differs based on parameter
      style: "vivid"
    });
    
    const generatedImageUrl = response.data[0].url || "";
    
    // Store the image (DALL-E URLs expire after a short time)
    return await storeGeneratedImage(generatedImageUrl);
  } catch (error) {
    console.error('Error generating ad image:', error);
    throw new Error('Failed to generate ad image. Please try again.');
  }
}

// Store the generated image - persists DALL-E images which expire after a short time
async function storeGeneratedImage(imageUrl: string): Promise<string> {
  try {
    // Import Vercel Blob Storage
    const { put } = await import('@vercel/blob');
    
    // Fetch the image from the OpenAI URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const imageBlob = await response.blob();
    const filename = `ad-images/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.png`;
    
    // Store the image in Vercel Blob Storage
    logger.info(`Storing image to Vercel Blob Storage: ${filename}`);
    const { url } = await put(
      filename, 
      imageBlob, 
      { 
        access: 'public',
        contentType: imageBlob.type,
        addRandomSuffix: false // We already add randomness to the filename
      }
    );
    
    logger.info(`Image stored successfully at: ${url}`);
    return url;
  } catch (error) {
    logger.error('Error storing generated image:', error);
    throw new Error('Failed to store generated image');
  }
}

// Add new interface for brand analysis
interface BrandProfile {
  brandStyle: string;
  colorPalette: string[];
  visualElements: string[];
  moodAndTone: string;
  targetAudience: string;
  industryCategory: string;
  timestamp: string;
}

// Add specialized function for brand analysis
export async function analyzeBrandProfile(imageUrl: string): Promise<{analysis: BrandProfile, tokenUsage: number}> {
  try {
    const systemPrompt = "You are a brand identity expert who analyzes visual brand elements and extracts key characteristics.";
    const userPrompt = `Analyze this brand image and extract key brand elements. Focus on:
1. Overall brand style and aesthetic
2. Color palette (provide as array of color descriptions)
3. Key visual elements and symbols (provide as array)
4. Mood and tone
5. Target audience indicators
6. Industry category

Provide the analysis in a structured JSON format matching the BrandProfile interface.`;
    
    // Count input tokens for cost calculation
    const inputTokens = countTokens(systemPrompt) + countTokens(userPrompt);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      temperature: 0.5, // Lower temperature for more consistent analysis
      response_format: { type: "json_object" },
      max_tokens: 500
    });
    
    // Calculate total tokens used
    const outputTokens = response.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    
    // Parse and validate the response
    const brandProfile = JSON.parse(response.choices[0].message.content || "{}") as BrandProfile;
    
    // Add timestamp
    brandProfile.timestamp = new Date().toISOString();
    
    return {
      analysis: brandProfile,
      tokenUsage: totalTokens
    };
  } catch (error) {
    console.error('Error analyzing brand profile:', error);
    throw new Error('Failed to analyze brand profile. Please try again.');
  }
}

// Use proper template from Supabase in processRequest function
export async function processRequest(
  imageUrl: string,
  prompt: string,
  templateName?: string,
  referenceAdUrls: string[] = [],
  isHDQuality: boolean = false,
  userId?: string
): Promise<{ adDescription: string; adImageUrl: string; costData: CostTracker; conversationSummary?: string }> {
  try {
    // Get or create conversation manager for this user
    const conversationManager = userId ? 
      getConversationManager(userId) : 
      createConversationManager();
    
    // Initialize cost tracking
    const costData: CostTracker = {
      imageAnalysisTokens: 0,
      promptGenerationTokens: 0,
      dalleImageGeneration: 0,
      totalCostUSD: 0
    };
    
    // Step 1: Analyze brand profile first
    console.log('Analyzing brand profile...');
    const { analysis: brandProfile, tokenUsage: brandTokens } = await analyzeBrandProfile(imageUrl);
    costData.imageAnalysisTokens += brandTokens;
    
    // Add brand analysis to conversation context
    conversationManager.addAssistantMessage(`I've analyzed your brand profile. Here are the key elements: ${JSON.stringify(brandProfile)}`);
    
    // Step 2: Analyze product details
    console.log('Analyzing product details...');
    const { analysis: productAnalysis, tokenUsage: productTokens } = await analyzeProductImage(imageUrl);
    costData.imageAnalysisTokens += productTokens;
    
    // Add product analysis to conversation context
    conversationManager.addAssistantMessage(`I've analyzed your product image. Here are the key details: ${JSON.stringify(productAnalysis)}`);
    
    // Get brand profile from template
    let brandProfileFromTemplate: any;
    
    if (templateName) {
      // Use pre-defined template
      brandProfileFromTemplate = await loadBrandTemplate(templateName);
      
      // Update system prompt with brand template information
      conversationManager.updateSystemPrompt(
        `You are an AI assistant specializing in creating professional product advertisements. You analyze product images and generate marketing materials based on user prompts and brand templates. Current brand template: ${JSON.stringify(brandProfileFromTemplate)}`
      );
    } else if (referenceAdUrls.length > 0) {
      // For now, use default template to save on costs
      brandProfileFromTemplate = await loadBrandTemplate('sportsDrink');
      console.log('Using default template as reference ad analysis is not implemented yet');
    } else {
      throw new Error('Either a template name or reference ad URLs must be provided');
    }
    
    // Step 3: Create a detailed prompt for DALL-E 3 
    console.log('Creating DALL-E prompt...');
    
    // Use conversation context for generating the DALL-E prompt
    const messageContext = conversationManager.getMessages();
    
    // Add specific instruction for DALL-E prompt creation
    messageContext.push({
      role: 'user',
      content: `Based on our conversation so far, create a detailed DALL-E 3 prompt for a professional advertisement. Focus on layout, colors, product placement, and typography. Consider the product analysis and brand template. Keep the prompt under 900 characters. Include the following elements from the brand profile: style: ${brandProfile.brandStyle}, colors: ${brandProfile.colorPalette.join(', ')}, mood: ${brandProfile.moodAndTone}, target audience: ${brandProfile.targetAudience}.`
    });
    
    // Use conversation history when generating the DALL-E prompt
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", 
      messages: messageContext,
      temperature: 0.7,
      max_tokens: 600
    });
    
    const dallePrompt = response.choices[0].message.content || "";
    const promptTokens = response.usage?.total_tokens || 0;
    costData.promptGenerationTokens = promptTokens;
    
    // Add the generated DALL-E prompt to conversation history
    conversationManager.addAssistantMessage(`I've created a DALL-E prompt for your advertisement: ${dallePrompt}`);
    
    // Calculate cost for prompt generation (GPT-3.5 Turbo)
    // $0.0015 per 1K input tokens, $0.002 per 1K output tokens
    const promptGenerationCost = (promptTokens / 1000) * 0.002;
    
    // Step 4: Generate the ad image using DALL-E 3
    console.log(`Generating advertisement image (${isHDQuality ? 'HD' : 'Standard'} quality)...`);
    const adImageUrl = await generateAdImage(dallePrompt, isHDQuality);
    
    // Add the generated image to conversation history
    conversationManager.addAssistantMessage(`I've generated an advertisement image based on your requirements. [Generated Image]`);
    
    // DALL-E 3 image generation cost
    // Standard quality: $0.04 per image, HD quality: $0.08 per image
    const dalleGenerationCost = isHDQuality ? 0.08 : 0.04;
    costData.dalleImageGeneration = dalleGenerationCost;
    
    // Calculate total cost
    costData.totalCostUSD = costData.imageAnalysisTokens * 0.02 + promptGenerationCost + dalleGenerationCost;
    
    // Log costs for monitoring
    console.log('Cost breakdown:', {
      imageAnalysis: `$${(costData.imageAnalysisTokens * 0.02).toFixed(4)} (${costData.imageAnalysisTokens} tokens)`,
      promptGeneration: `$${promptGenerationCost.toFixed(4)} (${promptTokens} tokens)`,
      imageGeneration: `$${dalleGenerationCost.toFixed(2)} (${isHDQuality ? 'HD' : 'Standard'})`,
      total: `$${costData.totalCostUSD.toFixed(4)} USD`
    });
    
    return {
      adDescription: dallePrompt,
      adImageUrl: adImageUrl,
      costData: costData,
      // Include conversation summary for context if needed by the client
      conversationSummary: userId ? undefined : conversationManager.serialize()
    };
  } catch (error) {
    console.error('Error processing request:', error);
    throw new Error('Failed to process request. Please try again.');
  }
} 
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

interface BrandProfile {
  brandStyle: string;
  colorPalette: string[];
  visualElements: string[];
  moodAndTone: string;
  targetAudience: string;
  industryCategory: string;
  timestamp: string;
}

const BRAND_PROFILE_PROMPT = `Analyze this brand image and extract key brand elements in JSON format with these properties:
{
  "brandStyle": "string describing overall style and aesthetic",
  "colorPalette": ["array of hex color codes"],
  "visualElements": ["array of key visual elements and symbols"],
  "moodAndTone": "string describing mood and tone",
  "targetAudience": "string describing target audience",
  "industryCategory": "string describing industry category"
}`;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function blobUrlToBase64(blobUrl: string): Promise<string> {
  try {
    // Check if it's a blob URL
    if (!blobUrl.startsWith('blob:')) {
      console.log('Not a blob URL, returning as is:', blobUrl.substring(0, 30) + '...');
      return blobUrl;
    }
    
    console.log('Converting blob URL to base64:', blobUrl.substring(0, 30) + '...');
    
    // Try to fetch the blob
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          console.log('Successfully converted blob to base64 data URL');
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return a string'));
        }
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(new Error('FileReader error: ' + (err.target as any)?.error?.message || 'Unknown error'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting blob to base64:', error);
    throw new Error(`Failed to convert image URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract brand profile from an image using AI vision
 */
export async function extractBrandProfile(imageUrl: string): Promise<BrandProfile> {
  try {
    console.log('Extracting brand profile from:', imageUrl.substring(0, 50) + '...');
    
    // Safety check for valid image URL
    if (!imageUrl || (typeof imageUrl === 'string' && imageUrl.trim().length === 0)) {
      throw new Error('Invalid image URL provided');
    }
    
    // Handle blob URLs properly
    if (imageUrl.startsWith('blob:')) {
      throw new Error('Blob URLs are not supported at this stage. The image must be converted to base64 first.');
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a brand identity expert who analyzes visual brand elements and extracts key characteristics."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this brand image and extract key brand elements. Focus on:
1. Overall brand style and aesthetic
2. Color palette (provide as array of color descriptions)
3. Key visual elements and symbols (provide as array)
4. Mood and tone
5. Target audience indicators
6. Industry category

Provide the analysis in a structured JSON format matching the BrandProfile interface.`
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
      max_tokens: 500
    });
    
    // Parse and validate the response
    const brandProfile = JSON.parse(response.choices[0].message.content || "{}") as BrandProfile;
    
    // Validate the extracted profile has required fields
    if (!brandProfile.brandStyle || !brandProfile.colorPalette || !brandProfile.moodAndTone) {
      console.warn('Incomplete brand profile extracted:', brandProfile);
      throw new Error('Incomplete brand profile extracted. Please try again with a clearer brand image.');
    }
    
    // Ensure colorPalette is an array
    if (!Array.isArray(brandProfile.colorPalette)) {
      brandProfile.colorPalette = [brandProfile.colorPalette as unknown as string];
    }
    
    // Ensure visualElements is an array
    if (!Array.isArray(brandProfile.visualElements)) {
      brandProfile.visualElements = [brandProfile.visualElements as unknown as string];
    }
    
    // Add timestamp
    brandProfile.timestamp = new Date().toISOString();
    
    console.log('Successfully extracted brand profile');
    return brandProfile;
  } catch (error) {
    console.error('Error extracting brand profile:', error);
    throw new Error(`Failed to extract brand profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save brand profile to Supabase for a specific user
 */
export async function saveBrandProfile(userId: string, profile: BrandProfile): Promise<void> {
  try {
    if (!userId) {
      throw new Error('User ID is required to save brand profile');
    }
    
    console.log(`Saving brand profile for user ${userId}`);
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Upsert brand profile for this user
    const { error } = await supabase
      .from('user_brand_profiles')
      .upsert({
        user_id: userId,
        profile: profile,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (error) {
      console.error('Error saving brand profile to Supabase:', error);
      throw error;
    }
    
    console.log(`Brand profile saved for user ${userId}`);
  } catch (error) {
    console.error('Error saving brand profile:', error);
    // Log error but don't throw to avoid breaking the user experience
    // We should still continue even if saving fails
  }
}

/**
 * Retrieve brand profile for a specific user
 */
export async function getBrandProfile(userId: string): Promise<BrandProfile | null> {
  try {
    if (!userId) {
      throw new Error('User ID is required to get brand profile');
    }
    
    console.log(`Retrieving brand profile for user ${userId}`);
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Get brand profile for this user
    const { data, error } = await supabase
      .from('user_brand_profiles')
      .select('profile')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found for this user
        console.log(`No brand profile found for user ${userId}`);
        return null;
      }
      console.error('Error retrieving brand profile from Supabase:', error);
      throw error;
    }
    
    if (!data || !data.profile) {
      console.log(`No brand profile found for user ${userId}`);
      return null;
    }
    
    console.log(`Brand profile retrieved for user ${userId}`);
    return data.profile as BrandProfile;
  } catch (error) {
    console.error('Error retrieving brand profile:', error);
    return null;
  }
} 
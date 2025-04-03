import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// Brand profile interface
export interface BrandProfile {
  brandStyle: string;
  colorPalette: string[];
  visualElements: string[];
  moodAndTone: string;
  targetAudience: string;
  industryCategory: string;
  timestamp: string;
}

// Don't initialize OpenAI on the client side
// This will be handled by the API routes

const BRAND_PROFILE_PROMPT = `Analyze this brand image and extract key brand elements in JSON format with these properties:
{
  "brandStyle": "string describing overall style and aesthetic",
  "colorPalette": ["array of hex color codes"],
  "visualElements": ["array of key visual elements and symbols"],
  "moodAndTone": "string describing mood and tone",
  "targetAudience": "string describing target audience",
  "industryCategory": "string describing industry category"
}`;

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
 * Extract brand profile from an image using API
 */
export async function extractBrandProfile(imageUrl: string): Promise<BrandProfile> {
  try {
    console.log('Extracting brand profile from:', imageUrl.substring(0, 50) + '...');
    
    // Safety check for valid image URL
    if (!imageUrl || (typeof imageUrl === 'string' && imageUrl.trim().length === 0)) {
      throw new Error('Invalid image URL provided');
    }
    
    // Process image URL to base64 if it's a blob URL
    let processedImageUrl = imageUrl;
    if (imageUrl.startsWith('blob:')) {
      console.log('Converting blob URL to base64 for API use');
      processedImageUrl = await blobUrlToBase64(imageUrl);
    }
    
    // Use the API route instead of direct OpenAI calls
    const response = await fetch('/api/analyze-brand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: processedImageUrl,
        prompt: BRAND_PROFILE_PROMPT
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to analyze brand: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    // Validate the extracted profile has required fields
    if (!result.brandStyle || !result.colorPalette || !result.moodAndTone) {
      console.warn('Incomplete brand profile extracted:', result);
      throw new Error('Incomplete brand profile extracted. Please try again with a clearer brand image.');
    }
    
    // Ensure colorPalette is an array
    if (!Array.isArray(result.colorPalette)) {
      result.colorPalette = [result.colorPalette as unknown as string];
    }
    
    // Ensure visualElements is an array
    if (!Array.isArray(result.visualElements)) {
      result.visualElements = [result.visualElements as unknown as string];
    }
    
    // Add timestamp
    const brandProfile = {
      ...result,
      timestamp: new Date().toISOString()
    };
    
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
    
    // Use API route to save the profile instead of direct Supabase call
    const response = await fetch('/api/save-brand-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        profile
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to save brand profile: ${response.status} ${errorText}`);
    }
    
    console.log(`Brand profile saved for user ${userId}`);
  } catch (error) {
    console.error('Error saving brand profile:', error);
    // Log error but don't throw to avoid breaking the user experience
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
    
    // Use API route to get the profile instead of direct Supabase call
    const response = await fetch(`/api/get-brand-profile?userId=${encodeURIComponent(userId)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No brand profile found for user ${userId}`);
        return null;
      }
      
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to retrieve brand profile: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
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
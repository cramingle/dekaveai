import { createClient } from '@/lib/supabase/client';
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

export async function extractBrandProfile(imageUrl: string) {
  try {
    console.log('Starting brand profile extraction for image URL:', imageUrl.substring(0, 30) + '...');
    
    // Convert URL to base64 data URL
    let processedImageUrl;
    try {
      processedImageUrl = await blobUrlToBase64(imageUrl);
    } catch (conversionError) {
      console.error('Error converting image:', conversionError);
      throw new Error(`Failed to process image: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
    }
    
    // Make API request to analyze brand
    console.log('Sending image for analysis...');
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
    console.log('Brand analysis complete');
    
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error extracting brand profile:', error);
    throw new Error(`Error analyzing brand profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function saveBrandProfile(userId: string, profile: BrandProfile): Promise<boolean> {
  try {
    // In free mode, save to localStorage instead of Supabase
    localStorage.setItem(`dekave_brand_profile_${userId}`, JSON.stringify({
      user_id: userId,
      profile_data: profile,
      updated_at: new Date().toISOString(),
    }));
    
    return true;
    
    /* Original Supabase code, commented out for free mode
    const supabase = createClient();
    const { error } = await supabase
      .from('brand_profiles')
      .upsert({
        user_id: userId,
        profile_data: profile,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
    */
  } catch (error) {
    console.error('Error saving brand profile:', error);
    return false;
  }
}

export async function getBrandProfile(userId: string): Promise<BrandProfile | null> {
  try {
    // In free mode, retrieve from localStorage instead of Supabase
    const savedProfile = localStorage.getItem(`dekave_brand_profile_${userId}`);
    if (savedProfile) {
      const data = JSON.parse(savedProfile);
      return data.profile_data || null;
    }
    return null;
    
    /* Original Supabase code, commented out for free mode
    const supabase = createClient();
    const { data, error } = await supabase
      .from('brand_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data?.profile_data || null;
    */
  } catch (error) {
    console.error('Error getting brand profile:', error);
    return null;
  }
} 
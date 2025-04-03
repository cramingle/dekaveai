
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
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String); // Keep the full data URL
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting blob to base64:', error);
    throw error;
  }
}

export async function extractBrandProfile(imageUrl: string) {
  try {
    // Convert blob URL to base64
    const base64Image = await blobUrlToBase64(imageUrl);
    
    const response = await fetch('/api/analyze-brand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: base64Image,
        prompt: BRAND_PROFILE_PROMPT
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze brand');
    }

    const result = await response.json();
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error extracting brand profile:', error);
    return null;
  }
}

export async function saveBrandProfile(userId: string, profile: BrandProfile): Promise<boolean> {
  try {
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
  } catch (error) {
    console.error('Error saving brand profile:', error);
    return false;
  }
}

export async function getBrandProfile(userId: string): Promise<BrandProfile | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('brand_profiles')
      .select('profile_data')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data?.profile_data || null;
  } catch (error) {
    console.error('Error getting brand profile:', error);
    return null;
  }
} 
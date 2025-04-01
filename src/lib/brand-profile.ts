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

const BRAND_PROFILE_PROMPT = `Analyze this brand image and extract key brand elements. Focus on:
1. Overall brand style and aesthetic
2. Color palette
3. Key visual elements and symbols
4. Mood and tone
5. Target audience indicators
6. Industry category

Provide the analysis in a structured JSON format.`;

export async function extractBrandProfile(imageUrl: string): Promise<BrandProfile | null> {
  try {
    const response = await fetch('/api/analyze-brand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl,
        prompt: BRAND_PROFILE_PROMPT,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze brand profile');
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
import { createClient } from '@supabase/supabase-js';

// User data type
export type UserData = {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  provider?: string;
  tokens: number;
  tier: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';
  created_at: string;
  tokens_expiry_date?: string;
  tokens_refreshed_at?: string;
  generation_count?: number;
  conversation_context?: string;
  conversation_last_used?: string;
};

// Check if we have Supabase environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Ensure we have Supabase credentials
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables are required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.');
}

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to get user data from Supabase
export async function getUserData(userId: string): Promise<UserData | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user data:', error);
    return null;
  }

  return data as UserData;
}

// Helper function to update user tokens
export async function updateUserTokens(userId: string, newTokenCount: number): Promise<boolean> {
  try {
    // In free mode, store tokens in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('dekave_temp_tokens', newTokenCount.toString());
      return true;
    }
    
    // Commented out Supabase implementation
    /*
    const { error } = await supabase
      .from('users')
      .update({ tokens: newTokenCount })
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating user tokens:', error);
      return false;
    }
    */
    
    return true;
  } catch (error) {
    console.error('Error updating user tokens:', error);
    return false;
  }
}

// Helper function to create a new user
export async function createUser(
  email: string, 
  ipAddress: string, 
  tier: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord' = 'Pioneer',
  initialTokens: number = 0
): Promise<{ userId: string | null; error: string | null }> {
  // Create the user
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      email,
      tokens: initialTokens,
      tier,
      created_at: new Date().toISOString(),
      tokens_refreshed_at: new Date().toISOString()
    });

  if (userError) {
    console.error('Error creating user:', userError);
    return { userId: null, error: 'Failed to create user account.' };
  }

  const userId = userData ? (userData as any).id : null;
  return { userId, error: null };
}

// Helper function to get user's IP address from request
export function getIPAddress(req: Request): string {
  // Try to get IP from various headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, get the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to a placeholder if we can't determine the IP
  return '0.0.0.0';
}

// Helper function to update user tokens with expiration date
export async function updateUserTokensWithExpiry(
  userId: string, 
  tokens: number, 
  expirationDate: string
): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ 
      tokens,
      tokens_expiry_date: expirationDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user tokens:', error);
    return false;
  }

  return true;
}

/**
 * Get user tokens
 */
export async function getUserTokens(userId: string): Promise<number> {
  try {
    // In free mode, get tokens from localStorage
    if (typeof window !== 'undefined') {
      const storedTokens = localStorage.getItem('dekave_temp_tokens');
      if (storedTokens) {
        return parseInt(storedTokens, 10);
      }
      return 100000; // Default token amount in free mode
    }
    
    // Commented out Supabase implementation
    /*
    const { data, error } = await supabase
      .from('users')
      .select('tokens')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error getting user tokens:', error);
      return 0;
    }
    
    return data?.tokens || 0;
    */
    
    return 100000; // Default token amount in free mode
  } catch (error) {
    console.error('Error getting user tokens:', error);
    return 100000; // Default token amount in free mode
  }
}

/**
 * Store user conversation context
 */
export async function storeConversationContext(userId: string, context: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        conversation_context: context,
        conversation_last_used: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (error) {
      console.error('Error storing conversation context:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error storing conversation context:', error);
    return false;
  }
}

/**
 * Get user conversation context
 */
export async function getUserConversation(userId: string): Promise<string | null> {
  try {
    // In free mode, use localStorage instead of Supabase
    if (typeof window !== 'undefined') {
      const storedConversation = localStorage.getItem(`dekave_conversation_${userId}`);
      if (storedConversation) {
        return storedConversation;
      }
    }
    
    // Commented out Supabase implementation
    /*
    const { data, error } = await supabase
      .from('users')
      .select('conversation_context')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error getting user conversation:', error);
      return null;
    }
    
    return data?.conversation_context || null;
    */
    
    return null;
  } catch (error) {
    console.error('Error getting user conversation:', error);
    return null;
  }
}

/**
 * Save user conversation context
 */
export async function saveUserConversation(userId: string, context: string): Promise<boolean> {
  try {
    // In free mode, use localStorage instead of Supabase
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dekave_conversation_${userId}`, context);
      localStorage.setItem(`dekave_conversation_lastused_${userId}`, new Date().toISOString());
      return true;
    }
    
    // Commented out Supabase implementation
    /*
    const { error } = await supabase
      .from('users')
      .update({ 
        conversation_context: context,
        conversation_last_used: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error saving user conversation:', error);
      return false;
    }
    */

    return true;
  } catch (error) {
    console.error('Error saving user conversation:', error);
    return false;
  }
}

/**
 * Increment user generation count
 */
export async function incrementUserGenerationCount(userId: string): Promise<boolean> {
  try {
    // First get current count
    const { data, error } = await supabase
      .from('users')
      .select('generation_count')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error getting user generation count:', error);
      return false;
    }
    
    const currentCount = data?.generation_count || 0;
    
    // Update with incremented count
    const { error: updateError } = await supabase
      .from('users')
      .update({ generation_count: currentCount + 1 })
      .eq('id', userId);
      
    if (updateError) {
      console.error('Error incrementing generation count:', updateError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error incrementing generation count:', error);
    return false;
  }
} 
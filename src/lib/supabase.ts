import { createClient } from '@supabase/supabase-js';

// User data type
export type UserData = {
  id: string;
  email: string;
  tokens: number;
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
  ipAddress?: string;
  createdAt: string;
  lastLogin: string;
};

// Check if we have Supabase environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Log warning if environment variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing. Using mock implementation. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

// Create a real or mock Supabase client based on available credentials
export let supabase: any;

// If no Supabase credentials, use a mock implementation for demo purposes
if (!supabaseUrl || !supabaseAnonKey) {
  // Mock Supabase client with in-memory storage
  const mockUsers: Record<string, UserData> = {
    'demo-user-123': {
      id: 'demo-user-123',
      email: 'demo@example.com',
      tokens: 3,
      tier: 'free',
      ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    }
  };

  // Mock IP tracking for free accounts
  const ipToUserMap: Record<string, string> = {
    '127.0.0.1': 'demo-user-123'
  };

  // Create a mock client with the same interface methods we use
  supabase = {
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: (field: string, value: string) => ({
              single: async () => {
                const user = mockUsers[value];
                return {
                  data: user || null,
                  error: user ? null : { message: 'User not found' }
                };
              }
            })
          }),
          update: (data: Partial<UserData>) => ({
            eq: (field: string, value: string) => {
              if (mockUsers[value]) {
                mockUsers[value] = { ...mockUsers[value], ...data };
                return { error: null };
              }
              return { error: { message: 'User not found' } };
            }
          }),
          insert: (data: Partial<UserData>) => {
            const id = `user-${Date.now()}`;
            mockUsers[id] = {
              id,
              email: data.email || '',
              tokens: data.tokens || 0,
              tier: data.tier || 'free',
              ipAddress: data.ipAddress,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString()
            };
            if (data.ipAddress) {
              ipToUserMap[data.ipAddress] = id;
            }
            return {
              data: { id },
              error: null
            };
          }
        };
      } else if (table === 'ip_tracking') {
        return {
          select: () => ({
            eq: (field: string, value: string) => ({
              single: async () => {
                const userId = ipToUserMap[value];
                return {
                  data: userId ? { ip: value, userId } : null,
                  error: null
                };
              }
            })
          }),
          insert: (data: { ip: string; userId: string }) => {
            ipToUserMap[data.ip] = data.userId;
            return {
              data: { id: Date.now() },
              error: null
            };
          }
        };
      }
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: () => ({ error: null }) }),
        insert: () => ({ error: null })
      };
    }
  };
  
  console.log('Using mock Supabase client for demo purposes');
} else {
  // Initialize the real Supabase client
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

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
export async function updateUserTokens(userId: string, tokens: number): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ tokens })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user tokens:', error);
    return false;
  }

  return true;
}

// Helper function to check if IP has a free account already
export async function checkIPHasFreeAccount(ipAddress: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ip_tracking')
    .select('userId')
    .eq('ip', ipAddress)
    .single();

  if (error) {
    // No record found, IP doesn't have a free account
    return false;
  }

  // If we have data, IP is already associated with an account
  return !!data;
}

// Helper function to create a new user with IP tracking
export async function createUser(
  email: string, 
  ipAddress: string, 
  tier: 'free' | 'basic' | 'pro' | 'enterprise' = 'free',
  initialTokens: number = tier === 'free' ? 3 : 10
): Promise<{ userId: string | null; error: string | null }> {
  // If it's a free tier registration, check if IP already has an account
  if (tier === 'free') {
    const hasAccount = await checkIPHasFreeAccount(ipAddress);
    if (hasAccount) {
      return { 
        userId: null, 
        error: 'This IP address already has a free account. Only one free account per IP is allowed.' 
      };
    }
  }

  // Create the user
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      email,
      tokens: initialTokens,
      tier,
      ipAddress,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    });

  if (userError) {
    console.error('Error creating user:', userError);
    return { userId: null, error: 'Failed to create user account.' };
  }

  const userId = userData?.id;

  // Track the IP for free tier users
  if (tier === 'free') {
    const { error: ipError } = await supabase
      .from('ip_tracking')
      .insert({
        ip: ipAddress,
        userId,
        createdAt: new Date().toISOString()
      });

    if (ipError) {
      console.error('Error tracking IP:', ipError);
      // We still created the user, so return success
    }
  }

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
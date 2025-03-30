'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode
} from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { supabase } from './supabase';
import { getConversationContext, storeConversationContext } from './supabase';
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { DefaultSession } from 'next-auth';

// Add interface for extended user
interface ExtendedUser {
  id?: string;
  tokens?: number;
  tier?: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';
  tokens_expiry_date?: string;
  hasStoredConversation?: boolean;
  conversationLastUsed?: string;
  hasLoggedInBefore: boolean;
  [key: string]: any; // For other properties
}

// Define NextAuth configuration
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      // Add user ID from token to session
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      
      // Populate the session with user data from Supabase
      if (session.user?.id) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (userData) {
            // Use type assertion to avoid TypeScript errors
            const extendedUser = session.user as ExtendedUser;
            extendedUser.tokens = userData.tokens || 0;
            extendedUser.tier = userData.tier || 'Pioneer';
            extendedUser.tokens_expiry_date = userData.tokens_expiry_date;
            extendedUser.hasLoggedInBefore = ((userData.tokens ?? 0) > 0 || !!userData.tokens_expiry_date);
            
            // Add conversation context info
            if (userData.conversation_last_used) {
              extendedUser.hasStoredConversation = true;
              extendedUser.conversationLastUsed = userData.conversation_last_used;
            } else {
              extendedUser.hasStoredConversation = false;
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
      
      return session;
    },
    async jwt({ token, user, account }) {
      // If new sign in, save user to Supabase
      if (account && user) {
        try {
          const { data, error } = await supabase
            .from('users')
            .upsert({
              id: user.id,
              email: user.email,
              provider: account.provider,
              created_at: new Date().toISOString(),
              tokens: 0, // No default tokens - users must purchase
              tier: 'Pioneer'
            }, {
              onConflict: 'id',
              ignoreDuplicates: false,
            });
          
          if (error) {
            console.error('Error saving user to Supabase:', error);
          }
        } catch (error) {
          console.error('Error in sign in flow:', error);
        }
      }
      return token;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Define the auth context types
type UserAuth = {
  isAuthenticated: boolean;
  user: any | null;
  tokens: number;
  tokensExpiryDate?: string;
  tier: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord'; // Specific tier values
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshTokenCount: () => Promise<void>;
  buyTokens: (packageId: string) => Promise<{ success: boolean; error?: string }>;
  tokensExpired: () => boolean;
};

// Create the auth context
const AuthContext = createContext<UserAuth | undefined>(undefined);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<any | null>(null);
  const [tokens, setTokens] = useState<number>(0);
  const [tokensExpiryDate, setTokensExpiryDate] = useState<string | undefined>(undefined);
  const [tier, setTier] = useState<string>('Pioneer');
  const isLoading = status === 'loading';

  // Update state when session changes
  useEffect(() => {
    if (session?.user) {
      setIsAuthenticated(true);
      setUser({
        ...session.user,
        hasLoggedInBefore: ((session.user.tokens ?? 0) > 0 || !!session.user.tokens_expiry_date)
      });
      setTokens(session.user.tokens || 0);
      setTokensExpiryDate(session.user.tokens_expiry_date);
      setTier(session.user.tier || 'Pioneer');
    } else {
      // Reset auth state if no session
      setIsAuthenticated(false);
      setUser(null);
      setTokens(0);
      setTokensExpiryDate(undefined);
      setTier('Pioneer');
    }
  }, [session]);

  // Function to sign in with Google
  const signInWithGoogle = async () => {
    await signIn('google', { callbackUrl: '/api/checkout' });
  };

  // Function to log out
  const logout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  // Function to refresh token count
  const refreshTokenCount = async () => {
    if (!session?.user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('tokens, tier, tokens_expiry_date')
        .eq('id', session.user.id)
        .single();
      
      if (!error && data) {
        setTokens(data.tokens);
        setTokensExpiryDate(data.tokens_expiry_date);
        setTier(data.tier);
      }
    } catch (error) {
      console.error('Error refreshing token count:', error);
    }
  };

  // Function to buy tokens
  const buyTokens = async (packageId: string) => {
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }
    
    try {
      // Token package definitions
      const tokenPackages = [
        { id: 'basic', tokens: 100000, tier: 'Pioneer' },
        { id: 'value', tokens: 250000, tier: 'Voyager' },
        { id: 'pro', tokens: 600000, tier: 'Dominator' },
        { id: 'max', tokens: 1000000, tier: 'Overlord' },
      ];
      
      // Handle token subtraction
      if (packageId.startsWith('subtract-')) {
        const amount = parseInt(packageId.replace('subtract-', '')) || 10000;
        const newTokenCount = Math.max(0, tokens - amount);
        
        const { error } = await supabase
          .from('users')
          .update({
            tokens: newTokenCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.user.id);
        
        if (error) throw error;
        
        // Update local state
        setTokens(newTokenCount);
        
        return { success: true };
      }
      
      const selectedPackage = tokenPackages.find(pkg => pkg.id === packageId);
      
      if (!selectedPackage) {
        return { success: false, error: 'Invalid package' };
      }
      
      // Create expiry date (28 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 28);
      
      // Here, you would integrate with a payment processor
      // For now, we'll just update the tokens directly
      
      const { error } = await supabase
        .from('users')
        .update({
          tokens: tokens + selectedPackage.tokens,
          tokens_expiry_date: expiryDate.toISOString(),
          tier: selectedPackage.tier,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);
      
      if (error) throw error;
      
      // Update local state
      setTokens(tokens + selectedPackage.tokens);
      setTokensExpiryDate(expiryDate.toISOString());
      setTier(selectedPackage.tier);
      
      return { success: true };
    } catch (error) {
      console.error('Error buying tokens:', error);
      return { success: false, error: 'Failed to purchase tokens' };
    }
  };

  const value = {
    isAuthenticated,
    user,
    tokens,
    tokensExpiryDate,
    tier: (tier as 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord'),
    isLoading,
    signInWithGoogle,
    logout,
    refreshTokenCount,
    buyTokens,
    tokensExpired: () => {
      if (!tokensExpiryDate) return false;
      const expiryDate = new Date(tokensExpiryDate);
      const now = new Date();
      return expiryDate < now;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export these functions for use in the conversation context management
export async function getUserConversation(userId: string) {
  try {
    return await getConversationContext(userId);
  } catch (error) {
    console.error('Error getting user conversation:', error);
    return null;
  }
}

export async function saveUserConversation(userId: string, contextData: string) {
  try {
    return await storeConversationContext(userId, contextData);
  } catch (error) {
    console.error('Error saving user conversation:', error);
    return false;
  }
} 
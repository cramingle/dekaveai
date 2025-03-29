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

// Define the auth context types
type UserAuth = {
  isAuthenticated: boolean;
  user: any | null;
  tokens: number;
  tokensExpiryDate?: string;
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  loginAsFreeTier: (email: string) => Promise<{ success: boolean; error?: string }>;
  loginAsPaidTier: (email: string) => Promise<{ success: boolean; error?: string }>;
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
  const [tier, setTier] = useState<'free' | 'basic' | 'pro' | 'enterprise'>('free');
  const isLoading = status === 'loading';

  // Update state when session changes
  useEffect(() => {
    if (session?.user) {
      setIsAuthenticated(true);
      setUser(session.user);
      setTokens(session.user.tokens || 0);
      setTokensExpiryDate(session.user.tokens_expiry_date);
      setTier(session.user.tier || 'free');
    } else {
      // Check for mock auth in development mode
      if (process.env.NODE_ENV === 'development') {
        const mockAuth = localStorage.getItem('mockAuth');
        const mockUserStr = localStorage.getItem('mockUser');
        
        if (mockAuth === 'true' && mockUserStr) {
          try {
            const mockUser = JSON.parse(mockUserStr);
            setIsAuthenticated(true);
            setUser(mockUser);
            setTokens(mockUser.tokens || 100000);
            setTokensExpiryDate(mockUser.tokens_expiry_date);
            setTier(mockUser.tier || 'free');
            return; // Skip the reset below
          } catch (e) {
            console.error('Error parsing mock user from localStorage', e);
          }
        }
      }
      
      // Reset auth state if no session and no mock auth
      setIsAuthenticated(false);
      setUser(null);
      setTokens(0);
      setTokensExpiryDate(undefined);
      setTier('free');
    }
  }, [session]);

  // Function to sign in with Google
  const signInWithGoogle = async () => {
    // Mock authentication for development without proper OAuth setup
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: Simulating Google sign-in');
      
      // Create expiry date (28 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 28);
      
      // Create a mock user
      const mockUser = {
        id: 'dev-user-123',
        name: 'Dev User',
        email: 'dev@example.com',
        image: null,
        tokens: 100000, // Free tier default (100k tokens)
        tokens_expiry_date: expiryDate.toISOString(),
        tier: 'free' as 'free' | 'basic' | 'pro' | 'enterprise'
      };
      
      // Update state
      setIsAuthenticated(true);
      setUser(mockUser);
      setTokens(mockUser.tokens);
      setTokensExpiryDate(mockUser.tokens_expiry_date);
      setTier(mockUser.tier);
      
      // Also store in localStorage for persistence
      localStorage.setItem('mockUser', JSON.stringify(mockUser));
      localStorage.setItem('mockAuth', 'true');
      
      return;
    }
    
    await signIn('google', { callbackUrl: '/' });
  };

  // Function to login as free tier
  const loginAsFreeTier = async (email: string) => {
    try {
      // Get client IP address for tracking
      const ip = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => 'unknown');
      
      // Check if IP already has a free account
      const { data: existingIP } = await supabase
        .from('ip_tracking')
        .select('user_id')
        .eq('ip', ip)
        .single();
      
      if (existingIP) {
        return { 
          success: false, 
          error: 'This IP already has a free account. Please sign in with Google instead.'
        };
      }
      
      // For now, sign in with email (we'll need to verify email flow later)
      // In production, use a secure email verification flow or OAuth
      await signIn('email', { email, callbackUrl: '/' });
      
      return { success: true };
    } catch (error) {
      console.error('Free tier login error:', error);
      return { success: false, error: 'Failed to create free account. Please try again.' };
    }
  };

  // Function to login as paid tier
  const loginAsPaidTier = async (email: string) => {
    try {
      // For now, this is a placeholder for payment flow
      // In production, redirect to a payment processor
      await signIn('email', { email, callbackUrl: '/' });
      
      // In a real implementation, after payment confirmation:
      // 1. Update the user's tier to 'basic'
      // 2. Add 10 tokens to their account
      
      return { success: true };
    } catch (error) {
      console.error('Paid tier login error:', error);
      return { success: false, error: 'Payment failed. Please try again.' };
    }
  };

  // Function to log out
  const logout = async () => {
    // Handle mock logout in development
    if (process.env.NODE_ENV === 'development') {
      localStorage.removeItem('mockAuth');
      localStorage.removeItem('mockUser');
      
      // Reset state
      setIsAuthenticated(false);
      setUser(null);
      setTokens(0);
      setTokensExpiryDate(undefined);
      setTier('free');
      
      // Reload page to refresh UI
      window.location.href = '/';
      return;
    }
    
    await signOut({ callbackUrl: '/' });
  };

  // Function to refresh token count
  const refreshTokenCount = async () => {
    // Mock refresh token in development mode
    if (process.env.NODE_ENV === 'development' && !session?.user?.id) {
      console.log('Development mode: Simulating token refresh');
      
      // Try to get tokens from localStorage
      try {
        const mockUserStr = localStorage.getItem('mockUser');
        if (mockUserStr) {
          const mockUser = JSON.parse(mockUserStr);
          console.log('Retrieved tokens from localStorage:', mockUser.tokens);
          setTokens(mockUser.tokens || 0);
          setTokensExpiryDate(mockUser.tokens_expiry_date);
          setTier(mockUser.tier || 'free');
          return;
        }
      } catch (e) {
        console.error('Error getting token count from localStorage', e);
      }
      
      // Fallback - set default values
      const isFreeTier = user?.email?.includes('free') || tier === 'free';
      const newTokens = isFreeTier ? 3 : 10;
      setTokens(newTokens);
      
      return;
    }
    
    if (!session?.user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('tokens, tier')
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
    // Handle development mode
    if (process.env.NODE_ENV === 'development' && (!session?.user?.id || packageId.startsWith('subtract-'))) {
      console.log('Development mode: Simulating token purchase/subtraction');
      
      // Parse token subtraction command
      if (packageId.startsWith('subtract-')) {
        const amount = parseInt(packageId.replace('subtract-', '')) || 10000;
        console.log(`Subtracting ${amount} tokens from current ${tokens}. New count: ${Math.max(0, tokens - amount)}`);
        
        // Update the state immediately
        const newTokenCount = Math.max(0, tokens - amount);
        setTokens(newTokenCount);
        
        // Also update in localStorage for persistence
        if (localStorage.getItem('mockAuth') === 'true') {
          try {
            const mockUserStr = localStorage.getItem('mockUser');
            if (mockUserStr) {
              const mockUser = JSON.parse(mockUserStr);
              mockUser.tokens = newTokenCount;
              localStorage.setItem('mockUser', JSON.stringify(mockUser));
              console.log('Updated mockUser in localStorage:', mockUser);
            }
          } catch (e) {
            console.error('Error updating mock user in localStorage', e);
          }
        }
        
        return { success: true };
      }
      
      // Token package definitions
      const tokenPackages = [
        { id: 'basic', tokens: 100000, tier: 'basic' as const },
        { id: 'value', tokens: 250000, tier: 'basic' as const },
        { id: 'pro', tokens: 600000, tier: 'pro' as const },
        { id: 'max', tokens: 1000000, tier: 'enterprise' as const },
      ];
      
      const selectedPackage = tokenPackages.find(pkg => pkg.id === packageId);
      
      if (selectedPackage) {
        // Create expiry date (28 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 28);
        
        setTokens(tokens + selectedPackage.tokens);
        setTokensExpiryDate(expiryDate.toISOString());
        setTier(selectedPackage.tier);
        
        // Update mockUser in localStorage
        if (localStorage.getItem('mockAuth') === 'true') {
          try {
            const mockUserStr = localStorage.getItem('mockUser');
            if (mockUserStr) {
              const mockUser = JSON.parse(mockUserStr);
              mockUser.tokens = tokens + selectedPackage.tokens;
              mockUser.tokens_expiry_date = expiryDate.toISOString();
              mockUser.tier = selectedPackage.tier;
              localStorage.setItem('mockUser', JSON.stringify(mockUser));
            }
          } catch (e) {
            console.error('Error updating mock user in localStorage', e);
          }
        }
        
        return { success: true };
      }
      
      // Default behavior - add 100,000 tokens
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 28);
      setTokens(tokens + 100000);
      setTokensExpiryDate(expiryDate.toISOString());
      
      // Update mockUser in localStorage
      if (localStorage.getItem('mockAuth') === 'true') {
        try {
          const mockUserStr = localStorage.getItem('mockUser');
          if (mockUserStr) {
            const mockUser = JSON.parse(mockUserStr);
            mockUser.tokens = tokens + 100000;
            mockUser.tokens_expiry_date = expiryDate.toISOString();
            localStorage.setItem('mockUser', JSON.stringify(mockUser));
          }
        } catch (e) {
          console.error('Error updating mock user in localStorage', e);
        }
      }
      
      return { success: true };
    }
    
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }
    
    try {
      // Token package definitions
      const tokenPackages = [
        { id: 'basic', tokens: 100000, tier: 'basic' as const },
        { id: 'value', tokens: 250000, tier: 'basic' as const },
        { id: 'pro', tokens: 600000, tier: 'pro' as const },
        { id: 'max', tokens: 1000000, tier: 'enterprise' as const },
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
    tier,
    isLoading,
    signInWithGoogle,
    loginAsFreeTier,
    loginAsPaidTier,
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
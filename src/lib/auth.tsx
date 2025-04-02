'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { trackEvent, EventType } from '@/lib/analytics';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Add interface for extended user
interface ExtendedUser {
  id: string;
  email: string;
  tokens?: number;
  tier?: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';
  tokens_expiry_date?: string;
  hasStoredConversation?: boolean;
  conversationLastUsed?: string;
  hasLoggedInBefore: boolean;
  token?: string;
  stripeCustomerId?: string;
}

// Define the auth context types
type UserAuth = {
  isAuthenticated: boolean;
  user: ExtendedUser | null;
  tokens: number;
  tokensExpiryDate?: string;
  tier: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';
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
  const supabase = createClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [tokens, setTokens] = useState<number>(0);
  const [tokensExpiryDate, setTokensExpiryDate] = useState<string | undefined>(undefined);
  const [tier, setTier] = useState<'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord'>('Pioneer');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Get user data from database
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (userData) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              tokens: userData.tokens || 0,
              tier: userData.tier || 'Pioneer',
              tokens_expiry_date: userData.tokens_expiry_date,
              hasLoggedInBefore: ((userData.tokens ?? 0) > 0 || !!userData.tokens_expiry_date),
              hasStoredConversation: !!userData.conversation_last_used,
              conversationLastUsed: userData.conversation_last_used,
              token: session.access_token,
              stripeCustomerId: userData.stripe_customer_id
            });
            setTokens(userData.tokens || 0);
            setTokensExpiryDate(userData.tokens_expiry_date);
            setTier(userData.tier || 'Pioneer');
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Get user data from database
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (userData) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              tokens: userData.tokens || 0,
              tier: userData.tier || 'Pioneer',
              tokens_expiry_date: userData.tokens_expiry_date,
              hasLoggedInBefore: ((userData.tokens ?? 0) > 0 || !!userData.tokens_expiry_date),
              hasStoredConversation: !!userData.conversation_last_used,
              conversationLastUsed: userData.conversation_last_used,
              token: session.access_token,
              stripeCustomerId: userData.stripe_customer_id
            });
            setTokens(userData.tokens || 0);
            setTokensExpiryDate(userData.tokens_expiry_date);
            setTier(userData.tier || 'Pioneer');
            setIsAuthenticated(true);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setTokens(0);
          setTokensExpiryDate(undefined);
          setTier('Pioneer');
          setIsAuthenticated(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Function to sign in with Google
  const signInWithGoogle = async () => {
    try {
      // Track sign in attempt
      trackEvent(EventType.SIGN_IN, {
        method: 'google',
        timestamp: new Date().toISOString()
      });
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  // Function to log out
  const logout = async () => {
    try {
      // Track logout
      trackEvent(EventType.SIGN_IN, {
        action: 'logout',
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Function to refresh token count
  const refreshTokenCount = async () => {
    if (!user?.id) return;
    
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tokens, tier, tokens_expiry_date')
        .eq('id', user.id)
        .single();

      if (userData) {
        setTokens(userData.tokens || 0);
        setTier(userData.tier || 'Pioneer');
        setTokensExpiryDate(userData.tokens_expiry_date);
        setUser(prev => prev ? {
          ...prev,
          tokens: userData.tokens || 0,
          tier: userData.tier || 'Pioneer',
          tokens_expiry_date: userData.tokens_expiry_date
        } : null);
      }
    } catch (error) {
      console.error('Error refreshing token count:', error);
    }
  };

  // Function to buy tokens
  const buyTokens = async (packageId: string) => {
    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch('/api/create-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          packageId,
          email: user.email,
          userId: user.id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment link');
      }

      // Redirect to payment URL
      window.location.href = data.url;
      return { success: true };
    } catch (error) {
      console.error('Error buying tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      };
    }
  };

  // Function to check if tokens are expired
  const tokensExpired = () => {
    if (!tokensExpiryDate) return false;
    return new Date(tokensExpiryDate) < new Date();
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      tokens,
      tokensExpiryDate,
      tier,
      isLoading,
      signInWithGoogle,
      logout,
      refreshTokenCount,
      buyTokens,
      tokensExpired
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
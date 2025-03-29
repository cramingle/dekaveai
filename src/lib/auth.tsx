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
  tier: string; // Simplified - tier is just a descriptive string, not functional
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
      setUser(session.user);
      setTokens(session.user.tokens || 0);
      setTokensExpiryDate(session.user.tokens_expiry_date);
      setTier(session.user.tier || 'Pioneer');
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
            setTier(mockUser.tier || 'Pioneer');
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
      setTier('Pioneer');
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
        tokens: 100000, // Default 100k tokens
        tokens_expiry_date: expiryDate.toISOString(),
        tier: 'Pioneer'
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
      setTier('Pioneer');
      
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
          setTier(mockUser.tier || 'Pioneer');
          return;
        }
      } catch (e) {
        console.error('Error getting token count from localStorage', e);
      }
      
      // Fallback - set default values
      const newTokens = 0; // Default no tokens
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
        { id: 'basic', tokens: 100000, tier: 'Pioneer' },
        { id: 'value', tokens: 250000, tier: 'Voyager' },
        { id: 'pro', tokens: 600000, tier: 'Dominator' },
        { id: 'max', tokens: 1000000, tier: 'Overlord' },
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
    tier,
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
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

  // Add this before the useEffect in AuthProvider
  const logAuthState = (message: string) => {
    console.log(`AUTH_DEBUG: ${message}`, {
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
      tokens,
      isLoading,
      time: new Date().toISOString()
    });
  };

  // Function to safely dispatch state restoration event
  const dispatchStateRestorationEvent = (state: any) => {
    try {
      if (!state || Object.keys(state).length === 0) {
        console.warn('Attempted to dispatch state restoration with empty state');
        return;
      }
      
      console.log('Dispatching state restoration event with state:', state);
      
      // Create a stable copy of the state - prevent reference issues
      const stableCopy = JSON.parse(JSON.stringify(state));
      
      // Ensure certain critical fields are set
      if (stableCopy.chatHistory === undefined) stableCopy.chatHistory = [];
      if (stableCopy.uploadedImages === undefined) stableCopy.uploadedImages = [];
      if (stableCopy.chatStarted === undefined) stableCopy.chatStarted = !!stableCopy.uploadedImages.length;
      
      // Dispatch the event after a slight delay to ensure React has settled
      setTimeout(() => {
        try {
          const event = new CustomEvent('restoreState', { 
            detail: stableCopy,
            bubbles: true, 
            cancelable: true 
          });
          
          window.dispatchEvent(event);
          console.log('State restoration event dispatched successfully');
          
          // Clean up the saved state to prevent duplicate restoration
          setTimeout(() => {
            try {
              sessionStorage.removeItem('userState');
              console.log('Cleaned up sessionStorage after state restoration');
            } catch (err) {
              console.error('Error cleaning sessionStorage:', err);
            }
          }, 1000);
        } catch (error) {
          console.error('Error dispatching state restoration event:', error);
        }
      }, 250); // Increased delay to ensure components are fully rendered
    } catch (error) {
      console.error('Failed to create state restoration event:', error);
    }
  };

  // Add this at the beginning of the auth component
  const cleanUrlAfterAuth = () => {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const hasCode = url.searchParams.has('code');
        
        if (hasCode) {
          console.log('Cleaning URL after authentication');
          url.searchParams.delete('code');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (error) {
        console.error('Error cleaning URL:', error);
      }
    }
  };

  // Add this at the top of the component, before initAuth
  useEffect(() => {
    // Initialize auth state
    let isMounted = true;
    let authStateChanged = false;
    
    // Clean the URL immediately when component mounts to avoid issues with reprocessing
    cleanUrlAfterAuth();
    
    // Safety timeout to ensure loading state isn't stuck
    const safetyTimeout = setTimeout(() => {
      if (isMounted && isLoading && !authStateChanged) {
        console.warn('Safety timeout triggered - forcing isLoading to false');
        setIsLoading(false);
      }
    }, 10000); // 10 seconds maximum loading time

    console.log('Setting up auth state listener');

    // Set up auth change handler BEFORE initializing the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        authStateChanged = true;

        // Important: Process the auth state immediately
        try {
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            console.log('User session detected:', session?.user?.id);
            logAuthState('User session detected');
            
            if (session?.user && isMounted) {
              // Get user data from database
              const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (error) {
                console.error('Error fetching user data:', error);
                // Handle creating a new user here if needed
                try {
                  if (!isMounted) return;
                  
                  console.log('Creating new user for:', session.user.id);
                  const { error: insertError } = await supabase
                    .from('users')
                    .insert({
                      id: session.user.id,
                      email: session.user.email,
                      tokens: 0,
                      tier: 'Pioneer',
                      created_at: new Date().toISOString()
                    });
                    
                  if (insertError) {
                    console.error('Error creating user data:', insertError);
                    if (isMounted) setIsLoading(false);
                  } else {
                    // Set default user state
                    setUser({
                      id: session.user.id,
                      email: session.user.email!,
                      tokens: 0,
                      tier: 'Pioneer' as 'Pioneer',
                      hasLoggedInBefore: false,
                      token: session.access_token,
                    });
                    setTokens(0);
                    setTier('Pioneer');
                    setIsAuthenticated(true);
                    
                    // Store in localStorage
                    localStorage.setItem('dekave_user', JSON.stringify({
                      id: session.user.id,
                      email: session.user.email,
                      isAuthenticated: true
                    }));

                    console.log('Setting authenticated state with new user');
                    logAuthState('Setting authenticated with new user');
                    
                    // MUST set isLoading to false here
                    if (isMounted) setIsLoading(false);
                    
                    // Notify components
                    notifyAuthStateChanged();
                  }
                } catch (createError) {
                  console.error('Error in user creation:', createError);
                  if (isMounted) setIsLoading(false);
                }
              } else {
                // We have existing user data
                if (userData && isMounted) {
                  console.log('Setting user state with existing user data');
                  logAuthState('Before setting authenticated with existing user');
                  
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
                  
                  // Store in localStorage
                  localStorage.setItem('dekave_user', JSON.stringify({
                    id: session.user.id,
                    email: session.user.email,
                    isAuthenticated: true
                  }));
                  
                  console.log('Set authenticated state to true');
                  logAuthState('After setting authenticated with existing user');
                  
                  // MUST set isLoading to false here
                  if (isMounted) setIsLoading(false);
                  
                  // Restore saved state if exists
                  const savedState = sessionStorage.getItem('userState');
                  if (savedState) {
                    try {
                      console.log('Found saved state to restore');
                      const state = JSON.parse(savedState);
                      // Use a simple timeout for restoration
                      setTimeout(() => {
                        if (isMounted) dispatchStateRestorationEvent(state);
                      }, 250);
                    } catch (error) {
                      console.error('Error parsing saved state:', error);
                    }
                  }
                  
                  notifyAuthStateChanged();
                }
              }
            }
          } else if (event === 'SIGNED_OUT' && isMounted) {
            console.log('User signed out');
            logAuthState('Before signing out user');
            setUser(null);
            setTokens(0);
            setTokensExpiryDate(undefined);
            setTier('Pioneer');
            setIsAuthenticated(false);
            setIsLoading(false);
            
            // Clear user from localStorage
            localStorage.removeItem('dekave_user');
            
            notifyAuthStateChanged();
            logAuthState('After signing out user');
          } else if (isMounted) {
            // Any other event, we should ensure isLoading is updated
            console.log('Other auth event, setting isLoading false');
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error handling auth state change:', error);
          if (isMounted) setIsLoading(false);
        }
      }
    );

    // After setting up the listener, check for a session immediately
    const checkSession = async () => {
      logAuthState('Initial auth state check');
      try {
        // Check if we have a code in the URL
        const params = new URLSearchParams(window.location.search);
        const hasAuthCode = params.has('code');
        logAuthState('Checking for auth code');
        
        if (hasAuthCode) {
          // We have a code - we need to handle this explicitly
          console.log('Found auth code in URL, exchanging for session');
          logAuthState('Found auth code in URL');
          if (isMounted) setIsLoading(true);
          
          const code = params.get('code');
          if (code) {
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              
              if (error) {
                console.error('Error exchanging code for session:', error);
                if (isMounted) setIsLoading(false);
              } else {
                console.log('Code exchange successful, session received');
                logAuthState('Code exchange successful');
                
                // Ensure URL is cleaned
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('code');
                  window.history.replaceState({}, '', url.toString());
                } catch (urlError) {
                  console.error('Error cleaning URL:', urlError);
                }
                
                // After ensuring the URL is cleaned, check for saved state
                const savedState = sessionStorage.getItem('userState');
                if (savedState) {
                  console.log('Found saved state to restore after code exchange');
                  try {
                    sessionStorage.setItem('userState_backup', savedState);
                  } catch (e) {
                    console.error('Error creating backup of saved state:', e);
                  }
                }
                
                // The onAuthStateChange listener will handle the rest
                console.log('Waiting for auth state change event after code exchange');
              }
            } catch (codeError) {
              console.error('Error during code exchange:', codeError);
              if (isMounted) setIsLoading(false);
            }
          }
        } else {
          // No code in URL, just check for an existing session
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.log('No active session found');
            if (isMounted) setIsLoading(false);
          } else {
            console.log('Session exists, waiting for INITIAL_SESSION event...');
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        if (isMounted) setIsLoading(false);
      }
    };
    
    checkSession();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
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
      
      // Get the current URL to use as redirect
      const currentUrl = window.location.href;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: currentUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
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

  // Add this helper function to notify about auth state changes
  const notifyAuthStateChanged = () => {
    try {
      console.log('Notifying components about auth state change');
      window.dispatchEvent(new CustomEvent('authStateChanged'));
    } catch (error) {
      console.error('Error dispatching auth state change event:', error);
    }
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
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

  // Initialize auth state
  useEffect(() => {
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
    
    const initAuth = async () => {
      try {
        // Check if we have a code in the URL
        const params = new URLSearchParams(window.location.search);
        const hasAuthCode = params.has('code');

        // Keep loading state true while processing auth code
        if (hasAuthCode) {
          if (isMounted) setIsLoading(true);
          
          // Get the code from the URL
          const code = params.get('code');
          
          // Exchange the code for a session
          if (code) {
            console.log('Exchanging auth code for session');
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Error exchanging code for session:', error);
              if (isMounted) setIsLoading(false);
              return;
            }
            
            console.log('Session established successfully:', !!data.session);
            authStateChanged = true;
            
            // Clean up the URL to prevent reprocessing on page refresh
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete('code');
              window.history.replaceState({}, '', url.toString());
            } catch (urlError) {
              console.error('Error cleaning up URL:', urlError);
            }
            
            // Immediately set authenticated state if we have a session
            if (data.session && isMounted) {
              console.log('Setting initial authenticated state from code exchange');
              setIsAuthenticated(true);
              
              // Get user data from database
              const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.session.user.id)
                .single();
                
              if (userData && isMounted) {
                setUser({
                  id: data.session.user.id,
                  email: data.session.user.email!,
                  tokens: userData.tokens || 0,
                  tier: userData.tier || 'Pioneer',
                  tokens_expiry_date: userData.tokens_expiry_date,
                  hasLoggedInBefore: ((userData.tokens ?? 0) > 0 || !!userData.tokens_expiry_date),
                  hasStoredConversation: !!userData.conversation_last_used,
                  conversationLastUsed: userData.conversation_last_used,
                  token: data.session.access_token,
                  stripeCustomerId: userData.stripe_customer_id
                });
                setTokens(userData.tokens || 0);
                setTokensExpiryDate(userData.tokens_expiry_date);
                setTier(userData.tier || 'Pioneer');
                
                // Critical: Ensure loading state is set to false after auth code exchange
                setIsLoading(false);
                
                // Store user in localStorage to help with persistence
                localStorage.setItem('dekave_user', JSON.stringify({
                  id: data.session.user.id,
                  email: data.session.user.email,
                  isAuthenticated: true
                }));
                
                // Notify components about auth state change
                notifyAuthStateChanged();
                
                // If we had an auth code, restore saved state
                if (hasAuthCode) {
                  const savedState = sessionStorage.getItem('userState');
                  
                  if (savedState) {
                    try {
                      const state = JSON.parse(savedState);
                      
                      // Use a simpler approach to dispatch state restoration
                      setTimeout(() => {
                        if (isMounted) dispatchStateRestorationEvent(state);
                      }, 250);
                    } catch (error) {
                      console.error('Error parsing saved state after redirect:', error);
                    }
                  }
                }
              } else if (isMounted) {
                // Create user if not found
                try {
                  console.log('Creating new user during code exchange for:', data.session.user.id);
                  await supabase
                    .from('users')
                    .insert({
                      id: data.session.user.id,
                      email: data.session.user.email,
                      tokens: 0,
                      tier: 'Pioneer',
                      created_at: new Date().toISOString()
                    });
                  
                  // Set default user state
                  setUser({
                    id: data.session.user.id,
                    email: data.session.user.email!,
                    tokens: 0,
                    tier: 'Pioneer' as 'Pioneer',
                    hasLoggedInBefore: false,
                    token: data.session.access_token,
                  });
                  setTokens(0);
                  setTier('Pioneer');
                  setIsAuthenticated(true);
                  
                  // Store user in localStorage to help with persistence
                  localStorage.setItem('dekave_user', JSON.stringify({
                    id: data.session.user.id,
                    email: data.session.user.email,
                    isAuthenticated: true
                  }));
                  
                  // Notify components about auth state change
                  notifyAuthStateChanged();
                  
                  // Critical: Ensure loading state is set to false after creating new user
                  setIsLoading(false);
                } catch (createError) {
                  console.error('Error creating user during code exchange:', createError);
                  // Ensure loading state is false even on error
                  if (isMounted) setIsLoading(false);
                }
              }
            } else {
              // No session from code exchange
              if (isMounted) setIsLoading(false);
            }
          } else {
            // No code parameter
            if (isMounted) setIsLoading(false);
          }
        }

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && isMounted) {
          // Set flag to indicate auth state has changed
          authStateChanged = true;
          
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
            
            // Store user in localStorage to help with persistence
            localStorage.setItem('dekave_user', JSON.stringify({
              id: session.user.id,
              email: session.user.email,
              isAuthenticated: true
            }));
            
            // Notify components about auth state change
            notifyAuthStateChanged();
          }
        } else {
          // If we have cached user data in localStorage but no session, try to recover
          try {
            const cachedUser = localStorage.getItem('dekave_user');
            if (cachedUser && !isAuthenticated) {
              const parsedUser = JSON.parse(cachedUser);
              // If we have cached data but no session, we need to clear it
              localStorage.removeItem('dekave_user');
            }
          } catch (e) {
            console.error('Error checking cached user:', e);
          }
        }
        
        // Ensure loading state is set to false after all auth checks
        if (isMounted) setIsLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Ensure loading state is set to false even on error
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event);
        
        // Mark that auth state has changed to prevent safety timeout from triggering
        authStateChanged = true;
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in:', session.user.id);
          
          try {
            // Only process if component is still mounted
            if (!isMounted) return;
            
            // Get user data from database
            const { data: userData, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (error) {
              console.error('Error fetching user data after sign in:', error);
              
              // Create user entry if not found
              try {
                if (!isMounted) return;
                
                console.log('Creating new user data for:', session.user.id);
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
                } else if (isMounted) {
                  // Set user state with default values
                  const userState = {
                    id: session.user.id,
                    email: session.user.email!,
                    tokens: 0,
                    tier: 'Pioneer' as 'Pioneer',
                    hasLoggedInBefore: false,
                    token: session.access_token,
                  };
                  
                  setUser(userState);
                  setTokens(0);
                  setTier('Pioneer');
                  setIsAuthenticated(true);
                  setIsLoading(false);
                  
                  // Store user in localStorage to help with persistence
                  localStorage.setItem('dekave_user', JSON.stringify({
                    id: session.user.id,
                    email: session.user.email,
                    isAuthenticated: true
                  }));
                  
                  // Notify components about auth state change
                  notifyAuthStateChanged();
                  
                  // Restore saved state if exists
                  const savedState = sessionStorage.getItem('userState');
                  if (savedState) {
                    try {
                      const state = JSON.parse(savedState);
                      setTimeout(() => {
                        if (isMounted) dispatchStateRestorationEvent(state);
                      }, 250);
                    } catch (error) {
                      console.error('Error parsing saved state:', error);
                    }
                  }
                }
              } catch (createError) {
                console.error('Error in user creation process:', createError);
                if (isMounted) setIsLoading(false);
              }
              
              return;
            }

            // If user data was found in the database and component still mounted
            if (userData && isMounted) {
              const userState = {
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
              };
              
              setUser(userState);
              setTokens(userData.tokens || 0);
              setTokensExpiryDate(userData.tokens_expiry_date);
              setTier(userData.tier || 'Pioneer');
              setIsAuthenticated(true);
              setIsLoading(false);
              
              // Store user in localStorage to help with persistence
              localStorage.setItem('dekave_user', JSON.stringify({
                id: session.user.id,
                email: session.user.email,
                isAuthenticated: true
              }));
              
              // Notify components about auth state change
              notifyAuthStateChanged();
              
              // Restore saved state if exists
              const savedState = sessionStorage.getItem('userState');
              if (savedState) {
                try {
                  const state = JSON.parse(savedState);
                  setTimeout(() => {
                    if (isMounted) dispatchStateRestorationEvent(state);
                  }, 250);
                } catch (error) {
                  console.error('Error parsing saved state:', error);
                }
              }
            }
          } catch (error) {
            console.error('Error in onAuthStateChange handler:', error);
            if (isMounted) setIsLoading(false);
          }
        } else if (event === 'SIGNED_OUT' && isMounted) {
          setUser(null);
          setTokens(0);
          setTokensExpiryDate(undefined);
          setTier('Pioneer');
          setIsAuthenticated(false);
          setIsLoading(false);
          
          // Clear user from localStorage
          localStorage.removeItem('dekave_user');
          
          // Notify components about auth state change
          notifyAuthStateChanged();
        }
      }
    );

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
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode
} from 'react';
// import { createClient } from '@/lib/supabase/client';
import { trackEvent, EventType } from '@/lib/analytics';

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

// Function to generate a unique identifier
const generateUniqueId = () => {
  return 'user_' + Math.random().toString(36).substring(2, 15);
};

// Function to check if tokens should be refreshed
const shouldRefreshTokens = (lastRefresh: string) => {
  if (!lastRefresh) return true;
  
  const lastRefreshDate = new Date(lastRefresh);
  const now = new Date();
  
  // Check if it's a new day (different day, month, or year)
  return lastRefreshDate.getDate() !== now.getDate() ||
         lastRefreshDate.getMonth() !== now.getMonth() ||
         lastRefreshDate.getFullYear() !== now.getFullYear();
};

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  // const supabase = createClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true); // Always authenticated
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [tokens, setTokens] = useState<number>(100000); // Start with 100,000 tokens
  const [tokensExpiryDate, setTokensExpiryDate] = useState<string | undefined>(undefined);
  const [tier, setTier] = useState<'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord'>('Overlord'); // Everyone gets top tier
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

  // Initialize the temporary user on first load
  useEffect(() => {
    let isMounted = true;
    console.log('Setting up temporary user system');
    
    const initializeTemporaryUser = () => {
      try {
        // Check localStorage for existing user
        const storedUser = localStorage.getItem('dekave_temp_user');
        let userId, lastTokenRefresh;
        
        if (storedUser) {
          // Use existing user
          const parsedUser = JSON.parse(storedUser);
          userId = parsedUser.id;
          lastTokenRefresh = parsedUser.lastTokenRefresh;
          console.log('Found existing temporary user:', userId);
          
          // Check if tokens should be refreshed
          if (shouldRefreshTokens(lastTokenRefresh)) {
            console.log('Refreshing tokens for temporary user');
            lastTokenRefresh = new Date().toISOString();
            localStorage.setItem('dekave_temp_user', JSON.stringify({
              id: userId,
              lastTokenRefresh,
            }));
            
            // Reset tokens to maximum
            setTokens(100000);
          } else {
            // Get saved token count if available
            const savedTokens = localStorage.getItem('dekave_temp_tokens');
            if (savedTokens) {
              setTokens(parseInt(savedTokens, 10));
            }
          }
        } else {
          // Generate new user
          userId = generateUniqueId();
          lastTokenRefresh = new Date().toISOString();
          console.log('Created new temporary user:', userId);
          
          // Store in localStorage
          localStorage.setItem('dekave_temp_user', JSON.stringify({
            id: userId,
            lastTokenRefresh,
          }));
          
          // Default tokens
          setTokens(100000);
        }
        
        // Set the user state
        const temporaryUser: ExtendedUser = {
          id: userId,
          email: 'temporary@user.com',
          tokens: 100000,
          tier: 'Overlord',
          hasLoggedInBefore: true,
          tokens_expiry_date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
        };
        
        if (isMounted) {
          setUser(temporaryUser);
          setIsAuthenticated(true);
          setTier('Overlord');
          setTokensExpiryDate(temporaryUser.tokens_expiry_date);
          setIsLoading(false);
          
          // Restore saved state if exists
          const savedState = sessionStorage.getItem('userState');
          if (savedState) {
            try {
              console.log('Found saved state to restore');
              dispatchStateRestorationEvent(JSON.parse(savedState));
            } catch (error) {
              console.error('Error parsing saved state:', error);
            }
          }
          
          // Notify components
          notifyAuthStateChanged();
        }
      } catch (error) {
        console.error('Error initializing temporary user:', error);
        if (isMounted) setIsLoading(false);
      }
    };
    
    // Initialize immediately
    initializeTemporaryUser();
    
    // Set up a daily check for token refresh
    const checkInterval = setInterval(() => {
      const storedUser = localStorage.getItem('dekave_temp_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (shouldRefreshTokens(parsedUser.lastTokenRefresh)) {
          console.log('Daily token refresh triggered');
          initializeTemporaryUser();
        }
      }
    }, 3600000); // Check every hour
    
    return () => {
      isMounted = false;
      clearInterval(checkInterval);
    };
  }, []);

/* COMMENTED OUT ORIGINAL AUTH CODE
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

    // Add this function inside the useEffect where isMounted is defined
    const forceCheckSession = async () => {
      try {
        console.log('Directly checking for an active session');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          return null;
        }
        
        if (data.session) {
          console.log('Active session found for user:', data.session.user.id);
          return data.session;
        } else {
          console.log('No active session found in direct check');
          return null;
        }
      } catch (e) {
        console.error('Exception during session check:', e);
        return null;
      }
    };

    console.log('Setting up auth state listener');

    // Set up auth change handler BEFORE initializing the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'Session:', session ? `${session.user.id} (${session.user.email})` : 'null');
        authStateChanged = true;

        // Important: Process the auth state immediately
        try {
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            // Check if session is null or user is undefined
            if (!session || !session.user) {
              console.warn('Auth event received but session or user is null:', event);
              logAuthState('Auth event with null session');
              
              // Try to get the session directly as a fallback
              const fallbackSession = await forceCheckSession();
              if (fallbackSession && fallbackSession.user) {
                console.log('Retrieved session through fallback:', fallbackSession.user.id);
                session = fallbackSession; // Use the fallback session
              } else {
                console.log('No session available even with fallback');
                if (isMounted) setIsLoading(false);
                return;
              }
            }
            
            console.log('User session detected:', session.user.id);
            logAuthState('User session detected');
            
            if (session.user && isMounted) {
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
        // First directly check for a session
        const currentSession = await forceCheckSession();
        
        if (currentSession && currentSession.user) {
          console.log('Found active session for:', currentSession.user.id);
          
          // Get user data from database directly
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();
          
          if (error) {
            console.error('Error fetching user data in checkSession:', error);
          } else if (userData && isMounted) {
            console.log('Forcefully setting authenticated state to true with user data');
            
            setUser({
              id: currentSession.user.id,
              email: currentSession.user.email!,
              tokens: userData.tokens || 0,
              tier: userData.tier || 'Pioneer',
              tokens_expiry_date: userData.tokens_expiry_date,
              hasLoggedInBefore: ((userData.tokens ?? 0) > 0 || !!userData.tokens_expiry_date),
              hasStoredConversation: !!userData.conversation_last_used,
              conversationLastUsed: userData.conversation_last_used,
              token: currentSession.access_token,
              stripeCustomerId: userData.stripe_customer_id
            });
            setTokens(userData.tokens || 0);
            setTokensExpiryDate(userData.tokens_expiry_date);
            setTier(userData.tier || 'Pioneer');
            setIsAuthenticated(true);
            
            // Store in localStorage
            localStorage.setItem('dekave_user', JSON.stringify({
              id: currentSession.user.id,
              email: currentSession.user.email,
              isAuthenticated: true
            }));
            
            if (isMounted) setIsLoading(false);
            
            // Notify components about auth state change
            notifyAuthStateChanged();
          }
        }
        
        // Proceed with the normal check for URL code parameter
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
*/

  // Function to sign in with Google - no-op in free mode
  const signInWithGoogle = async () => {
    // No-op, just return a resolved promise
    return Promise.resolve();
  };

  // Function to log out - reset token count
  const logout = async () => {
    try {
      // Track logout
      trackEvent(EventType.SIGN_IN, {
        action: 'logout',
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      
      // Reset token count to maximum
      setTokens(100000);
      
      // Update localStorage
      if (user?.id) {
        localStorage.setItem('dekave_temp_user', JSON.stringify({
          id: user.id,
          lastTokenRefresh: new Date().toISOString(),
        }));
        localStorage.setItem('dekave_temp_tokens', '100000');
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error in logout function:', error);
      return Promise.resolve();
    }
  };

  // Function to refresh token count
  const refreshTokenCount = async () => {
    // In free mode, just return current token count
    return Promise.resolve();
  };

  // Function to buy tokens - not needed in free mode, but stub to prevent errors
  const buyTokens = async (packageId: string) => {
    console.log('Token purchase requested but not needed in free mode:', packageId);
    return { success: true };
  };

  // Function to check if tokens are expired
  const tokensExpired = () => {
    // Tokens never expire in this free mode
    return false;
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

  // Save token usage to localStorage for persistence across sessions
  useEffect(() => {
    if (user?.id && tokens !== 100000) {
      localStorage.setItem('dekave_temp_tokens', tokens.toString());
    }
  }, [tokens, user?.id]);

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
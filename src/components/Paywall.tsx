'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { trackEvent, EventType } from '@/lib/analytics';
import { DanaCheckout } from './DanaCheckout';

type PaywallProps = {
  onClose: () => void;
  isLoading?: boolean;
};

// Cost calculation based on API usage
// Pricing in IDR: 75,000 for 100k tokens, 150,000 for 250k tokens, etc.
// All tokens expire 28 days after purchase

export function Paywall({ onClose, isLoading = false }: PaywallProps) {
  const { user, signInWithGoogle } = useAuth();
  const [showDanaCheckout, setShowDanaCheckout] = useState(false);
  const [error, setError] = useState('');

  // Show Dana checkout immediately if user is already logged in
  if (user && !showDanaCheckout) {
    setShowDanaCheckout(true);
  }

  const handleAuth = async () => {
    try {
      // Track authentication attempt
      trackEvent(EventType.SIGN_IN, {
        method: 'google',
        timestamp: new Date().toISOString()
      });
      
      await signInWithGoogle();
      // After successful sign-in, the user state will update and trigger the checkout
    } catch (error) {
      console.error('Authentication error:', error);
      
      // Track authentication error
      trackEvent(EventType.SIGN_IN, {
        method: 'google',
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      setError('Failed to authenticate. Please try again.');
    }
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {showDanaCheckout ? (
        <DanaCheckout onClose={onClose} isNewUser={true} />
      ) : (
        <motion.div 
          className="w-full max-w-md bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden"
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.1,
            type: "spring",
            stiffness: 300,
            damping: 30 
          }}
        >
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 py-4 sm:py-6 px-4 sm:px-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <button 
              onClick={onClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-zinc-400 hover:text-white p-1"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
              Sign in to Continue
            </h2>
            <p className="text-sm sm:text-base text-zinc-400">
              Create professional product ads in seconds
            </p>
            
            {/* Decorative elements */}
            <div className="absolute -right-8 -top-8 w-16 h-16 rounded-full bg-white/5 blur-xl"></div>
            <div className="absolute -left-4 -bottom-4 w-12 h-12 rounded-full bg-white/5 blur-lg"></div>
          </div>
          
          <div className="p-4 sm:p-6">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2 sm:space-y-3 mb-6">
              <div className="bg-zinc-800/50 rounded-lg p-3 sm:p-4 flex items-start space-x-3 border border-zinc-700/30">
                <div className="rounded-full bg-white/10 p-1 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">100,000+ tokens</p>
                  <p className="text-zinc-400 text-xs mt-1">Generate professional ads with AI</p>
                </div>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-3 sm:p-4 flex items-start space-x-3 border border-zinc-700/30">
                <div className="rounded-full bg-white/10 p-1 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">HD image quality</p>
                  <p className="text-zinc-400 text-xs mt-1">Create professional marketing materials</p>
                </div>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-3 sm:p-4 flex items-start space-x-3 border border-zinc-700/30">
                <div className="rounded-full bg-white/10 p-1 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Commercial license</p>
                  <p className="text-zinc-400 text-xs mt-1">Use generated ads in your business</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <motion.button
                onClick={handleAuth}
                disabled={isLoading}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg 
                          bg-white text-gray-900 hover:bg-gray-100 font-medium text-sm
                          transition-colors"
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                      <path fill="none" d="M1 1h22v22H1z" />
                    </svg>
                    Sign in with Google
                  </div>
                )}
              </motion.button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-zinc-800 text-center">
              <p className="text-xs text-zinc-500">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
} 
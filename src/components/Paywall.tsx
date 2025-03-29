'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { trackEvent, EventType } from '@/lib/analytics';

type PaywallProps = {
  onClose: () => void;
  isLoading?: boolean;
};

// Cost calculation based on API usage
// Average cost per token: ~$0.07 USD
// Pricing: Rp 20,000 for 10 tokens (approx $1.28 USD revenue for ~$0.70 USD cost)
// This ensures >80% profit margin while keeping price simple and attractive

export function Paywall({ onClose, isLoading: externalLoading = false }: PaywallProps) {
  const [error, setError] = useState('');
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(externalLoading);
  
  const handleAuth = async () => {
    try {
      setError('');
      setIsLoading(true);
      
      // Track authentication attempt
      trackEvent(EventType.SIGN_IN, {
        method: 'google',
        timestamp: new Date().toISOString()
      });
      
      // Remove development mode bypass and implement proper auth flow
      await signInWithGoogle();
      
      // The signInWithGoogle function should handle the redirect
      // For Vercel deployment, ensure proper callback URLs are configured
      
    } catch (error: any) {
      console.error(`Signup error:`, error);
      
      // Track authentication error
      trackEvent(EventType.SIGN_IN, {
        method: 'google',
        status: 'error',
        errorMessage: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      // Handle specific error messages
      if (error.message?.includes('supabaseKey is required')) {
        setError('Server configuration error. Please check your environment variables.');
      } else {
        setError(`Authentication failed: ${error.message || 'Please try again later'}`);
      }
      
      setIsLoading(false);
    }
  };
  
  return (
    <motion.div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
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
        <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 py-6 px-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Get Tokens for Professional Ads
          </h2>
          <p className="text-zinc-400">
            Create stunning marketing visuals
          </p>
          
          {/* Decorative elements */}
          <div className="absolute -right-8 -top-8 w-16 h-16 rounded-full bg-white/5 blur-xl"></div>
          <div className="absolute -left-4 -bottom-4 w-12 h-12 rounded-full bg-white/5 blur-lg"></div>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col space-y-4 mb-6">
            {/* Token package */}
            <motion.div 
              className="p-4 rounded-lg bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-700/50"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-white font-medium">10 Tokens</h3>
                <span className="text-sm bg-white/10 rounded-full px-2 py-0.5 text-white">Rp 20,000</span>
              </div>
              <ul className="space-y-2 mb-3">
                <li className="flex items-center text-sm text-zinc-300">
                  <svg className="h-4 w-4 mr-2 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Create multiple professional ads
                </li>
                <li className="flex items-center text-sm text-zinc-300">
                  <svg className="h-4 w-4 mr-2 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Choose between standard or HD quality
                </li>
                <li className="flex items-center text-sm text-zinc-300">
                  <svg className="h-4 w-4 mr-2 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Advanced brand style matching
                </li>
              </ul>
              
              <div className="text-xs text-zinc-500 mt-2 p-2 bg-zinc-800/50 rounded-lg">
                <p>Each generation typically costs:</p>
                <ul className="mt-1 pl-4 list-disc">
                  <li>Standard quality: 1 token</li>
                  <li>HD quality: 2 tokens</li>
                </ul>
              </div>
            </motion.div>
          </div>
          
          <div className="flex flex-col gap-3">
            <motion.button
              type="button"
              onClick={handleAuth}
              disabled={isLoading}
              className={`flex-1 flex justify-center py-3 px-4 rounded-lg shadow-lg
                        text-sm font-medium text-black bg-white hover:bg-zinc-200 
                        transition-all transform hover:scale-[1.02] active:scale-[0.98]
                        ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Pay Rp 20,000'
              )}
            </motion.button>
          </div>
          
          {error && (
            <motion.p 
              className="mt-4 text-sm text-red-400 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.p>
          )}
          
          <div className="mt-6 pt-4 border-t border-zinc-800/50">
            <p className="text-xs text-center text-zinc-500">
              By continuing, you agree to our Terms and Privacy Policy
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
} 
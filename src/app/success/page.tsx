'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { trackEvent, EventType } from '@/lib/analytics';

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { refreshTokenCount, user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setIsProcessing(false);
      setErrorMessage('Invalid session');
      return;
    }

    const verifyPayment = async () => {
      try {
        // Wait a moment for Stripe webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Refresh token count from the database
        await refreshTokenCount();
        
        setSuccess(true);
        setIsProcessing(false);
        
        // Redirect back to the app after showing success message
        setTimeout(() => {
          router.push('/');
        }, 3000);

        // Track event
        trackEvent(EventType.TOKEN_PURCHASE, {
          sessionId,
          userId: user?.id,
          status: 'success',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error verifying payment:', error);
        setErrorMessage('Failed to verify payment. Your account will be updated soon.');
        setIsProcessing(false);
      }
    };

    verifyPayment();
  }, [sessionId, refreshTokenCount, router, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-zinc-900 to-black text-white p-4">
      <motion.div 
        className="w-full max-w-md bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 py-6 px-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <h2 className="text-2xl font-bold text-white">
            {isProcessing ? 'Processing Payment' : success ? 'Payment Successful!' : 'Payment Status'}
          </h2>
          
          {/* Decorative elements */}
          <div className="absolute -right-8 -top-8 w-16 h-16 rounded-full bg-white/5 blur-xl"></div>
          <div className="absolute -left-4 -bottom-4 w-12 h-12 rounded-full bg-white/5 blur-lg"></div>
        </div>
        
        <div className="p-6">
          {isProcessing ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
              <p className="text-zinc-300">Verifying your payment...</p>
            </div>
          ) : success ? (
            <div className="text-center py-6">
              <div className="rounded-full bg-green-500/20 h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Payment Confirmed</h3>
              <p className="text-zinc-400 mb-4">Your tokens have been added to your account!</p>
              <p className="text-zinc-500 text-sm">Redirecting you back to the app...</p>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="rounded-full bg-amber-500/20 h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Payment Processing</h3>
              <p className="text-zinc-400 mb-6">{errorMessage || 'Your payment is being processed. Please check back later.'}</p>
              <button 
                onClick={() => router.push('/')}
                className="py-2 px-4 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition-colors"
              >
                Return to App
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
} 
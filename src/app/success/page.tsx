'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // In a real app, we would verify the payment status with Stripe
    // For demo purposes, we'll simulate a delay and redirect to home
    
    const timer = setTimeout(() => {
      setLoading(false);
      
      // Redirect to home after showing success message
      const redirectTimer = setTimeout(() => {
        router.push('/');
      }, 3000);
      
      return () => clearTimeout(redirectTimer);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      {loading ? (
        <LoadingSpinner message="Confirming your payment..." />
      ) : (
        <div className="bg-white dark:bg-black rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-black dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Payment Successful!
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your 10 tokens have been added to your account. You can now create professional ads for your products.
          </p>
          
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Redirecting you to the app...
          </p>
        </div>
      )}
    </div>
  );
} 
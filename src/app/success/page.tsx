'use client';

import React from 'react';
import { verifyDanaPayment } from '@/lib/dana';
import { trackEvent, EventType } from '@/lib/analytics';
import { redirect } from 'next/navigation';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const transactionId = searchParams.transaction_id as string;
  const packageId = searchParams.package_id as string;
  
  if (!transactionId) {
    // No transaction ID found, redirect to home with error
    redirect('/?error=Invalid+transaction');
  }
  
  // Verify the payment with Dana
  const isValid = await verifyDanaPayment(transactionId);
  
  // Track payment verification event
  trackEvent(EventType.TOKEN_PURCHASE, {
    transactionId,
    packageId,
    status: isValid ? 'success' : 'verification_failed',
    provider: 'dana',
    timestamp: new Date().toISOString()
  });
  
  // If payment verification failed, redirect to home with error
  if (!isValid) {
    redirect('/?error=Payment+verification+failed');
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-900 text-white">
      <div className="w-full max-w-md bg-zinc-800 rounded-xl shadow-lg p-6 border border-zinc-700">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-zinc-400 mb-6">
            Your tokens have been added to your account.
          </p>
          
          <div className="bg-zinc-700/50 rounded-lg p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-zinc-400">Transaction ID:</span>
              <span className="text-zinc-200 font-mono text-sm">{transactionId.substring(0, 16)}...</span>
            </div>
            {packageId && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Package:</span>
                <span className="text-zinc-200 capitalize">{packageId}</span>
              </div>
            )}
          </div>
          
          <a 
            href="/"
            className="block w-full bg-white text-black py-2.5 px-4 rounded-lg text-center font-medium hover:bg-zinc-200 transition"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
} 
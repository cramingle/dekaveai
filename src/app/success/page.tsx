'use client';

import React from 'react';
import { verifyPayment } from '@/lib/stripe';
import { trackEvent, EventType } from '@/lib/analytics';
import { redirect } from 'next/navigation';
import { decrypt } from '@/lib/crypto';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Get encrypted data from URL params
  const encryptedData = searchParams.data || '';
  
  // Normalize to string
  const data = Array.isArray(encryptedData) ? encryptedData[0] : encryptedData;
  
  if (!data) {
    redirect('/?error=Invalid+session');
  }
  
  try {
    // Decrypt and parse the data
    const decryptedData = JSON.parse(decrypt(data));
    const { session_id } = decryptedData;
    
    // Verify the payment with Stripe
    const isValid = await verifyPayment(session_id);
    
    // Track payment verification event
    trackEvent(EventType.TOKEN_PURCHASE, {
      sessionId: session_id,
      status: isValid ? 'success_page_view' : 'verification_failed',
      provider: 'stripe',
      timestamp: new Date().toISOString()
    });
    
    // If payment verification failed, redirect to home with error
    if (!isValid) {
      redirect('/?error=Payment+verification+failed');
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-center mb-4">Payment Successful!</h1>
          <p className="text-gray-600 text-center mb-6">
            Your tokens have been added to your account.
          </p>
          <div className="flex justify-center">
            <a
              href="/"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return to Home
            </a>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error processing success page:', error);
    redirect('/?error=Invalid+session+data');
  }
} 
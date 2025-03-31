import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { IS_DANA_CONFIGURED, TOKEN_PACKAGES } from '@/lib/dana';
import { trackEvent, EventType } from '@/lib/analytics';

type DanaPackage = {
  id: string;
  tokens: number;
  price: number;
  discount: number;
  tier: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';
};

type DanaCheckoutProps = {
  onClose: () => void;
  isNewUser?: boolean;
};

export function DanaCheckout({ onClose, isNewUser = false }: DanaCheckoutProps) {
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<string>(isNewUser ? 'basic' : '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const packages: DanaPackage[] = [
    { id: 'basic', tokens: 100000, price: 75000, discount: 0, tier: 'Pioneer' },
    { id: 'value', tokens: 250000, price: 150000, discount: 20, tier: 'Voyager' },
    { id: 'pro', tokens: 600000, price: 300000, discount: 33, tier: 'Dominator' },
    { id: 'max', tokens: 1000000, price: 450000, discount: 50, tier: 'Overlord' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;
    
    setIsLoading(true);
    setError(null);
    
    // Track token purchase attempt
    trackEvent(EventType.TOKEN_PURCHASE, {
      packageId: selectedPackage,
      isNewUser: isNewUser,
      userId: user?.id || 'unknown',
      method: 'dana',
      status: 'initiated',
      timestamp: new Date().toISOString()
    });
    
    try {
      // Call our API endpoint to create a Dana payment
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user?.email || '',
          userId: user?.id || '',
          packageId: selectedPackage
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        // Track failure
        trackEvent(EventType.TOKEN_PURCHASE, {
          packageId: selectedPackage,
          isNewUser: isNewUser,
          userId: user?.id || 'unknown',
          method: 'dana',
          status: 'failed',
          error: data.error || data.message || 'Payment creation failed',
          errorCode: data.code,
          timestamp: new Date().toISOString()
        });
        
        // Use the friendly error message from the API if available
        const errorMessage = data.message || data.error || 'Failed to create payment. Please try again.';
        setError(errorMessage);
        setIsLoading(false);
        return;
      }
      
      if (!data.paymentUrl) {
        setError('Payment URL not provided. Please try again later.');
        setIsLoading(false);
        return;
      }
      
      // Track successful redirect
      trackEvent(EventType.TOKEN_PURCHASE, {
        packageId: selectedPackage,
        isNewUser: isNewUser,
        userId: user?.id || 'unknown',
        method: 'dana',
        status: 'redirected',
        partnerReferenceNo: data.partnerReferenceNo,
        timestamp: new Date().toISOString()
      });
      
      // Redirect to Dana payment page
      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error('Error creating payment:', error);
      
      // Track error
      trackEvent(EventType.TOKEN_PURCHASE, {
        packageId: selectedPackage,
        isNewUser: isNewUser,
        userId: user?.id || 'unknown',
        method: 'dana',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      setIsLoading(false);
      setError('An unexpected error occurred. Please try again later.');
    }
  };
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };
  
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}k`;
    }
    return tokens.toString();
  };
  
  return (
    <motion.div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div 
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden"
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
            {isNewUser ? 'Select Your First Package' : 'Purchase Tokens'}
          </h2>
          <p className="text-sm sm:text-base text-zinc-400">
            Secure payment via Dana
          </p>
          
          {/* Decorative elements */}
          <div className="absolute -right-8 -top-8 w-16 h-16 rounded-full bg-white/5 blur-xl"></div>
          <div className="absolute -left-4 -bottom-4 w-12 h-12 rounded-full bg-white/5 blur-lg"></div>
        </div>
        
        <div className="p-3 sm:p-6 overflow-y-auto max-h-[calc(100vh-150px)]">
          <motion.form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:gap-3">
              {packages.map((pkg, index) => (
                <motion.div
                  key={pkg.id}
                  className={`relative rounded-xl border ${selectedPackage === pkg.id ? 'border-white/30 bg-white/5' : 'border-zinc-700/50 bg-zinc-800/30'} 
                            p-3 sm:p-4 cursor-pointer hover:bg-white/5 transition-colors`}
                  onClick={() => {
                    setSelectedPackage(pkg.id);
                    
                    // Track package selection
                    trackEvent(EventType.TOKEN_PURCHASE, {
                      action: 'package_select',
                      packageId: pkg.id,
                      isNewUser: isNewUser,
                      userId: user?.id || 'unknown',
                      tokens: pkg.tokens,
                      price: pkg.price,
                      tier: pkg.tier,
                      timestamp: new Date().toISOString()
                    });
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.05 }}
                >
                  {pkg.discount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-white text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                      -{pkg.discount}%
                    </div>
                  )}
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full mr-3 flex-shrink-0 border ${selectedPackage === pkg.id ? 'border-white bg-white' : 'border-zinc-600'}`}>
                      {selectedPackage === pkg.id && (
                        <motion.div 
                          className="w-2 h-2 bg-zinc-900 rounded-full m-auto"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        />
                      )}
                    </div>
                    <div className="flex-1 flex flex-wrap justify-between items-center">
                      <div>
                        <p className="text-white font-medium text-sm sm:text-base">{formatTokens(pkg.tokens)} Tokens</p>
                        <p className="text-zinc-400 text-xs mt-0.5">
                          Rp{(pkg.price * 100 / pkg.tokens).toFixed(2)} per 1k tokens
                        </p>
                        <p className="text-xs mt-1 text-zinc-300">Tier: <span className="font-medium">{pkg.tier}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-base sm:text-lg font-bold">{formatPrice(pkg.price)}</p>
                        {pkg.discount > 0 && (
                          <p className="text-zinc-500 text-xs line-through">
                            {formatPrice(Math.round(pkg.price / (1 - pkg.discount / 100)))}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-2">
              <p className="text-xs text-zinc-500 mb-3">
                Payments processed securely by Dana. You will be redirected to Dana to complete your payment.
              </p>
              
              {IS_DANA_CONFIGURED && (
                <div className="flex justify-center">
                  <img src="/dana-badge.png" alt="Secured by Dana" className="h-6" />
                </div>
              )}
            </div>
            
            {error && (
              <motion.div 
                className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                  </svg>
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
            
            <motion.button
              type="submit"
              disabled={isLoading || !selectedPackage}
              className={`w-full flex justify-center py-3 px-4 rounded-lg shadow-lg
                        text-sm font-medium text-black bg-white hover:bg-zinc-200 
                        transition-all transform hover:scale-[1.02] active:scale-[0.98]
                        mt-4 sm:mt-6
                        ${(isLoading || !selectedPackage) ? 'opacity-50 cursor-not-allowed' : ''}`}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
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
                `Proceed to Checkout ${selectedPackage ? `• ${formatPrice(packages.find(p => p.id === selectedPackage)?.price || 0)}` : ''}`
              )}
            </motion.button>
          </motion.form>
          
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-zinc-800/50">
            <p className="text-xs text-center text-zinc-500">
              Secure payment processing. Tokens expire 28 days after purchase.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
} 
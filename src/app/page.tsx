'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Paywall } from '@/components/Paywall';
import { TokenTopup } from '@/components/TokenTopup';
import { useAuth } from '@/lib/auth';
import { trackEvent, EventType } from '@/lib/analytics';
import { extractBrandProfile, saveBrandProfile } from '@/lib/brand-profile';

interface UploadedImage {
  id: string;
  url: string;
  size?: number; // Image size in bytes
}

type TokenTier = 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';

interface TokenUsageInfo {
  tier: TokenTier;
  maxTokens: number;
  tokenRatio: number; // tokens per image generation
  promptMultiplier: number; // multiplier for prompt complexity
  imageMultiplier: number; // multiplier for image size/complexity
  refreshDate?: Date; // When tokens refresh (for subscription models)
}

interface ChatMessage {
  id: string;
  type: 'prompt' | 'result';
  content: string;
  timestamp: number;
  tokensUsed?: number;
  messageType: 'text' | 'image';
}

export default function Home() {
  // Use auth context
  const { isAuthenticated, tokens, tier, buyTokens, refreshTokenCount, user } = useAuth();
  
  // Other state variables
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedAd, setGeneratedAd] = useState<string | null>(null);
  const [showDropzone, setShowDropzone] = useState<boolean>(false);
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const [showTokenTopup, setShowTokenTopup] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [isHDQuality, setIsHDQuality] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [maxTokens, setMaxTokens] = useState<number>(10);
  const [tokenInfo, setTokenInfo] = useState<TokenUsageInfo>({
    tier: 'Pioneer',
    maxTokens: 3,
    tokenRatio: 1.2,
    promptMultiplier: 1.5,
    imageMultiplier: 2,
  });
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState<boolean>(false);
  const [brandProfileAnalyzed, setBrandProfileAnalyzed] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle window resizing
  useEffect(() => {
    // Set initial width
    setWindowWidth(window.innerWidth);
    
    // Add resize listener
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Show token purchase modal only for authenticated users who have had tokens before
  // but now have 0 tokens (tokens expired), not for new users
  useEffect(() => {
    // Check if the user has previously had tokens but they are now at 0
    // This would indicate an existing user who needs to top up
    if (isAuthenticated && tokens === 0 && user?.hasLoggedInBefore) {
      setShowTokenTopup(true);
    }
    
    // Check for URL parameter (for manual token purchase)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('showTokenTopup') === 'true' && isAuthenticated) {
        setShowTokenTopup(true);
        
        // Clean the URL to remove the parameter (to avoid showing the modal again on refresh)
        const url = new URL(window.location.href);
        url.searchParams.delete('showTokenTopup');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [isAuthenticated, tokens, user]);
  
  // Token utility functions
  const getMaxTokens = () => {
    // Use a consistent upper limit for all users, not based on tier
    return 1000000; // 1M tokens as reasonable default
  };
  
  const calculateTokenUsage = (prompt: string, images: UploadedImage[]): number => {
    // Base token cost for standard quality
    let tokenCost = 10000;
    
    // Double the cost for HD quality
    if (isHDQuality) {
      tokenCost = 20000;
    }
    
    return tokenCost;
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map(file => ({
      id: `img-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`,
      url: URL.createObjectURL(file),
      size: file.size
    }));
    setUploadedImages(prev => [...prev, ...newImages]);
    setShowDropzone(false);
    
    // Analyze brand profile if this is the first image
    if (!brandProfileAnalyzed && newImages.length > 0) {
      setIsAnalyzingBrand(true);
      const profile = await extractBrandProfile(newImages[0].url);
      if (profile && user?.id) {
        await saveBrandProfile(user.id, profile);
      }
      setIsAnalyzingBrand(false);
      setBrandProfileAnalyzed(true);
      
      // Add system message to chat history
      setChatHistory(prev => [...prev, {
        id: `system-${Date.now()}`,
        type: 'result',
        content: "I understand your brand profile. Now, tell me what kind of ad you'd like to create.",
        timestamp: Date.now(),
        messageType: 'text'
      } as ChatMessage]);
    }
    
    // Track image upload event
    trackEvent(EventType.IMAGE_UPLOAD, {
      count: files.length,
      totalSize: files.reduce((total, file) => total + file.size, 0),
      types: files.map(file => file.type)
    });
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setShowDropzone(false);
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    const newImages = files.map(file => ({
      id: `img-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`,
      url: URL.createObjectURL(file),
      size: file.size
    }));
    setUploadedImages(prev => [...prev, ...newImages]);
  };
  
  const handlePromptSubmit = async (prompt: string) => {
    if (!prompt.trim()) return;
    
    // Calculate token cost for this operation
    const tokenCost = calculateTokenUsage(prompt, uploadedImages);
    
    setIsGenerating(true);
    
    // Add prompt to chat history with token usage information
    setChatHistory(prev => [...prev, {
      id: `prompt-${Date.now()}`,
      type: 'prompt',
      content: prompt,
      timestamp: Date.now(),
      tokensUsed: tokenCost,
      messageType: 'text'
    } as ChatMessage]);
    
    // Clear the input after submission
    setUserPrompt('');
    
    // If authenticated, subtract tokens and proceed
    if (isAuthenticated) {
      // Check if user has enough tokens
      if (tokens < tokenCost) {
        setTimeout(() => {
          setIsGenerating(false);
          setShowTokenTopup(true);
        }, 1000);
        return;
      }
      
      // Subtract tokens
      try {
        // Immediately update UI to show token usage
        const newTokenCount = Math.max(0, tokens - tokenCost);
        console.log(`Using ${tokenCost} tokens. Current: ${tokens}, New: ${newTokenCount}`);
        
        // Call API to update tokens in the backend
        const result = await buyTokens(`subtract-${tokenCost}`);
        
        if (!result.success) {
          console.error('Error subtracting tokens:', result.error);
          setIsGenerating(false);
          alert('Failed to process tokens');
          return;
        }
        
        try {
          const imageUrl = uploadedImages[0]?.url;
          
          if (!imageUrl) {
            throw new Error('No image provided');
          }
          
          // Call the generate API endpoint
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageUrl,
              prompt,
              userId: user?.id, // Use actual user ID from authenticated session
              templateName: 'sportsDrink', // Or dynamically choose based on user input
              isHDQuality
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate ad');
          }
          
          const apiResult = await response.json();
          setGeneratedAd(apiResult.adImageUrl);
          setChatHistory(prev => [...prev, {
            id: `result-${Date.now()}`,
            type: 'result',
            content: apiResult.adImageUrl,
            timestamp: Date.now(),
            messageType: 'image'
          } as ChatMessage]);
          setIsGenerating(false);
          return;
        } catch (error) {
          console.error('API generation error:', error);
          setIsGenerating(false);
          alert('Failed to generate ad. Please try again.');
          return;
        }
      } catch (error) {
        console.error('Error subtracting tokens:', error);
        setIsGenerating(false);
        alert('An error occurred while processing your request');
      }
    } else {
      // Show paywall after a brief loading period for dramatic effect
      setTimeout(() => {
        setIsGenerating(false);
        setShowPaywall(true);
      }, 1800);
    }
  };
  
  const simulateSuccessfulPayment = async () => {
    // Hide paywall
    setShowPaywall(false);
    setIsProcessingPayment(false);
    
    // Show loading spinner
    setIsGenerating(true);
    
    // Call the API to generate the result
    try {
      // Get the latest prompt from chat history
      const lastPrompt = chatHistory.filter(item => item.type === 'prompt').pop();
      
      if (!lastPrompt || !uploadedImages[0]?.url) {
        throw new Error('Missing prompt or image');
      }
      
      // Call the generate API endpoint
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: uploadedImages[0].url,
          prompt: lastPrompt.content,
          templateName: 'sportsDrink',
          isHDQuality
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate ad');
      }
      
      const apiResult = await response.json();
      setGeneratedAd(apiResult.adImageUrl);
      setChatHistory(prev => [...prev, {
        id: `result-${Date.now()}`,
        type: 'result',
        content: apiResult.adImageUrl,
        timestamp: Date.now(),
        messageType: 'image'
      } as ChatMessage]);
    } catch (error) {
      console.error('Error generating result:', error);
      alert('Failed to generate result. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleTokenPurchase = async (packageId: string) => {
    setIsProcessingPayment(true);
    
    try {
      const result = await buyTokens(packageId);
      
      // Track token purchase event (successfully attempted)
      trackEvent(EventType.TOKEN_PURCHASE, {
        packageId,
        success: result.success,
        timestamp: new Date().toISOString()
      });
      
      if (!result.success) {
        console.error('Token purchase error:', result.error);
        alert(result.error || 'Failed to purchase tokens');
      }
      
      setIsProcessingPayment(false);
      setShowTokenTopup(false);
    } catch (error) {
      console.error('Error buying tokens:', error);
      
      // Track token purchase error
      trackEvent(EventType.TOKEN_PURCHASE, {
        packageId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      setIsProcessingPayment(false);
      alert('An error occurred while purchasing tokens');
    }
  };
  
  const handleBuyMoreTokens = () => {
    setShowTokenTopup(true);
  };
  
  const startNewChat = () => {
    window.location.reload();
  };

  const toggleHDQuality = () => {
    const newQuality = !isHDQuality;
    setIsHDQuality(newQuality);
    
    // Track quality selection event
    trackEvent(EventType.QUALITY_SELECTION, {
      quality: newQuality ? 'HD' : 'Standard',
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div 
      className="min-h-screen flex flex-col bg-gradient-to-b from-black via-zinc-900 to-black text-white"
      onDragOver={(e) => { e.preventDefault(); setShowDropzone(true); }}
      onDragLeave={(e) => { e.preventDefault(); setShowDropzone(false); }}
      onDrop={handleDrop}
    >
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-zinc-800/20 rounded-full blur-2xl"></div>
      </div>

      {/* Top toolbar */}
      <motion.div 
        className="flex justify-between items-center p-4 pt-6 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <button 
          onClick={startNewChat} 
          className="rounded-full bg-zinc-800/80 backdrop-blur-sm w-12 h-12 flex items-center justify-center hover:bg-zinc-700/80 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
        
        {/* Center logo */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <img 
            src="/desktop-logo.png" 
            alt="Logo" 
            className="h-10 hidden md:block"
          />
          <img 
            src="/phone-logo.png" 
            alt="Logo" 
            className="h-8 block md:hidden"
          />
        </div>
        
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <button 
              onClick={handleBuyMoreTokens}
              className={`text-sm bg-zinc-800/50 backdrop-blur-sm rounded-full px-3 py-1.5 hover:bg-zinc-700/50 transition-colors flex items-center ${tokens < 3 ? 'text-amber-400' : tokens < maxTokens / 2 ? 'text-zinc-300' : 'text-zinc-400'}`}
            >
              <span className="font-medium">{tokens}</span>
              <span className="ml-1">tokens</span>
              {tokens < 3 && (
                <span className="ml-1.5 text-amber-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </button>
          ) : (
            <></>
          )}
          <Link href="/landing">
            <button className="rounded-full bg-zinc-800/80 backdrop-blur-sm w-10 h-10 flex items-center justify-center hover:bg-zinc-700/80 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
          </Link>
        </div>
      </motion.div>
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-y-auto px-4 py-6 relative z-10">
        <AnimatePresence mode="wait">
          {!uploadedImages.length && !chatHistory.length && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8 flex-1 flex flex-col items-center justify-center"
            >
              <h1 className="text-2xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-zinc-400 text-transparent bg-clip-text">
                Create stunning product ads
              </h1>
              
              {/* Initial centered input for first time users */}
              <div className="w-full max-w-2xl">
                <div className="relative rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/10 overflow-hidden">
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Upload an image that represents your brand's identity and style..."
                    className="w-full bg-transparent border-none px-6 py-4 text-white placeholder-zinc-500 focus:outline-none resize-none"
                    style={{minHeight: '56px'}}
                    disabled={true}
                  />
                  
                  <div className="absolute bottom-2 right-2 flex space-x-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      multiple
                      onChange={handleImageUpload}
                    />
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full bg-zinc-800/80 backdrop-blur-sm w-8 h-8 flex items-center justify-center hover:bg-zinc-700/80 transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="w-full max-w-5xl mx-auto flex flex-col">
            {/* Uploaded Images Grid - Only show when we have uploads */}
            {uploadedImages.length > 0 && (
              <motion.div
                key="image-grid"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full flex justify-end mb-3"
              >
                <div className="flex flex-wrap gap-1 justify-end" style={{ 
                  maxWidth: windowWidth < 640 ? '95%' : '350px',
                  marginLeft: 'auto'
                }}>
                  {uploadedImages.map((image) => (
                    <motion.div
                      key={image.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="relative overflow-hidden border border-white/10 rounded-lg"
                      style={{ 
                        width: uploadedImages.length > 2 
                          ? (windowWidth < 640 ? '50px' : '70px') 
                          : (windowWidth < 640 ? '70px' : '90px'),
                        height: uploadedImages.length > 2 
                          ? (windowWidth < 640 ? '50px' : '70px') 
                          : (windowWidth < 640 ? '70px' : '90px'),
                      }}
                    >
                      <img src={image.url} alt="Uploaded product" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => {
                          setUploadedImages(prev => prev.filter(img => img.id !== image.id));
                        }}
                        className="absolute top-1 right-1 bg-black/70 hover:bg-black/90 rounded-full p-0.5 transition-colors"
                        aria-label="Remove image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Chat History - Only show when we have chat history */}
            {chatHistory.length > 0 && (
              <div className="flex-1 space-y-6 w-full">
                <AnimatePresence mode="popLayout">
                  {chatHistory.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                      layout
                    >
                      {item.type === 'prompt' ? (
                        <div className="flex justify-end mb-4">
                          <div className="bg-zinc-800 rounded-2xl rounded-tr-sm px-6 py-4 max-w-[80%]" style={{ 
                            maxWidth: windowWidth < 640 ? '85%' : '350px' 
                          }}>
                            <p className="text-white">{item.content}</p>
                            {item.tokensUsed && (
                              <p className="text-zinc-500 text-xs mt-1 text-right">
                                {item.tokensUsed} token{item.tokensUsed !== 1 ? 's' : ''} used
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start mb-4">
                          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl rounded-tl-sm p-3 max-w-[90%]">
                            {item.messageType === 'text' ? (
                              <p className="text-white">{item.content}</p>
                            ) : (
                              <img src={item.content} alt="Generated result" className="rounded-lg max-h-[450px] w-auto" />
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Loading indicator */}
            {isGenerating && (
              <motion.div 
                className="flex flex-col items-center justify-center py-8 w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <LoadingSpinner size={80} color="#ffffff" message="Generating your ad..." />
              </motion.div>
            )}
          </div>
        </AnimatePresence>
      </div>

      {/* Loading indicator for brand analysis */}
      {isAnalyzingBrand && (
        <motion.div 
          className="flex flex-col items-center justify-center py-8 w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <LoadingSpinner size={80} color="#ffffff" message="Analyzing your brand profile..." />
        </motion.div>
      )}

      {/* Input area - Only show when images are uploaded or chat has started */}
      {(uploadedImages.length > 0 || chatHistory.length > 0) && (
        <motion.div 
          className="p-4 border-t border-white/10 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/10 overflow-hidden">
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder={brandProfileAnalyzed ? "Describe the ad you want to create..." : "Upload a brand image to begin..."}
                className="w-full bg-transparent border-none px-6 py-4 text-white placeholder-zinc-500 focus:outline-none resize-none"
                style={{minHeight: '56px'}}
                disabled={!uploadedImages.length || isGenerating || !brandProfileAnalyzed}
              />
              
              <div className="absolute bottom-2 right-2 flex space-x-2 items-center">
                {/* Quality toggle switch */}
                {uploadedImages.length > 0 && !isGenerating && (
                  <div className="flex items-center mr-2">
                    <span className="text-xs text-zinc-500 mr-2">
                      {isHDQuality ? 'HD' : 'Standard'}
                    </span>
                    <button 
                      onClick={toggleHDQuality}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${isHDQuality ? 'bg-white' : 'bg-zinc-700'}`}
                    >
                      <span 
                        className={`inline-block h-4 w-4 transform rounded-full transition-transform ${isHDQuality ? 'translate-x-5 bg-zinc-900' : 'translate-x-1 bg-white'}`}
                      />
                    </button>
                  </div>
                )}
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  multiple
                  onChange={handleImageUpload}
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-zinc-800/80 backdrop-blur-sm w-8 h-8 flex items-center justify-center hover:bg-zinc-700/80 transition-all"
                  disabled={isGenerating}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </button>
                
                <button 
                  onClick={() => handlePromptSubmit(userPrompt)}
                  disabled={!userPrompt.trim() || !uploadedImages.length || isGenerating || (isAuthenticated && tokens < calculateTokenUsage(userPrompt, uploadedImages))}
                  className="rounded-full bg-white text-black w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* File drop overlay */}
      <AnimatePresence>
        {showDropzone && (
          <motion.div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-8 rounded-2xl border-2 border-dashed border-white/20 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xl font-medium text-white/80">Drop your images here</p>
            </div>
          </motion.div>
        )}
        
        {/* Paywall overlay - for non-authenticated users */}
        {showPaywall && (
          <Paywall 
            onClose={() => setShowPaywall(false)}
            isLoading={isProcessingPayment}
          />
        )}
        
        {/* Token Topup overlay - for authenticated users */}
        {showTokenTopup && (
          <TokenTopup 
            onClose={() => setShowTokenTopup(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

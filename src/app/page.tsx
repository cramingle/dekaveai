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
  messageType: 'text' | 'image';
}

type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'twitter';

interface PlatformSize {
  width: number;
  height: number;
  type: 'post' | 'story' | 'ad' | 'carousel';
}

const PLATFORM_SIZES: Record<SocialPlatform, Record<string, PlatformSize>> = {
  instagram: {
    post: { width: 1080, height: 1080, type: 'post' },
    story: { width: 1080, height: 1920, type: 'story' },
    ad_story: { width: 1080, height: 1920, type: 'ad' },
    ad_landscape: { width: 1080, height: 566, type: 'ad' },
    ad_square: { width: 1080, height: 1080, type: 'ad' }
  },
  facebook: {
    post: { width: 1200, height: 630, type: 'post' },
    ad: { width: 1080, height: 1080, type: 'ad' },
    video: { width: 1280, height: 720, type: 'post' }
  },
  linkedin: {
    post: { width: 1200, height: 627, type: 'post' },
    story: { width: 1080, height: 1920, type: 'story' },
    carousel: { width: 1080, height: 1080, type: 'carousel' }
  },
  twitter: {
    tweet: { width: 1600, height: 900, type: 'post' },
    ad_square: { width: 720, height: 720, type: 'ad' },
    ad_landscape: { width: 1280, height: 720, type: 'ad' }
  }
};

interface EditingContext {
  isEditing: boolean;
  targetMessageId: string | null;
  originalImage: string | null;
  originalPrompt?: string | null;
}

interface AppState {
  chatStarted?: boolean;
  isLoadingResponse?: boolean;
  chatHistory?: ChatMessage[];
  systemMessages?: ChatMessage[];
  selectedProduct?: any;
  productName?: string;
  productDescription?: string;
  targetAudience?: string;
  draftResponse?: string;
  productImages?: any[];
  progress?: number;
  uploadedImages?: any[];
  brandProfileAnalyzed?: boolean;
  userPrompt?: string;
}

export default function Home() {
  const { user, isLoading, tokens, isAuthenticated, refreshTokenCount } = useAuth();
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [brandProfileAnalyzed, setBrandProfileAnalyzed] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [showTokenTopup, setShowTokenTopup] = useState(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedAd, setGeneratedAd] = useState<string | null>(null);
  const [showDropzone, setShowDropzone] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [isHDQuality, setIsHDQuality] = useState<boolean>(false);
  const [maxTokens, setMaxTokens] = useState<number>(100000);
  const [tokenInfo, setTokenInfo] = useState<TokenUsageInfo>({
    tier: 'Overlord',
    maxTokens: 100000,
    tokenRatio: 1.2,
    promptMultiplier: 1.5,
    imageMultiplier: 2,
  });
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState<boolean>(false);
  const [editingContext, setEditingContext] = useState<EditingContext>({
    isEditing: false,
    targetMessageId: null,
    originalImage: null,
    originalPrompt: null
  });
  
  // Add missing state declarations
  const [chatStarted, setChatStarted] = useState<boolean>(false);
  const [isLoadingResponse, setIsLoadingResponse] = useState<boolean>(false);
  const [systemMessages, setSystemMessages] = useState<ChatMessage[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productName, setProductName] = useState<string>('');
  const [productDescription, setProductDescription] = useState<string>('');
  const [targetAudience, setTargetAudience] = useState<string>('');
  const [draftResponse, setDraftResponse] = useState<string>('');
  const [productImages, setProductImages] = useState<any[]>([]);
  const [progress, setProgress] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Log temporary user state for debugging
  useEffect(() => {
    console.log('Auth state in Home component:', { 
      isAuthenticated, 
      user: user ? `User ${user.id}` : 'No user', 
      tokens, 
      isLoading 
    });
    
    // No need to check localStorage for cached auth as we use temporary user system
  }, [isAuthenticated, user, tokens, isLoading]);

  // Listen for state restoration events
  useEffect(() => {
    // Create a reference we can use to track component mounted state
    let mounted = true;
    
    console.log('Setting up state restoration listener');
    
    // Create the event handler
    const handleStateRestoration = (event: CustomEvent<AppState>) => {
      // Check if component is still mounted
      if (!mounted) {
        console.log('Ignoring state restoration event - component unmounted');
        return;
      }
      
      try {
        console.log('Handling state restoration event with detail:', event.detail);
        const state = event.detail;
        
        if (!state) {
          console.warn('Received empty state in restoration event');
          return;
        }

        // Log what we're restoring
        const keys = Object.keys(state);
        console.log(`Restoring state with keys: ${keys.join(', ')}`);
        
        if (state.uploadedImages?.length) {
          console.log(`Restoring ${state.uploadedImages.length} uploaded images`);
        }
        
        if (state.chatHistory?.length) {
          console.log(`Restoring ${state.chatHistory.length} chat messages`);
        }
        
        // Batch all state updates to avoid React errors
        setTimeout(() => {
          if (!mounted) return;
          
          // Apply all updates in a specific order to ensure proper UI state
          try {
            // First restore uploaded images
            if (state.uploadedImages?.length) {
              setUploadedImages(state.uploadedImages);
            }
            
            // Then restore specific state flags
            if (state.brandProfileAnalyzed !== undefined) {
              setBrandProfileAnalyzed(!!state.brandProfileAnalyzed);
            }
            
            // Then restore chat history
            if (state.chatHistory?.length) {
              setChatHistory(prevHistory => {
                if (prevHistory.length > 0) {
                  // Only add messages that don't already exist
                  const existingIds = new Set(prevHistory.map(msg => msg.id));
                  const newMessages = state.chatHistory!.filter(msg => !existingIds.has(msg.id));
                  
                  if (newMessages.length === 0) {
                    console.log('No new messages to add to existing chat history');
                    return prevHistory;
                  }
                  
                  console.log(`Adding ${newMessages.length} messages to existing chat history`);
                  return [...prevHistory, ...newMessages];
                } else {
                  // If no existing history, just use the new one
                  console.log(`Setting complete chat history with ${state.chatHistory!.length} messages`);
                  return state.chatHistory!;
                }
              });
            }
            
            // Then set other values
            if (state.userPrompt) setUserPrompt(state.userPrompt);
            if (state.chatStarted !== undefined) setChatStarted(state.chatStarted);
            if (state.isLoadingResponse !== undefined) setIsLoadingResponse(state.isLoadingResponse);
            
            // Ensure UI is fully restored
            setShowPaywall(false);
            
            console.log('State restoration complete');
            
            // Set chat started if we have uploads but it wasn't explicitly set
            if (state.uploadedImages?.length && state.chatStarted === undefined) {
              console.log('Setting chat as started based on uploaded images');
              setChatStarted(true);
            }
          } catch (err) {
            console.error('Error applying state updates:', err);
          }
        }, 100);
      } catch (error) {
        console.error('Error handling state restoration:', error);
      }
    };

    // Add event listener for state restoration
    window.addEventListener('restoreState', handleStateRestoration as EventListener);
    
    // Listen for auth changes to potentially trigger UI updates
    const handleAuthChange = () => {
      if (!mounted) return;
      console.log('Auth state changed, checking if we need to update UI');
      
      // Check if we need to restore any saved state
      const savedState = sessionStorage.getItem('userState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          console.log('Found saved state in session storage:', state);
          // Let the app know we have state to restore
          if (state.uploadedImages?.length || state.chatHistory?.length) {
            console.log('Saved state contains uploaded images or chat history, setting chatStarted');
            setChatStarted(true);
          }
        } catch (error) {
          console.error('Error parsing saved state:', error);
        }
      }
    };
    
    // Listen for auth state changes
    window.addEventListener('authStateChanged', handleAuthChange as EventListener);

    // Clean up the event listeners
    return () => {
      mounted = false;
      window.removeEventListener('restoreState', handleStateRestoration as EventListener);
      window.removeEventListener('authStateChanged', handleAuthChange as EventListener);
    };
  }, [isAuthenticated, user]); // Only depend on auth state

  // Handle window resizing - make sure this is always called
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
  
  // Remove token purchase modal functionality - not needed in free mode
  useEffect(() => {
    // No-op, tokens are always available
  }, []);
  
  // Show a full-screen loading state until system is initialized
  if (isLoading) {
    console.log('Rendering loading spinner because isLoading is true');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-zinc-900 to-black">
        <LoadingSpinner variant="small" color="#ffffff" message="Loading..." />
      </div>
    );
  }
  
  console.log('Proceeding to render main app UI, isLoading:', isLoading);
  
  // Save state (for potential restoration) - no need for paywall anymore
  const saveState = () => {
    // Create a stable copy of the current state with all relevant data
    const currentState = {
      uploadedImages,
      chatHistory,
      brandProfileAnalyzed,
      userPrompt,
      chatStarted: !!uploadedImages.length || chatHistory.length > 0,
      isLoadingResponse: false,
      systemMessages,
      editingContext: {
        isEditing: false,
        targetMessageId: null,
        originalImage: null,
        originalPrompt: null
      }
    };
    
    // Save in a try-catch to handle potential serialization errors
    try {
      console.log('Saving complete state:', currentState);
      sessionStorage.setItem('userState', JSON.stringify(currentState));
      
      // Also save in localStorage as backup in case sessionStorage is cleared
      try {
        localStorage.setItem('dekave_state_backup', JSON.stringify({
          timestamp: Date.now(),
          hasState: true
        }));
      } catch (err) {
        console.error('Error saving state backup marker:', err);
      }
    } catch (error) {
      console.error('Error saving state:', error);
    }
  };

  // Handle token check - always returns true in free mode
  const handleTokenCheck = () => {
    return true; // Always have tokens in free mode
  };
  
  // Token utility functions
  
  // Calculate image tokens based on dimensions and detail level
  function calculateImageTokens(width: number, height: number, isHDQuality: boolean): number {
    if (!isHDQuality) {
      return 85; // Low detail is fixed cost
    }

    // Scale to fit in 2048x2048 square if needed
    let scaledWidth = width;
    let scaledHeight = height;
    if (width > 2048 || height > 2048) {
      const scale = Math.min(2048 / width, 2048 / height);
      scaledWidth = Math.floor(width * scale);
      scaledHeight = Math.floor(height * scale);
    }

    // Scale so shortest side is 768px
    const shortestSide = Math.min(scaledWidth, scaledHeight);
    const scale = 768 / shortestSide;
    scaledWidth = Math.floor(scaledWidth * scale);
    scaledHeight = Math.floor(scaledHeight * scale);

    // Count 512px squares
    const tilesX = Math.ceil(scaledWidth / 512);
    const tilesY = Math.ceil(scaledHeight / 512);
    const totalTiles = tilesX * tilesY;

    // Calculate final token cost
    return (totalTiles * 170) + 85;
  }

  const calculateTokenUsage = (prompt: string): number => {
    // Detect platform and size from prompt
    const platformSize = detectPlatformAndSize(prompt);
    
    // Calculate base image tokens based on platform size or default size
    const width = platformSize?.width || 1080;
    const height = platformSize?.height || 1080;
    const imageTokens = calculateImageTokens(width, height, isHDQuality);

    // Calculate prompt tokens (rough estimation)
    const promptTokens = Math.ceil(prompt.length / 4);

    // Base cost calculation
    let totalTokens = imageTokens + promptTokens;

    // Adjust for edit mode
    if (editingContext.isEditing) {
      // Editing uses the same image size but requires less processing
      totalTokens = Math.floor(totalTokens * 0.6); // 60% of new generation
      
      // Check for major edits
      const majorEditKeywords = ['completely', 'entirely', 'totally', 'redesign', 'overhaul'];
      const isMajorEdit = majorEditKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
      if (isMajorEdit) {
        totalTokens = Math.floor(totalTokens * (8/6)); // Adjust to 80% for major edits
      }
    }

    // Add complexity multiplier for sophisticated prompts
    const promptComplexity = Math.min(1.5, 1 + (prompt.length / 500)); // Max 50% increase
    totalTokens = Math.floor(totalTokens * promptComplexity);

    // Calculate token cost (simpler now)
    return Math.min(totalTokens, 10000); // Cap at 10,000 tokens per request
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map(file => ({
      id: `img-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`,
      url: URL.createObjectURL(file),
      size: file.size
    }));
    setUploadedImages(prev => [...prev, ...newImages.map(img => img.url)]);
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
    setUploadedImages(prev => [...prev, ...newImages.map(img => img.url)]);
  };
  
  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // No need to check tokens, always have enough
    if (!userPrompt.trim()) return;
    
    // Calculate token cost for this operation
    const tokenCost = calculateTokenUsage(userPrompt);
    
    setIsGenerating(true);
    
    // Add prompt to chat history
    setChatHistory(prev => [...prev, {
      id: `prompt-${Date.now()}`,
      type: 'prompt',
      content: editingContext.isEditing ? `Edit: ${userPrompt}` : userPrompt,
      timestamp: Date.now(),
      messageType: 'text'
    } as ChatMessage]);
    
    // Track token usage in localStorage directly
    const updatedTokens = Math.max(0, tokens - tokenCost);
    localStorage.setItem('dekave_temp_tokens', updatedTokens.toString());
    
    // Clear the input after submission
    setUserPrompt('');
    
    try {
      // Make actual API call with user's temporary ID
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: uploadedImages[0],
          prompt: userPrompt,
          userId: user?.id,
          isHDQuality,
          resetConversation: false
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate content');
      }
      
      const result = await response.json();
      
      // Add the generated response to chat history
      if (result.adImageUrl) {
        setChatHistory(prev => [...prev, {
          id: `result-${Date.now()}`,
          type: 'result',
          content: result.adImageUrl,
          timestamp: Date.now(),
          messageType: 'image'
        }]);
      }
      
      if (result.adDescription) {
        setChatHistory(prev => [...prev, {
          id: `desc-${Date.now()}`,
          type: 'result',
          content: result.adDescription,
          timestamp: Date.now(),
          messageType: 'text'
        }]);
      }
      
      // Refresh token count to show updated values
      await refreshTokenCount();
    } catch (error) {
      console.error('Error generating content:', error);
      setChatHistory(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'result',
        content: "Sorry, there was an error generating your ad. Please try again.",
        timestamp: Date.now(),
        messageType: 'text'
      }]);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Replace token purchase with token refresh info
  const handleTokenRefreshInfo = () => {
    // Show info about token refresh
    alert("Tokens refresh daily! You have " + tokens + " tokens remaining today.");
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

  // Function to detect platform and content type from prompt
  function detectPlatformAndSize(prompt: string): PlatformSize | null {
    const promptLower = prompt.toLowerCase();
    
    // Platform detection
    let platform: SocialPlatform | null = null;
    if (promptLower.includes('instagram') || promptLower.includes('ig')) platform = 'instagram';
    else if (promptLower.includes('facebook') || promptLower.includes('fb')) platform = 'facebook';
    else if (promptLower.includes('linkedin')) platform = 'linkedin';
    else if (promptLower.includes('twitter') || promptLower.includes('x.com')) platform = 'twitter';
    
    if (!platform) return null;
    
    // Content type detection
    const isStory = promptLower.includes('story') || promptLower.includes('stories');
    const isAd = promptLower.includes('ad') || promptLower.includes('advertisement');
    const isCarousel = promptLower.includes('carousel') || promptLower.includes('swipe');
    const isLandscape = promptLower.includes('landscape') || promptLower.includes('horizontal');
    
    // Determine the appropriate size based on platform and content type
    if (platform === 'instagram') {
      if (isStory) return PLATFORM_SIZES.instagram.story;
      if (isAd && isLandscape) return PLATFORM_SIZES.instagram.ad_landscape;
      if (isAd) return PLATFORM_SIZES.instagram.ad_square;
      return PLATFORM_SIZES.instagram.post; // Default to square post
    }
    
    if (platform === 'facebook') {
      if (isAd) return PLATFORM_SIZES.facebook.ad;
      return PLATFORM_SIZES.facebook.post;
    }
    
    if (platform === 'linkedin') {
      if (isStory) return PLATFORM_SIZES.linkedin.story;
      if (isCarousel) return PLATFORM_SIZES.linkedin.carousel;
      return PLATFORM_SIZES.linkedin.post;
    }
    
    if (platform === 'twitter') {
      if (isAd && !isLandscape) return PLATFORM_SIZES.twitter.ad_square;
      if (isAd) return PLATFORM_SIZES.twitter.ad_landscape;
      return PLATFORM_SIZES.twitter.tweet;
    }
    
    return null;
  }

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
          {user && (
            <button 
              onClick={handleTokenRefreshInfo}
              className={`text-sm bg-zinc-800/50 backdrop-blur-sm rounded-full px-3 py-1.5 hover:bg-zinc-700/50 transition-colors flex items-center ${tokens < 10000 ? 'text-amber-400' : 'text-zinc-300'}`}
            >
              <span className="font-medium">{tokens.toLocaleString()}</span>
              <span className="ml-1">tokens</span>
              {tokens < 10000 && (
                <span className="ml-1.5 text-amber-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </button>
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
                      className="rounded-full bg-zinc-800/80 backdrop-blur-sm w-8 h-8 flex items-center justify-center hover:bg-zinc-700/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isGenerating || isAnalyzingBrand}
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
                      key={image}
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
                      <img src={image} alt="Uploaded product" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => {
                          setUploadedImages(prev => prev.filter(img => img !== image));
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
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start mb-4">
                          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl rounded-tl-sm p-3 max-w-[90%] relative group">
                            {item.messageType === 'text' ? (
                              <p className="text-white">{item.content}</p>
                            ) : (
                              <>
                                <img src={item.content} alt="Generated result" className="rounded-lg max-h-[450px] w-auto" />
                                <button
                                  onClick={() => {
                                    setEditingContext({
                                      isEditing: true,
                                      targetMessageId: item.id,
                                      originalImage: item.content,
                                      originalPrompt: chatHistory
                                        .slice(0, chatHistory.findIndex(msg => msg.id === item.id))
                                        .filter(msg => msg.type === 'prompt')
                                        .pop()?.content || null
                                    });
                                    // Focus the textarea
                                    const textarea = document.querySelector('textarea');
                                    if (textarea) {
                                      textarea.focus();
                                    }
                                  }}
                                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                >
                                  Edit
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </AnimatePresence>
      </div>

      {/* Loading indicators */}
      {(isAnalyzingBrand || isGenerating) && (
        <motion.div 
          className="flex flex-col items-center justify-center py-8 w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <LoadingSpinner 
            variant="small" 
            color="#ffffff" 
            message={isAnalyzingBrand ? "Analyzing your brand profile..." : "Generating your ad..."} 
          />
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
            {/* Editing Indicator */}
            {editingContext.isEditing && (
              <div className="mb-2 px-4 py-2 bg-zinc-800/50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span className="text-sm text-zinc-400">Editing previous image</span>
                </div>
                <button
                  onClick={() => setEditingContext({
                    isEditing: false,
                    targetMessageId: null,
                    originalImage: null,
                    originalPrompt: null
                  })}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}
            
            <div className="relative rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/10 overflow-hidden">
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder={
                  editingContext.isEditing
                    ? "Describe how you'd like to modify this image..."
                    : brandProfileAnalyzed 
                      ? "Describe the ad you want to create..." 
                      : "Upload a brand image to begin..."
                }
                className="w-full bg-transparent border-none px-6 py-4 text-white placeholder-zinc-500 focus:outline-none resize-none"
                style={{minHeight: '56px'}}
                disabled={isGenerating || isAnalyzingBrand}
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
                  className="rounded-full bg-zinc-800/80 backdrop-blur-sm w-8 h-8 flex items-center justify-center hover:bg-zinc-700/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isGenerating || isAnalyzingBrand}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </button>
                
                <button 
                  onClick={(e) => handlePromptSubmit(e)}
                  disabled={!userPrompt.trim() || !uploadedImages.length || isGenerating}
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
      </AnimatePresence>
    </div>
  );
}

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
  messageType: 'text' | 'image' | 'mixed';
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

async function blobUrlToBase64(blobUrl: string): Promise<string> {
  try {
    // Check if it's a blob URL
    if (!blobUrl.startsWith('blob:')) {
      console.log('Not a blob URL, returning as is:', blobUrl.substring(0, 30) + '...');
      return blobUrl;
    }
    
    console.log('Converting blob URL to base64:', blobUrl.substring(0, 30) + '...');
    
    // Try to fetch the blob
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          console.log('Successfully converted blob to base64 data URL');
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return a string'));
        }
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(new Error('FileReader error: ' + (err.target as any)?.error?.message || 'Unknown error'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting blob to base64:', error);
    throw new Error(`Failed to convert image URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
  // Add local token state to track changes
  const [localTokens, setLocalTokens] = useState<number>(tokens);
  // Add state for staged images (images waiting to be sent with prompt)
  const [stagedImage, setStagedImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize and sync local tokens with auth tokens
  useEffect(() => {
    setLocalTokens(tokens);
  }, [tokens]);
  
  // Use a ref to store the handleImageUpload function
  const handleImageUploadRef = useRef<any>(null);
  
  // Add the file input setup effect right here, in the same position as before
  useEffect(() => {
    console.log('Setting up file input element');
    // Create file input if it doesn't exist
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.style.display = 'none';
      
      // Add to DOM now, add event listener later
      document.body.appendChild(input);
      
      // Store reference
      fileInputRef.current = input;
      
      // Return cleanup function
      return () => {
        if (fileInputRef.current) {
          // Only cleanup if it's still in the DOM
          try {
            document.body.removeChild(fileInputRef.current);
          } catch (e) {
            console.error('Error removing file input:', e);
          }
        }
      };
    }
    
    return undefined; // Return undefined if no cleanup is needed
  }, []); // Empty dependency array
  
  // Attach the event handler after it's defined
  useEffect(() => {
    // Skip if no fileInput or no handler
    if (!fileInputRef.current || !handleImageUploadRef.current) return;
    
    const handleChange = (e: Event) => {
      if (handleImageUploadRef.current) {
        handleImageUploadRef.current(e);
      }
    };
    
    // Add event listener
    fileInputRef.current.addEventListener('change', handleChange);
    
    // Return cleanup function
    return () => {
      if (fileInputRef.current) {
        fileInputRef.current.removeEventListener('change', handleChange);
      }
    };
  }, [handleImageUploadRef.current]); // Depend on the handler ref
  
  // Log temporary user state for debugging
  useEffect(() => {
    console.log('Auth state in Home component:', { 
      isAuthenticated, 
      user: user ? `User ${user.id}` : 'No user', 
      tokens, 
      isLoading 
    });
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

  // Handle token check - always returns true in free mode
  
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
  
  // Deduct tokens and update UI immediately
  const deductTokens = (amount: number) => {
    const newAmount = Math.max(0, localTokens - amount);
    setLocalTokens(newAmount);
    localStorage.setItem('dekave_temp_tokens', newAmount.toString());
  };

  // Calculate token cost for brand analysis
  const calculateBrandAnalysisTokens = (): number => {
    // Brand analysis has a fixed cost
    return 5000;
  };

  // Add a helper function to add the brand analysis completion message
  const addBrandAnalysisCompletionMessage = () => {
    // Generate a stable ID for system message to prevent duplicates
    const messageId = `system-brand-analysis-${Date.now()}`;
    
    // Check if a similar message already exists before adding
    setChatHistory(prev => {
      // Check if a similar welcome message already exists
      const hasWelcomeMessage = prev.some(msg => 
        msg.type === 'result' && 
        msg.content.includes("I understand your brand profile")
      );
      
      // Only add if no similar message exists
      if (!hasWelcomeMessage) {
        console.log('Adding brand analysis completion message');
        return [...prev, {
          id: messageId,
          type: 'result',
          content: "I understand your brand profile. Now, tell me what kind of ad you'd like to create.",
          timestamp: Date.now(),
          messageType: 'text'
        } as ChatMessage];
      }
      
      console.log('Brand welcome message already exists, skipping duplicate');
      return prev;
    });
  };

  // Modify handleImageUpload to handle both brand images and product images
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      
      const newImages = files.map(file => ({
        id: `img-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`,
        url: URL.createObjectURL(file),
        size: file.size
      }));
      
      // If brand profile is not analyzed yet, proceed with brand analysis
      if (!brandProfileAnalyzed) {
        setUploadedImages(prev => [...prev, ...newImages.map(img => img.url)]);
        setShowDropzone(false);
        
        // Analyze brand profile for the first image
        if (newImages.length > 0) {
          setIsAnalyzingBrand(true);
          
          // Calculate and deduct tokens for brand analysis
          const brandAnalysisTokens = calculateBrandAnalysisTokens();
          deductTokens(brandAnalysisTokens);
          
          try {
            const profile = await extractBrandProfile(newImages[0].url);
            
            // In free mode, user might be available or might be temporary
            const userId = user?.id || localStorage.getItem('dekave_temp_user') 
              ? JSON.parse(localStorage.getItem('dekave_temp_user') || '{}').id
              : null;
              
            if (profile && userId) {
              await saveBrandProfile(userId, profile);
            } else if (profile) {
              // If we can't save the profile, just continue without saving
              console.log('Brand profile analyzed but not saved due to missing user ID');
            }
            
            // Use the helper function instead of direct setChatHistory
            addBrandAnalysisCompletionMessage();
          } catch (error) {
            console.error('Error analyzing brand profile:', error);
            setChatHistory(prev => [...prev, {
              id: `error-${Date.now()}`,
              type: 'result',
              content: "Sorry, there was an error analyzing your brand profile. You can still continue.",
              timestamp: Date.now(),
              messageType: 'text'
            } as ChatMessage]);
          } finally {
            // Always ensure we reset states even if there's an error
            setIsAnalyzingBrand(false);
            setBrandProfileAnalyzed(true);
            setIsGenerating(false);
          }
        }
        
        // Set chat started to true
        setChatStarted(true);
      } else {
        // Brand is already analyzed, so stage the image for prompt submission
        console.log('Staging image for prompt submission');
        // Use only the first image if multiple are selected
        setStagedImage(newImages[0].url);
      }
      
      // Track image upload event
      trackEvent(EventType.IMAGE_UPLOAD, {
        count: files.length,
        totalSize: files.reduce((total, file) => total + file.size, 0),
        types: files.map(file => file.type)
      });
      
      // Make sure file input is reset
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      // Reset states to ensure UI is not stuck
      setIsAnalyzingBrand(false);
      setIsGenerating(false);
    }
  };
  
  // Store the function in a ref so we can access it in useEffect
  handleImageUploadRef.current = handleImageUpload;
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setShowDropzone(false);
    
    // Filter only image files
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    
    const newImages = files.map(file => ({
      id: `img-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`,
      url: URL.createObjectURL(file),
      size: file.size
    }));
    
    setUploadedImages(prev => [...prev, ...newImages.map(img => img.url)]);
    
    // Analyze brand profile if this is the first image
    if (!brandProfileAnalyzed && newImages.length > 0) {
      setIsAnalyzingBrand(true);
      
      // Calculate and deduct tokens for brand analysis
      const brandAnalysisTokens = calculateBrandAnalysisTokens();
      deductTokens(brandAnalysisTokens);
      
      // Analyze brand profile from the dropped image
      (async () => {
        try {
          const profile = await extractBrandProfile(newImages[0].url);
          
          // In free mode, user might be available or might be temporary
          const userId = user?.id || localStorage.getItem('dekave_temp_user') 
            ? JSON.parse(localStorage.getItem('dekave_temp_user') || '{}').id
            : null;
            
          if (profile && userId) {
            await saveBrandProfile(userId, profile);
          } else if (profile) {
            // If we can't save the profile, just continue without saving
            console.log('Brand profile analyzed but not saved due to missing user ID');
          }
          
          // Use the helper function instead of direct setChatHistory
          addBrandAnalysisCompletionMessage();
        } catch (error) {
          console.error('Error analyzing brand profile:', error);
          setChatHistory(prev => [...prev, {
            id: `error-${Date.now()}`,
            type: 'result',
            content: "Sorry, there was an error analyzing your brand profile. You can still continue.",
            timestamp: Date.now(),
            messageType: 'text'
          } as ChatMessage]);
        } finally {
          // Always ensure we reset states even if there's an error
          setIsAnalyzingBrand(false);
          setBrandProfileAnalyzed(true);
          setIsGenerating(false);
        }
      })();
    }
    
    // Set chat started to true
    setChatStarted(true);
    
    // Track image upload event
    trackEvent(EventType.IMAGE_UPLOAD, {
      count: files.length,
      totalSize: files.reduce((total, file) => total + file.size, 0),
      types: files.map(file => file.type)
    });
  };
  
  // Modify the handlePromptSubmit function to convert blob URLs to base64
  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If no prompt and no staged image, do nothing
    if (!userPrompt.trim() && !stagedImage) return;
    
    try {
      // Calculate token cost for this operation
      const tokenCost = calculateTokenUsage(userPrompt);
      
      // Deduct tokens immediately to update UI
      deductTokens(tokenCost);
      
      setIsGenerating(true);
      
      // If there's a staged image, add it to the chat history but not to uploadedImages again
      let processedImageUrl;
      
      if (stagedImage) {
        // Check if this image is already in uploadedImages to prevent duplication
        if (!uploadedImages.includes(stagedImage)) {
          setUploadedImages(prev => [...prev, stagedImage]);
        }
        
        // Generate a unique ID for the message
        const imageMessageId = `image-${Date.now()}`;
        
        // Add staged image to chat history, checking for duplicates
        setChatHistory(prev => {
          // Check if this image was already added recently (within last 5 seconds)
          const recentImageExists = prev.some(msg => 
            msg.type === 'prompt' && 
            msg.messageType === 'image' && 
            msg.content === stagedImage &&
            Date.now() - msg.timestamp < 5000
          );
          
          if (recentImageExists) {
            console.log('Skipping duplicate image in chat history');
            return prev;
          }
          
          return [...prev, {
            id: imageMessageId,
            type: 'prompt',
            content: stagedImage,
            timestamp: Date.now(),
            messageType: 'image'
          } as ChatMessage];
        });
      }
      
      // Add text prompt to chat history if there is one
      if (userPrompt.trim()) {
        setChatHistory(prev => [...prev, {
          id: `prompt-${Date.now()}`,
          type: 'prompt',
          content: editingContext.isEditing ? `Edit: ${userPrompt}` : userPrompt,
          timestamp: Date.now(),
          messageType: 'text'
        } as ChatMessage]);
      }
      
      // Store current prompt before clearing
      const currentPrompt = userPrompt;
      
      // Clear the input and staged image after submission
      setUserPrompt('');
      setStagedImage(null);
      
      // Convert the image URL to base64 before sending to API
      try {
        const imageToUse = stagedImage || uploadedImages[0];
        processedImageUrl = await blobUrlToBase64(imageToUse);
        console.log('Image prepared for API:', processedImageUrl.substring(0, 30) + '...');
      } catch (conversionError) {
        console.error('Error converting image for API:', conversionError);
        throw new Error('Failed to process image for generation');
      }
      
      // Make actual API call with user's temporary ID
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: processedImageUrl,
          prompt: currentPrompt,
          userId: user?.id || (localStorage.getItem('dekave_temp_user') ? 
            JSON.parse(localStorage.getItem('dekave_temp_user') || '{}').id : 'temp_user'),
          isHDQuality,
          resetConversation: false
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate content' }));
        throw new Error(errorData.error || 'Failed to generate content');
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
      
      // Refresh token count to show updated values from backend
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
    alert("Tokens refresh daily! You have " + localTokens + " tokens remaining today.");
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

  // Modify the StagedImagePreview component to make the image smaller
  const StagedImagePreview = () => {
    if (!stagedImage) return null;
    
    return (
      <div className="flex justify-start my-2">
        <div className="relative rounded-lg overflow-hidden border border-white/20" style={{ 
          width: windowWidth < 640 ? '60px' : '800px',
          height: windowWidth < 640 ? '60px' : '80px',
        }}>
          <img 
            src={stagedImage} 
            alt="Staged image" 
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => setStagedImage(null)}
            className="absolute top-1 right-1 bg-black/70 hover:bg-black/90 text-white rounded-full p-1"
            style={{ width: '18px', height: '18px' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // Add a helper function to group chat messages
  const getGroupedChatMessages = () => {
    const groupedMessages: Array<{
      id: string;
      type: 'prompt' | 'result';
      content: any; // Use any for flexibility with content type
      timestamp: number;
      messageType: 'text' | 'image' | 'mixed';
      hasMultipleImages?: boolean;
    }> = [];
    
    let i = 0;
    while (i < chatHistory.length) {
      const current = chatHistory[i];
      
      // Check if the next message is from the same user and close in time (within 5 seconds)
      if (i + 1 < chatHistory.length && 
          chatHistory[i + 1].type === current.type && 
          chatHistory[i + 1].timestamp - current.timestamp < 5000) {
        
        // Start a group with the current message
        let group: any = {
          id: current.id,
          type: current.type,
          timestamp: current.timestamp,
          messageType: current.messageType,
          hasMultipleImages: false
        };
        
        // Initialize content based on the first message's type
        if (current.messageType === 'image') {
          group.content = { images: [current.content], text: '' };
        } else {
          group.content = { images: [], text: current.content };
        }
        
        // Collect consecutive messages from the same user
        let j = i + 1;
        let hasText = current.messageType === 'text';
        let hasImage = current.messageType === 'image';
        let imageCount = hasImage ? 1 : 0;
        
        while (j < chatHistory.length && 
               chatHistory[j].type === current.type && 
               chatHistory[j].timestamp - chatHistory[j-1].timestamp < 5000) {
          
          if (chatHistory[j].messageType === 'image') {
            hasImage = true;
            imageCount++;
            group.content.images.push(chatHistory[j].content);
          } else {
            hasText = true;
            if (group.content.text) {
              group.content.text += "\n\n" + chatHistory[j].content;
            } else {
              group.content.text = chatHistory[j].content;
            }
          }
          
          j++;
        }
        
        // Update group properties
        if (hasText && hasImage) {
          group.messageType = 'mixed';
        } else if (hasText) {
          group.content = group.content.text;
        } else if (hasImage && group.content.images.length === 1) {
          group.content = group.content.images[0];
        } else if (hasImage) {
          group.content = group.content.images;
        }
        
        group.hasMultipleImages = imageCount > 1;
        
        // Add the group to the result
        groupedMessages.push(group);
        
        // Skip the messages we've processed
        i = j;
      } else {
        // Add the current message as is
        groupedMessages.push(current);
        i++;
      }
    }
    
    return groupedMessages;
  };

  // Update the chat history rendering with grouped messages
  const groupedChatMessages = getGroupedChatMessages();

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
              className={`text-sm bg-zinc-800/50 backdrop-blur-sm rounded-full px-3 py-1.5 hover:bg-zinc-700/80 transition-colors flex items-center ${localTokens < 10000 ? 'text-amber-400' : 'text-zinc-300'} ${windowWidth < 768 ? 'md:block hidden' : ''}`}
            >
              <span className="font-medium">{localTokens.toLocaleString()}</span>
              <span className="ml-1">tokens</span>
              {localTokens < 10000 && (
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
      
      {/* Mobile tokens display below top toolbar */}
      {user && windowWidth < 768 && (
        <motion.div 
          className="flex justify-center items-center mb-2 z-10"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div 
            onClick={handleTokenRefreshInfo}
            className={`text-sm bg-zinc-800/50 backdrop-blur-sm rounded-full px-3 py-1 ${localTokens < 10000 ? 'text-amber-400' : 'text-zinc-300'} flex items-center`}
          >
            <span className="font-medium">{localTokens.toLocaleString()}</span>
            <span className="ml-1">tokens</span>
            {localTokens < 10000 && (
              <span className="ml-1.5 text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>
        </motion.div>
      )}
      
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
                      onClick={() => {
                        console.log('Upload button clicked. States:', {
                          isGenerating,
                          isAnalyzingBrand,
                          brandProfileAnalyzed,
                          hasImages: uploadedImages.length > 0,
                          chatStarted,
                          fileInputRef: !!fileInputRef.current
                        });
                        
                        // Ensure file input exists
                        if (fileInputRef.current) {
                          fileInputRef.current.click();
                        } else {
                          // Create a temporary input if ref is null
                          console.log('Creating temporary file input element');
                          const tempInput = document.createElement('input');
                          tempInput.type = 'file';
                          tempInput.accept = 'image/*';
                          tempInput.multiple = true;
                          tempInput.style.display = 'none';
                          
                          // Add change listener
                          tempInput.addEventListener('change', (e) => {
                            handleImageUpload(e as any);
                            // Clean up
                            document.body.removeChild(tempInput);
                          }, { once: true });
                          
                          // Add to DOM and trigger click
                          document.body.appendChild(tempInput);
                          tempInput.click();
                        }
                      }}
                      className="rounded-full bg-zinc-800/80 backdrop-blur-sm w-8 h-8 flex items-center justify-center hover:bg-zinc-700/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isGenerating}
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
            {/* Uploaded Images Grid - Only show the brand image */}
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
                  {/* Only display the original brand image (the first uploaded image) */}
                  {uploadedImages.length > 0 && (
                    <motion.div
                      key={uploadedImages[0]} // Use the first image (brand image)
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="relative overflow-hidden border border-white/10 rounded-lg"
                      style={{ 
                        width: windowWidth < 640 ? '70px' : '90px',
                        height: windowWidth < 640 ? '70px' : '90px',
                      }}
                    >
                      <img src={uploadedImages[0]} alt="Brand image" className="w-full h-full object-cover" />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Chat History - Only show when we have chat history */}
            {chatHistory.length > 0 && (
              <div className="flex-1 space-y-6 w-full">
                <AnimatePresence mode="popLayout">
                  {groupedChatMessages.map((item) => (
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
                          <div className="bg-zinc-800 rounded-2xl rounded-tr-sm px-6 py-4" style={{ 
                            maxWidth: windowWidth < 640 ? '85%' : '350px' 
                          }}>
                            {item.messageType === 'text' ? (
                              <p className="text-white">{item.content}</p>
                            ) : item.messageType === 'image' ? (
                              item.hasMultipleImages ? (
                                // Grid layout for multiple images
                                <div className="grid grid-cols-2 gap-2">
                                  {Array.isArray(item.content) && item.content.map((imageUrl, index) => (
                                    <img 
                                      key={index}
                                      src={imageUrl} 
                                      alt={`User uploaded ${index + 1}`}
                                      className="rounded-lg w-full object-cover"
                                      style={{
                                        height: windowWidth < 640 ? '120px' : '150px',
                                        width: '100%'
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : (
                                // Single image
                                <img 
                                  src={Array.isArray(item.content) ? item.content[0] : item.content} 
                                  alt="User uploaded"
                                  className="rounded-lg w-full object-cover"
                                  style={{
                                    height: windowWidth < 640 ? '120px' : '150px',
                                    width: '100%'
                                  }}
                                />
                              )
                            ) : (
                              // Mixed content (text + image)
                              <div className="flex flex-col space-y-3">
                                {typeof item.content === 'object' ? (
                                  <>
                                    {/* Check if it's an array or has images property */}
                                    {Array.isArray(item.content) && (
                                      // If it's an array of images
                                      <div className="grid grid-cols-2 gap-2 mb-3">
                                        {item.content.map((imageUrl: string, index: number) => (
                                          <img 
                                            key={index}
                                            src={imageUrl} 
                                            alt={`User uploaded ${index + 1}`}
                                            className="rounded-lg w-full object-cover"
                                            style={{
                                              height: windowWidth < 640 ? '120px' : '150px',
                                              width: '100%'
                                            }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                    
                                    {!Array.isArray(item.content) && item.content.images && Array.isArray(item.content.images) && (
                                      // If it has images property
                                      item.hasMultipleImages ? (
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                          {item.content.images.map((imageUrl: string, index: number) => (
                                            <img 
                                              key={index}
                                              src={imageUrl} 
                                              alt={`User uploaded ${index + 1}`}
                                              className="rounded-lg w-full object-cover"
                                              style={{
                                                height: windowWidth < 640 ? '120px' : '150px',
                                                width: '100%'
                                              }}
                                            />
                                          ))}
                                        </div>
                                      ) : (
                                        <img 
                                          src={item.content.images[0]} 
                                          alt="User uploaded"
                                          className="rounded-lg w-full object-cover mb-3"
                                          style={{
                                            height: windowWidth < 640 ? '120px' : '150px',
                                            width: '100%'
                                          }}
                                        />
                                      )
                                    )}
                                    
                                    {/* Text displayed after the image(s) */}
                                    {typeof item.content === 'object' && 'text' in item.content && item.content.text && (
                                      <p className="text-white">{item.content.text}</p>
                                    )}
                                  </>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start mb-4">
                          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl rounded-tl-sm p-3 max-w-[90%] relative group">
                            {item.messageType === 'text' ? (
                              <p className="text-white">{item.content}</p>
                            ) : item.messageType === 'image' ? (
                              <div className="relative">
                                <img 
                                  src={Array.isArray(item.content) ? item.content[0] : item.content}
                                  alt="Generated result" 
                                  className="rounded-lg w-full" 
                                  style={{
                                    maxHeight: '450px',
                                    width: '100%',
                                    objectFit: 'contain'
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    // Get the actual image URL regardless of content structure
                                    let originalImageUrl = '';
                                    if (typeof item.content === 'string') {
                                      originalImageUrl = item.content;
                                    } else if (Array.isArray(item.content) && item.content.length > 0) {
                                      originalImageUrl = item.content[0];
                                    } else if (typeof item.content === 'object' && 'images' in item.content && item.content.images.length > 0) {
                                      originalImageUrl = item.content.images[0];
                                    }
                                    
                                    setEditingContext({
                                      isEditing: true,
                                      targetMessageId: item.id,
                                      originalImage: originalImageUrl,
                                      originalPrompt: chatHistory
                                        .slice(0, chatHistory.findIndex(msg => msg.id === item.id))
                                        .filter(msg => msg.type === 'prompt')
                                        .pop()?.content || null
                                    });
                                    const textarea = document.querySelector('textarea');
                                    if (textarea) textarea.focus();
                                  }}
                                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                >
                                  Edit
                                </button>
                              </div>
                            ) : (
                              // Mixed message from assistant (typically doesn't happen but added for completeness)
                              <div className="flex flex-col space-y-3">
                                {typeof item.content === 'object' ? (
                                  <>
                                    {/* Check if it's an array or has images property */}
                                    {Array.isArray(item.content) && (
                                      // If it's an array of images
                                      <div className="grid grid-cols-2 gap-2 mb-3">
                                        {item.content.map((imageUrl: string, index: number) => (
                                          <img 
                                            key={index}
                                            src={imageUrl} 
                                            alt={`User uploaded ${index + 1}`}
                                            className="rounded-lg w-full object-cover"
                                            style={{
                                              height: windowWidth < 640 ? '120px' : '150px',
                                              width: '100%'
                                            }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                    
                                    {!Array.isArray(item.content) && item.content.images && Array.isArray(item.content.images) && (
                                      // If it has images property
                                      item.hasMultipleImages ? (
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                          {item.content.images.map((imageUrl: string, index: number) => (
                                            <img 
                                              key={index}
                                              src={imageUrl} 
                                              alt={`User uploaded ${index + 1}`}
                                              className="rounded-lg w-full object-cover"
                                              style={{
                                                height: windowWidth < 640 ? '120px' : '150px',
                                                width: '100%'
                                              }}
                                            />
                                          ))}
                                        </div>
                                      ) : (
                                        <img 
                                          src={item.content.images[0]} 
                                          alt="User uploaded"
                                          className="rounded-lg w-full object-cover mb-3"
                                          style={{
                                            height: windowWidth < 640 ? '120px' : '150px',
                                            width: '100%'
                                          }}
                                        />
                                      )
                                    )}
                                    
                                    {/* Text displayed after the image(s) */}
                                    {typeof item.content === 'object' && 'text' in item.content && item.content.text && (
                                      <p className="text-white">{item.content.text}</p>
                                    )}
                                  </>
                                ) : null}
                              </div>
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
              {/* Staged Image Preview */}
              <StagedImagePreview />
              
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder={
                  stagedImage 
                    ? "Describe what kind of ad you want with this image..." 
                    : editingContext.isEditing
                      ? "Describe how you'd like to modify this image..."
                      : brandProfileAnalyzed 
                        ? "Describe the ad you want to create..." 
                        : "Upload a brand image to begin..."
                }
                className="w-full bg-transparent border-none px-6 py-4 text-white placeholder-zinc-500 focus:outline-none resize-none"
                style={{minHeight: '56px'}}
                disabled={isGenerating}
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
                
                <button 
                  onClick={() => {
                    console.log('Upload button clicked. States:', {
                      isGenerating,
                      isAnalyzingBrand,
                      brandProfileAnalyzed,
                      hasImages: uploadedImages.length > 0,
                      chatStarted,
                      fileInputRef: !!fileInputRef.current
                    });
                    
                    // Ensure file input exists
                    if (fileInputRef.current) {
                      fileInputRef.current.click();
                    } else {
                      // Create a temporary input if ref is null
                      console.log('Creating temporary file input element');
                      const tempInput = document.createElement('input');
                      tempInput.type = 'file';
                      tempInput.accept = 'image/*';
                      tempInput.multiple = true;
                      tempInput.style.display = 'none';
                      
                      // Add change listener
                      tempInput.addEventListener('change', (e) => {
                        handleImageUpload(e as any);
                        // Clean up
                        document.body.removeChild(tempInput);
                      }, { once: true });
                      
                      // Add to DOM and trigger click
                      document.body.appendChild(tempInput);
                      tempInput.click();
                    }
                  }}
                  className="rounded-full bg-zinc-800/80 backdrop-blur-sm w-8 h-8 flex items-center justify-center hover:bg-zinc-700/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isGenerating}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </button>
                
                <button 
                  onClick={(e) => handlePromptSubmit(e)}
                  disabled={(!userPrompt.trim() && !stagedImage) || !uploadedImages.length || isGenerating}
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

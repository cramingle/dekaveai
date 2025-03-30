import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';

// Add interface for extended session user
interface ExtendedUser {
  hasStoredConversation?: boolean;
  conversationLastUsed?: string;
  [key: string]: any; // For other properties
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokensUsed?: number;
}

interface ChatProps {
  onSubmit: (prompt: string, resetContext?: boolean) => Promise<void>;
  messages: Message[];
  isLoading: boolean;
  resetConversation: () => void;
}

export function Chat({ onSubmit, messages, isLoading, resetConversation }: ChatProps) {
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState('');
  const [hasStoredContext, setHasStoredContext] = useState(false);
  
  useEffect(() => {
    // Check if user has stored conversation - use type assertion
    const user = session?.user as ExtendedUser | undefined;
    if (user?.hasStoredConversation) {
      setHasStoredContext(true);
    }
  }, [session]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    
    // Submit the prompt and clear input
    await onSubmit(prompt);
    setPrompt('');
  };
  
  const handleResetContext = () => {
    // Reset conversation context
    resetConversation();
    setHasStoredContext(false);
  };
  
  const handleContinueContext = () => {
    // Continue with existing context
    setHasStoredContext(false);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Context recovery prompt */}
      {hasStoredContext && messages.length === 0 && (
        <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
          <p className="text-white mb-2">
            You have a previous conversation. Would you like to continue where you left off?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleContinueContext}
              className="px-4 py-2 bg-white text-black rounded-md text-sm font-medium"
            >
              Continue Conversation
            </button>
            <button
              onClick={handleResetContext}
              className="px-4 py-2 bg-zinc-700 text-white rounded-md text-sm font-medium"
            >
              Start New Conversation
            </button>
          </div>
        </div>
      )}
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${
              message.type === 'user' 
                ? 'bg-zinc-800 ml-auto rounded-tr-sm' 
                : 'bg-zinc-900/50 mr-auto rounded-tl-sm'
            } rounded-2xl px-4 py-3 max-w-[85%]`}
          >
            <p className="text-white">{message.content}</p>
            {message.tokensUsed && (
              <p className="text-xs text-zinc-500 mt-1 text-right">
                {message.tokensUsed} tokens used
              </p>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        )}
      </div>
      
      {/* Input area */}
      <form onSubmit={handleSubmit} className="mt-auto">
        <div className="relative rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/10 overflow-hidden">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your message..."
            className="w-full bg-transparent border-none px-4 py-3 text-white placeholder-zinc-500 focus:outline-none resize-none"
            style={{ minHeight: '56px' }}
            disabled={isLoading}
          />
          
          <div className="absolute bottom-2 right-2 flex space-x-2">
            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="rounded-full bg-white text-black w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
} 
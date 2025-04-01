import { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

type PromptInputProps = {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
};

export function PromptInput({ onSubmit, isLoading = false, disabled = false }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt.trim());
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto mt-6">
      <div className="space-y-4">
        <label 
          htmlFor="prompt" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Describe your desired ad
        </label>
        
        <textarea
          id="prompt"
          name="prompt"
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm 
                   focus:border-black focus:ring-1 focus:ring-black dark:focus:border-white dark:focus:ring-white dark:bg-gray-800"
          placeholder="E.g., Create a sleek product ad with a modern vibe on a white background"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={disabled || isLoading}
        />
        
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={!prompt.trim() || disabled || isLoading}
            className={`px-4 py-2 rounded-md text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2
                      ${!prompt.trim() || disabled 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-black hover:bg-gray-800 focus:ring-black dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:focus:ring-white'
                      }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center w-8 h-8">
                <LoadingSpinner size={24} color="#000000" />
              </div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </form>
  );
} 
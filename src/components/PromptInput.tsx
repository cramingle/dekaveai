import { useState } from 'react';

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
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white dark:text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Ad'
            )}
          </button>
        </div>
      </div>
    </form>
  );
} 
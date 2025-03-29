import { useState } from 'react';

type ResultsViewProps = {
  enhancedImageUrl: string;
  adImageUrl: string;
  tokensLeft: number;
  prompt: string;
  onShare: (imageUrl: string) => void;
  onDownload: (imageUrl: string) => void;
  onEdit: () => void;
  editsLeft: number;
};

export function ResultsView({
  enhancedImageUrl,
  adImageUrl,
  tokensLeft,
  prompt,
  onShare,
  onDownload,
  onEdit,
  editsLeft
}: ResultsViewProps) {
  const [selectedTab, setSelectedTab] = useState<'enhanced' | 'ad'>('ad');
  
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Your Generated Results
        </h2>
        <div className="bg-gray-100 dark:bg-gray-800 text-black dark:text-white px-3 py-1 rounded-full text-sm">
          Tokens Left: {tokensLeft}/10
        </div>
      </div>
      
      <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4 mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Your prompt:</span> {prompt}
        </p>
      </div>
      
      <div className="mb-4">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            className={`px-4 py-2 font-medium text-sm focus:outline-none ${
              selectedTab === 'ad' 
                ? 'text-black border-b-2 border-black dark:text-white dark:border-white' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setSelectedTab('ad')}
          >
            Marketing Ad
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm focus:outline-none ${
              selectedTab === 'enhanced' 
                ? 'text-black border-b-2 border-black dark:text-white dark:border-white' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setSelectedTab('enhanced')}
          >
            Enhanced Photo
          </button>
        </div>
      </div>
      
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="p-4">
          <img
            src={selectedTab === 'ad' ? adImageUrl : enhancedImageUrl}
            alt={selectedTab === 'ad' ? 'Generated Ad' : 'Enhanced Photo'}
            className="max-h-96 mx-auto object-contain rounded"
          />
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 flex justify-between">
          <div className="space-x-2">
            <button
              onClick={() => onEdit()}
              disabled={editsLeft <= 0}
              className={`inline-flex items-center px-3 py-1.5 border rounded-md text-sm font-medium
                        ${editsLeft > 0 
                          ? 'border-black text-black hover:bg-gray-50 dark:border-white dark:text-white dark:hover:bg-gray-900'
                          : 'border-gray-300 text-gray-400 cursor-not-allowed'
                        }`}
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit ({editsLeft}/3 left)
            </button>
          </div>
          
          <div className="space-x-2">
            <button
              onClick={() => onDownload(selectedTab === 'ad' ? adImageUrl : enhancedImageUrl)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            
            <button
              onClick={() => onShare(selectedTab === 'ad' ? adImageUrl : enhancedImageUrl)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 
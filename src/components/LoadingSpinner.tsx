import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Processing...' 
}) => {
  return (
    <div className="flex items-center justify-center space-x-3 text-center">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-white animate-spin"></div>
      {message && <p className="text-sm text-zinc-300">{message}</p>}
    </div>
  );
}; 
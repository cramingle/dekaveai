'use client';

import React from 'react';

interface HeaderProps {
  isLoggedIn: boolean;
  tokensLeft: number;
}

export const Header: React.FC<HeaderProps> = ({ isLoggedIn, tokensLeft }) => {
  return (
    <header className="sticky top-0 z-40 bg-black border-b border-zinc-800 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">dekaveAI</span>
        </div>
        
        <div className="flex items-center space-x-4">
          {isLoggedIn && (
            <div className="bg-white/10 text-white py-1 px-3 rounded-full text-sm font-medium">
              {tokensLeft} tokens
            </div>
          )}
          
          <button className="rounded-full bg-zinc-900 p-1.5 border border-zinc-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}; 
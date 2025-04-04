'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  // Sample showcase images - in a real app, these would come from your backend
  const showcaseImages = [
    '/showcase/image1.jpg',
    '/showcase/image2.jpg',
    '/showcase/image3.jpg',
    '/showcase/image4.jpg',
    '/showcase/image5.jpg',
    '/showcase/image6.jpg',
    '/showcase/image7.jpg',
    '/showcase/image8.jpg',
  ];

  // For the fade-in animation effect
  const [visibleImages, setVisibleImages] = useState<number[]>([]);

  useEffect(() => {
    // Initial display of all images
    const initialImages = Array.from({ length: 5 }, (_, i) => i);
    setVisibleImages(initialImages);

    return () => {};
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-black via-zinc-900 to-black text-white overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-zinc-800/20 rounded-full blur-2xl"></div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 relative z-10 pt-10">
        {/* Hero Section */}
        <motion.div 
          className="text-center max-w-4xl mx-auto py-10 md:py-16 flex flex-col items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* Logo and App Name Container */}
          <div className="flex items-center gap-4 mb-8 md:mb-10">
            {/* Logo/Icon */}
            <div className="relative">
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-gradient-to-r from-white/10 to-white/5 flex items-center justify-center">
                <Image
                  src="/phone-logo.png" 
                  alt="dekaveAI Logo" 
                  width={48}
                  height={48}
                  className="h-10 md:h-14 w-auto object-contain"
                />
              </div>
            </div>
            
            {/* App Name */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold">
              <span className="text-white">skolp</span>
            </h1>
          </div>
          
          {/* Search-like input */}
          <div className="w-full max-w-xl mx-auto mb-10 md:mb-16 relative">
            <div className="flex items-center w-full overflow-hidden rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-sm">
              <input 
                type="email" 
                placeholder="Enter your email address..."
                className="w-full bg-transparent py-3 md:py-4 px-4 md:px-6 text-white placeholder-zinc-500 focus:outline-none text-sm md:text-base"
              />
              <button className="bg-white text-black font-medium rounded-full py-2 md:py-3 px-4 md:px-6 mx-2 hover:bg-gray-200 transition-all text-sm md:text-base whitespace-nowrap">
                Get Started
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-2 text-center">Join our newsletter for product updates and AI marketing tips</p>
          </div>
          
          {/* Description */}
          <p className="text-zinc-400 text-base md:text-xl mb-8 md:mb-12 max-w-3xl mx-auto text-center">
            Transform product photos into stunning professional advertisements with AI
          </p>
        </motion.div>

        {/* Image Showcase Section */}
        <motion.div 
          id="showcase"
          className="w-full max-w-5xl mx-auto mb-20 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            The Result
          </h2>
          
          <div className="relative w-full overflow-hidden" style={{ height: '650px' }}>
            {/* Photo grid container with true endless scroll animation */}
            <motion.div 
              className="absolute w-full"
              animate={{ 
                y: [0, '-50%'] 
              }}
              transition={{
                repeat: Infinity,
                repeatType: "loop",
                duration: 30,
                ease: "linear",
                times: [0, 1]
              }}
            >
              {/* First copy of content */}
              <div className="w-full">
                {/* Dark overlay header */}
                <div className="w-full bg-zinc-900/90 py-3 px-4 mb-2 rounded-md text-center">
                  <h3 className="text-lg font-medium text-white">Premium Product Campaign</h3>
                </div>

                {/* Photo Grid Layout */}
                <div className="w-full grid grid-cols-2 gap-2 relative">
                  {/* Large landscape photo - top left */}
                  <div className="col-span-1 row-span-1 rounded-md overflow-hidden h-64 shadow-md">
                    <div className="bg-gradient-to-r from-zinc-800 to-zinc-700 w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Product Showcase</span>
                    </div>
                  </div>

                  {/* Square photo - top right */}
                  <div className="col-span-1 row-span-1 rounded-md overflow-hidden h-64 shadow-md">
                    <div className="bg-gradient-to-r from-zinc-700 to-zinc-800 w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Social Media Ad</span>
                    </div>
                  </div>

                  {/* Small square photo - bottom left */}
                  <div className="col-span-1 row-span-1 rounded-md overflow-hidden h-48 shadow-md">
                    <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Digital Banner</span>
                    </div>
                  </div>

                  {/* Landscape photo - bottom right */}
                  <div className="col-span-1 row-span-1 rounded-md overflow-hidden h-48 shadow-md">
                    <div className="bg-gradient-to-b from-zinc-800 to-black w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Email Campaign</span>
                    </div>
                  </div>
                </div>

                {/* Full width showcase */}
                <div className="w-full mt-4 grid grid-cols-1 gap-2">
                  <div className="col-span-1 rounded-md overflow-hidden h-72 shadow-md">
                    <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Billboard Design</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Second copy of content - exact duplicate for seamless looping */}
              <div className="w-full mt-8">
                {/* Dark overlay header */}
                <div className="w-full bg-zinc-900/90 py-3 px-4 mb-2 rounded-md text-center">
                  <h3 className="text-lg font-medium text-white">Premium Product Campaign</h3>
                </div>

                {/* Photo Grid Layout */}
                <div className="w-full grid grid-cols-2 gap-2 relative">
                  {/* Large landscape photo - top left */}
                  <div className="col-span-1 row-span-1 rounded-md overflow-hidden h-64 shadow-md">
                    <div className="bg-gradient-to-r from-zinc-800 to-zinc-700 w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Product Showcase</span>
                    </div>
                  </div>

                  {/* Square photo - top right */}
                  <div className="col-span-1 row-span-1 rounded-md overflow-hidden h-64 shadow-md">
                    <div className="bg-gradient-to-r from-zinc-700 to-zinc-800 w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Social Media Ad</span>
                    </div>
                  </div>

                  {/* Small square photo - bottom left */}
                  <div className="col-span-1 row-span-1 rounded-md overflow-hidden h-48 shadow-md">
                    <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Digital Banner</span>
                    </div>
                  </div>

                  {/* Landscape photo - bottom right */}
                  <div className="col-span-1 row-span-1 rounded-md overflow-hidden h-48 shadow-md">
                    <div className="bg-gradient-to-b from-zinc-800 to-black w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Email Campaign</span>
                    </div>
                  </div>
                </div>

                {/* Full width showcase */}
                <div className="w-full mt-4 grid grid-cols-1 gap-2">
                  <div className="col-span-1 rounded-md overflow-hidden h-72 shadow-md">
                    <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 w-full h-full flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity"></div>
                      <span className="text-white font-medium">Billboard Design</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div 
          className="w-full max-w-4xl mx-auto text-center mb-12 md:mb-20 px-4"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          <div className="bg-gradient-to-b from-zinc-800/50 to-transparent p-6 md:p-12 rounded-3xl border border-white/10">
            <div className="flex justify-center mb-4">
              <Image
                src="/phone-logo.png" 
                alt="dekaveAI Logo" 
                width={40}
                height={40}
                className="h-8 w-auto object-contain"
              />
            </div>
            <h2 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6">Ready to Transform Your Products?</h2>
            <p className="text-zinc-400 mb-6 md:mb-8 text-base md:text-lg">Create professional marketing materials in seconds with dekaveAI</p>
            <Link 
              href="/" 
              className="px-6 md:px-8 py-2.5 md:py-4 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-all hover:scale-105 transform inline-block text-sm md:text-lg"
            >
              Let's Do This!
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-6 md:py-8 text-center text-zinc-500 relative z-10 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Image
            src="/phone-logo.png" 
            alt="dekaveAI Logo" 
            width={20}
            height={20}
            className="h-5 w-auto object-contain"
          />
          <span className="font-medium">skolp</span>
        </div>
        <p>© 2025 skolp. All rights reserved.</p>
      </footer>
    </div>
  );
} 
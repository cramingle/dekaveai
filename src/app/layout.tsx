'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import Providers from '@/components/Providers';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

const inter = Inter({ subsets: ['latin'] });

// Create a metadata object that can be used on the client side
const metadataValues = {
  title: 'dekaveAI - AI-Powered Product Ad Generator',
  description: 'Transform product photos into stunning professional ads and marketing materials with AI.',
  keywords: 'AI, ad generator, marketing materials, product photos, advertising',
  siteUrl: 'https://dekaveai.vercel.app',
  ogImage: 'https://dekaveai.vercel.app/og-image.png',
  twitterHandle: '@dekaveAI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  // Track page views when the route changes
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      return;
    }
    
    // Only track page views on the client side
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname, mounted]);
  
  return (
    <html lang="en">
      <head>
        <title>{metadataValues.title}</title>
        <meta name="description" content={metadataValues.description} />
        <meta name="keywords" content={metadataValues.keywords} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        
        {/* Canonical URL */}
        <link rel="canonical" href={`${metadataValues.siteUrl}${pathname}`} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${metadataValues.siteUrl}${pathname}`} />
        <meta property="og:title" content={metadataValues.title} />
        <meta property="og:description" content={metadataValues.description} />
        <meta property="og:image" content={metadataValues.ogImage} />
        <meta property="og:site_name" content="dekaveAI" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content={metadataValues.twitterHandle} />
        <meta name="twitter:title" content={metadataValues.title} />
        <meta name="twitter:description" content={metadataValues.description} />
        <meta name="twitter:image" content={metadataValues.ogImage} />
        
        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        
        {/* Web App Manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={inter.className}>
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

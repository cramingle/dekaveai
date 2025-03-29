'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import Providers from '@/components/Providers';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Analytics } from '@vercel/analytics/react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

const inter = Inter({ subsets: ['latin'] });

// Create a metadata object that can be used on the client side
const metadataValues = {
  title: 'dekaveAI - AI-Powered Product Ad Generator',
  description: 'Transform product photos into stunning professional ads and marketing materials with AI.',
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
      </head>
      <body className={inter.className}>
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

// Environment variables helper file
// This file centralizes all environment variable access to ensure consistency

// Base URL for the application
export const BASE_URL = (() => {
  // Check if we're in a weird state where BASE_URL would be "REQUIRED"
  // This is happening in certain Vercel serverless functions
  if (process.env.NODE_ENV === 'production') {
    // Hard-code the production URL since we know what it is
    return 'https://dekaveai.vercel.app';
  }

  // For explicitly set NEXTAUTH_URL (only as fallback)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  
  // For Vercel environments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // For client-side
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Local development fallback
  return 'http://localhost:3000';
})();

// NextAuth
export const NEXTAUTH_URL = process.env.NEXTAUTH_URL;
export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

// Supabase
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Database
export const DATABASE_URL = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase', 'postgres');

// Stripe Configuration
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe Price IDs for different packages
export const STRIPE_PRICE_IDS = {
  basic: process.env.STRIPE_BASIC_PRICE_ID || 'price_1R8eFVBfSVCq5UYnr5Aaxfex',
  value: process.env.STRIPE_VALUE_PRICE_ID || 'price_1R8eFaBfSVCq5UYnYPhE1KZG',
  pro: process.env.STRIPE_PRO_PRICE_ID || 'price_1R8eFdBfSVCq5UYnDerAMBOK',
  max: process.env.STRIPE_MAX_PRICE_ID || 'price_1R8eFgBfSVCq5UYnbCgskl2Y'
} as const;

// Log environment status on server-side only (to avoid client-side logs)
if (typeof window === 'undefined') {
  console.log('Environment configuration loaded:', {
    NODE_ENV: process.env.NODE_ENV,
    BASE_URL,
    DATABASE_URL: DATABASE_URL ? '✓ Set' : '✗ Missing',
  });
}

// Environment
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Helper function to get base URL with path
export function getUrl(path: string): string {
  // Make sure path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Check if BASE_URL ends with slash
  const baseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  
  // Return full URL, making sure we don't have double slashes
  return `${baseUrl}${normalizedPath}`;
}

// Export an env object for structured access
export const env = {
  BASE_URL,
  NEXTAUTH_URL,
  NEXTAUTH_SECRET,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY,
  DATABASE_URL,
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET,
  IS_PRODUCTION,
  IS_DEVELOPMENT
};

// Export default object for easier importing
export default {
  BASE_URL,
  NEXTAUTH_URL,
  NEXTAUTH_SECRET,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY,
  DATABASE_URL,
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  getUrl
}; 
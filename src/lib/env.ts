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

// Dana Payment
export const DANA_ENABLED = !!process.env.NEXT_PUBLIC_DANA_ENABLED;
export const DANA_ENVIRONMENT = (process.env.NEXT_PUBLIC_DANA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
export const DANA_API_KEY = process.env.DANA_API_KEY;
export const DANA_API_SECRET = process.env.DANA_API_SECRET;
export const DANA_MERCHANT_ID = process.env.DANA_MERCHANT_ID;

// Log environment status on server-side only (to avoid client-side logs)
if (typeof window === 'undefined') {
  console.log('Environment configuration loaded:', {
    NODE_ENV: process.env.NODE_ENV,
    DANA_ENABLED,
    DANA_ENVIRONMENT,
    BASE_URL,
    DANA_API_KEY: DANA_API_KEY ? '✓ Set' : '✗ Missing',
    DANA_API_SECRET: DANA_API_SECRET ? '✓ Set' : '✗ Missing',
    DANA_MERCHANT_ID: DANA_MERCHANT_ID ? '✓ Set' : '✗ Missing',
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

// Export default object for easier importing
export default {
  BASE_URL,
  NEXTAUTH_URL,
  NEXTAUTH_SECRET,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY,
  DANA_ENABLED,
  DANA_ENVIRONMENT,
  DANA_API_KEY,
  DANA_API_SECRET,
  DANA_MERCHANT_ID,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  getUrl
}; 
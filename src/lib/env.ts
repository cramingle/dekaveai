// Environment variables helper file
// This file centralizes all environment variable access to ensure consistency

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  
  // Database
  DATABASE_URL: z.string().optional(),
  
  // Supabase
  SUPABASE_URL: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID: z.string().min(1),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  
  // Other
  REPLICATE_API_TOKEN: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase', 'postgres'),
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  
  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
  
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Other
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
});

// Base URL for the application
export const BASE_URL = (() => {
  // Check if we're in production
  if (process.env.NODE_ENV === 'production') {
    // Hard-code the production URL since we know what it is
    return 'https://dekaveai.vercel.app';
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

// Stripe Configuration
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

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
    DATABASE_URL: env.DATABASE_URL ? '✓ Set' : '✗ Missing',
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
  DATABASE_URL: env.DATABASE_URL,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_PRICE_IDS,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  getUrl,
  env
}; 
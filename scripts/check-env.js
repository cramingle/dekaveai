#!/usr/bin/env node

/**
 * This script checks if all required environment variables are set.
 * Run this before deploying to production to ensure everything is configured correctly.
 */

const requiredEnvVars = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'ENCRYPTION_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'OPENAI_API_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_PRICE_ID'
];

const missingEnvVars = [];

// Check if each required environment variable is defined
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar);
  }
});

if (missingEnvVars.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', 'Error: The following required environment variables are not set:');
  missingEnvVars.forEach(envVar => {
    console.error('\x1b[33m%s\x1b[0m', `  - ${envVar}`);
  });
  console.error('\x1b[31m%s\x1b[0m', 'Please set these variables before deploying to production.');
  process.exit(1);
} else {
  console.log('\x1b[32m%s\x1b[0m', 'All required environment variables are set!');
  process.exit(0);
} 
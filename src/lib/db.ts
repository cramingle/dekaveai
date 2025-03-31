import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

// Ensure this only runs on the server
const client = postgres(env.DATABASE_URL, { ssl: 'require' });

// Export for use in server-side code only
export const db = drizzle(client);

// Declare this is a server-side module
export const dynamic = 'force-dynamic';
export const runtime = 'edge'; 
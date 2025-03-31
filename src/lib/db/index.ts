import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '@/lib/env';

// For Vercel serverless functions, we need to handle connection limits
let client: ReturnType<typeof postgres> | null = null;

export function getClient() {
  if (!client) {
    const connectionString = env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL could not be constructed from NEXT_PUBLIC_SUPABASE_URL');
    }

    // Configure connection for Vercel's serverless environment
    client = postgres(connectionString, {
      max: 1, // Recommended for serverless
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: true,
      types: {
        bigint: postgres.BigInt
      },
      connection: {
        application_name: 'dekave',
        // Optimize for Vercel's sin1 region which matches Supabase's Singapore region
        options: '--timezone=Asia/Singapore'
      }
    });
  }
  return client;
}

// Initialize Drizzle with schema
export const db = drizzle(getClient(), { schema });

// Migration function - call this during app initialization
export async function runMigrations() {
  try {
    await migrate(drizzle(getClient()), {
      migrationsFolder: 'drizzle'
    });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    await getClient()?.end();
  }
} 
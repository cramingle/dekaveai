import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';

// Create PostgreSQL connection
const connectionString = env.DATABASE_URL;
const client = postgres(connectionString);

// Create Drizzle ORM instance
export const db = drizzle(client); 
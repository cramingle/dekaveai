import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from '@/lib/db';
import { seedBrandTemplates } from '@/lib/db/seed-templates';

async function checkEnvironment() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'OPENAI_API_KEY'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function setup() {
  try {
    console.log('Checking environment variables...');
    await checkEnvironment();

    console.log('Starting database setup...');

    // Run migrations with retry logic for deployment scenarios
    console.log('Running migrations...');
    let retries = 3;
    while (retries > 0) {
      try {
        await migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
        console.log('Migrations completed successfully');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw error;
        }
        console.log(`Migration failed, retrying... (${retries} attempts left)`);
        // Wait 5 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Seed brand templates with retry logic
    console.log('Seeding brand templates...');
    retries = 3;
    while (retries > 0) {
      try {
        await seedBrandTemplates();
        console.log('Brand templates seeded successfully');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw error;
        }
        console.log(`Seeding failed, retrying... (${retries} attempts left)`);
        // Wait 5 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log('Database setup completed successfully');
    
    // In production (Vercel deployment), don't exit the process
    if (process.env.NODE_ENV !== 'production') {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error during database setup:', error);
    
    // In production (Vercel deployment), don't exit the process
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    } else {
      // In production, throw the error to be handled by Vercel's build process
      throw error;
    }
  }
}

// Only run setup if this is not being imported as a module
if (require.main === module) {
  setup();
} 
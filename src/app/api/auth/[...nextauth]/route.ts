import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { SupabaseAdapter } from '@next-auth/supabase-adapter';
import { createClient } from '@supabase/supabase-js';

// Extend the Session type to include our custom properties
declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      id?: string;
      tokens?: number;
      tokens_expiry_date?: string;
      tier?: 'free' | 'basic' | 'pro' | 'enterprise';
    }
  }
}

// Initialize Supabase client for direct operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Use anon key as fallback for service role key if not available
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if we have the required config
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define NextAuth handler
const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  adapter: SupabaseAdapter({
    url: supabaseUrl,
    secret: supabaseKey,
  }),
  callbacks: {
    async session({ session, user }) {
      // Get token count from Supabase
      const { data: userData, error } = await supabase
        .from('users')
        .select('tokens, tokens_expiry_date, tier')
        .eq('id', user.id)
        .single();
      
      if (!error && userData) {
        // Add token info to session
        session.user.tokens = userData.tokens || 0;
        session.user.tokens_expiry_date = userData.tokens_expiry_date;
        session.user.tier = userData.tier || 'free';
        session.user.id = user.id;
      } else {
        // If first login, or token info not found, create default token info
        const tier = 'free';
        const tokens = 100000; // Default token count for free tier
        
        // Calculate expiration date (28 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 28);
        
        // Update user with default token info
        await supabase
          .from('users')
          .update({
            tokens,
            tokens_expiry_date: expiryDate.toISOString(),
            tier,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
          
        // Add to session
        session.user.tokens = tokens;
        session.user.tokens_expiry_date = expiryDate.toISOString();
        session.user.tier = tier;
        session.user.id = user.id;
        
        // Also track IP for free tier users (for anti-abuse)
        if (tier === 'free') {
          await supabase
            .from('ip_tracking')
            .insert({
              ip: 'unknown', // We'll update this client-side when possible
              user_id: user.id,
              created_at: new Date().toISOString(),
            });
        }
      }
      
      return session;
    },
  },
  pages: {
    signIn: '/', // Custom sign-in page (we'll show the paywall)
    error: '/',  // Error page
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST }; 
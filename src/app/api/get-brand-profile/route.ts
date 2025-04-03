import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client on the server side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic'; // Disable static optimization

export async function GET(req: NextRequest) {
  try {
    // Get userId from the query string
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get brand profile for this user
    const { data, error } = await supabase
      .from('user_brand_profiles')
      .select('profile')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      // If no profile found for this user
      if (error.code === 'PGRST116') {
        return new NextResponse(
          JSON.stringify({ profile: null }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Error retrieving brand profile from Supabase:', error);
      
      return new NextResponse(
        JSON.stringify({ error: `Failed to retrieve profile: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!data || !data.profile) {
      return new NextResponse(
        JSON.stringify({ profile: null }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new NextResponse(
      JSON.stringify({ profile: data.profile }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error retrieving brand profile:', error);
    
    return new NextResponse(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper function to safely parse cookie values
const parseCookie = (cookieValue: string | undefined): any => {
  if (!cookieValue) return null;
  
  try {
    return JSON.parse(Buffer.from(cookieValue, 'base64').toString());
  } catch (error) {
    console.error('Error parsing cookie:', error);
    return null;
  }
};

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
    
    // Try to get the profile from cookies first (temporary solution)
    const cookies = req.cookies;
    const profileCookie = cookies.get(`brand_profile_${userId}`)?.value;
    
    if (profileCookie) {
      try {
        const profile = parseCookie(profileCookie);
        console.log(`Retrieved brand profile for user ${userId} from cookie`);
        
        return new NextResponse(
          JSON.stringify({ 
            profile,
            source: 'cookie' 
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (cookieError) {
        console.error('Error parsing profile cookie:', cookieError);
        // Continue to try Supabase as fallback
      }
    }
    
    // For now, return null if not found in cookie
    // We'll reimplement Supabase later when JWT issues are fixed
    console.log(`No brand profile found for user ${userId} in cookies`);
    return new NextResponse(
      JSON.stringify({ profile: null }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
    
    /* Supabase implementation - uncomment when JWT issues are fixed
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
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
    */
  } catch (error) {
    console.error('Error retrieving brand profile:', error);
    
    return new NextResponse(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        stack: error instanceof Error ? error.stack : null
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrandProfile } from '@/lib/brand-profile';

// Initialize Supabase client on the server side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic'; // Disable static optimization

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const { userId, profile } = await req.json();
    
    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!profile) {
      return new NextResponse(
        JSON.stringify({ error: 'Profile data is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate profile has required fields
    if (!profile.brandStyle || !profile.colorPalette || !profile.moodAndTone) {
      return new NextResponse(
        JSON.stringify({ error: 'Incomplete brand profile' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Ensure required schema exists
    try {
      // Check if table exists
      const { error: checkError } = await supabase
        .from('user_brand_profiles')
        .select('id')
        .limit(1);
      
      // If table doesn't exist, we need to create it
      if (checkError && checkError.code === '42P01') { // PostgreSQL code for undefined_table
        console.log('Table user_brand_profiles does not exist, creating...');
        
        // Create the table (this would typically be done through migrations)
        const { error: createError } = await supabase.rpc('create_brand_profiles_table');
        
        if (createError) {
          console.error('Error creating table:', createError);
          // Continue anyway, the table might be created by another request
        }
      }
    } catch (schemaError) {
      console.error('Error checking schema:', schemaError);
      // Continue anyway, as the table might exist
    }
    
    // Upsert brand profile for this user
    const { error } = await supabase
      .from('user_brand_profiles')
      .upsert({
        user_id: userId,
        profile: profile,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (error) {
      console.error('Error saving brand profile to Supabase:', error);
      
      return new NextResponse(
        JSON.stringify({ error: `Failed to save profile: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new NextResponse(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error saving brand profile:', error);
    
    return new NextResponse(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Get Supabase client and session
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { session } } = await supabase.auth.getSession();
    
    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text to encrypt is required' },
        { status: 400 }
      );
    }

    // Encrypt the text
    const encrypted = encrypt(text);

    return NextResponse.json({ encrypted });
  } catch (error) {
    console.error('Error encrypting text:', error);
    return NextResponse.json(
      { error: 'Failed to encrypt text' },
      { status: 500 }
    );
  }
} 
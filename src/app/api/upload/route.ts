import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string || 'anonymous';

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Create a unique filename
    const filename = `${userId}-${Date.now()}-${file.name}`;
    
    // Upload to Vercel Blob
    const { url } = await put(filename, file, {
      access: 'public',
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// Demo route that returns a mock image URL
export async function GET() {
  try {
    // For demo purposes, we'll just return a mock URL
    const mockImageUrl = 'https://placekitten.com/400/300';
    
    return NextResponse.json({ url: mockImageUrl });
  } catch (error) {
    console.error('Error in demo upload:', error);
    return NextResponse.json(
      { error: 'Failed in demo upload' },
      { status: 500 }
    );
  }
} 
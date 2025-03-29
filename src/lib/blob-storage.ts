import { put } from '@vercel/blob';

// Helper function to upload an image file to Vercel Blob storage
export async function uploadImageToBlob(
  file: File,
  userId: string
): Promise<string> {
  try {
    // Check if we're in a demo environment (no actual file in browser)
    if (typeof window === 'undefined' || !process.env.BLOB_READ_WRITE_TOKEN) {
      console.log('Using mock blob storage for demo purposes');
      // Return a mock image URL for demo purposes
      return 'https://placekitten.com/400/300';
    }
    
    // Create a unique filename
    const filename = `${userId}-${Date.now()}-${file.name}`;
    
    // Upload to Vercel Blob
    const { url } = await put(filename, file, {
      access: 'public',
    });
    
    return url;
  } catch (error) {
    console.error('Error uploading image:', error);
    // In case of error, fall back to mock URL
    return 'https://placekitten.com/400/300';
  }
}

// Helper function to generate a mock image URL for local development
export function getMockImageUrl(filename: string): string {
  // For demo purposes, return a placeholder image
  return 'https://placekitten.com/400/300';
} 
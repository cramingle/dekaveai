import { put } from '@vercel/blob';
import logger from './logger';

/**
 * Uploads an image file to Vercel Blob storage
 * @param file - The file to upload
 * @param userId - The ID of the user uploading the file
 * @returns Promise containing the URL of the uploaded image
 */
export async function uploadImageToBlob(
  file: File,
  userId: string
): Promise<string> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
    }

    // Create a unique filename with user ID and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `user-uploads/${userId}/${timestamp}-${file.name}`;

    // Upload to Vercel Blob
    const { url } = await put(filename, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: true // Add random suffix to prevent collisions
    });

    logger.info('Successfully uploaded image to blob storage', {
      userId,
      filename,
      fileSize: file.size,
      mimeType: file.type,
      url
    });

    return url;
  } catch (error) {
    logger.error('Error uploading image to blob storage:', {
      userId,
      fileName: file.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Failed to upload image. Please try again.');
  }
}

/**
 * Stores a generated image from a URL to permanent storage
 * @param imageUrl - The URL of the image to store
 * @returns Promise containing the URL of the stored image
 */
export async function storeGeneratedImage(imageUrl: string): Promise<string> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
    }

    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const imageBlob = await response.blob();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `generated/${timestamp}-${Math.random().toString(36).substring(2, 10)}.png`;

    // Store in Vercel Blob
    const { url } = await put(filename, imageBlob, {
      access: 'public',
      contentType: imageBlob.type,
      addRandomSuffix: true
    });

    logger.info('Successfully stored generated image', {
      filename,
      originalUrl: imageUrl,
      newUrl: url
    });

    return url;
  } catch (error) {
    logger.error('Error storing generated image:', {
      originalUrl: imageUrl,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Failed to store generated image. Please try again.');
  }
} 
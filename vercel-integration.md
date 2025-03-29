# Vercel Blob Storage and Analytics Integration

## Overview
This document outlines the implementation of Vercel Blob Storage and Vercel Analytics in the dekaveAI application.

## Vercel Blob Storage
Vercel Blob Storage is used to store generated ad images from DALL-E, which typically expire after a short period. This ensures that users can access their generated images permanently.

### Implementation Details:
1. **Package Installation**: `@vercel/blob` package is installed
2. **Environment Variables**: `BLOB_READ_WRITE_TOKEN` is configured in .env.local
3. **Image Storage Function**: 
   - The `storeGeneratedImage` function in `src/lib/ai-processing.ts` handles the storage of images
   - Images are fetched from the DALL-E URL and stored in Vercel Blob Storage
   - A random filename is generated to prevent collisions
   - Public access is enabled for all stored images

### Usage:
```typescript
// Example of image storage
const { url } = await put(
  filename, 
  imageBlob, 
  { 
    access: 'public',
    contentType: imageBlob.type,
    addRandomSuffix: false
  }
);
```

## Vercel Analytics
Vercel Analytics is used to track application usage, performance metrics, and user behavior. This helps in understanding how users interact with the application and which features are most popular.

### Implementation Details:
1. **Package Installation**: `@vercel/analytics` package is installed
2. **Analytics Component**: Added to the root layout
3. **Custom Events Tracking**: 
   - Custom event tracking is implemented in `src/lib/analytics.ts`
   - Key events like sign-ins, token purchases, and ad generations are tracked
   - All events are logged for debugging purposes

### Key Events Tracked:
- Page views
- User authentication attempts
- Token purchases
- Ad generation requests
- Image uploads
- Quality selections (HD vs. Standard)
- Error events

### Server-Side Tracking:
A custom API route `/api/track` is created to handle server-side event tracking, which can be integrated with external analytics services in production.

## Local Development vs. Production
- In development, events are logged and stored in memory
- In production, both Vercel Analytics and custom tracking endpoint are used
- Sensitive data is masked in logs for security

## Data Collection Policy
- Only necessary data is collected for improving user experience
- Personal identifiable information (PII) is minimized
- IP addresses are partially anonymized

## Future Enhancements
1. **Storage Management**: Add lifecycle policies for image storage
2. **Analytics Dashboard**: Create a custom analytics dashboard
3. **A/B Testing**: Implement feature flags and A/B testing
4. **Cost Optimization**: Analyze storage and API usage patterns for optimization 
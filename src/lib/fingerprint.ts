import { load } from '@fingerprintjs/fingerprintjs'
import { createHash } from 'crypto'

// Cache the fingerprint to avoid recalculating it frequently
let cachedFingerprint: string | null = null
let lastFingerprintTime = 0
const FINGERPRINT_CACHE_TIME = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Generates a device fingerprint based on browser properties.
 * This is more persistent than cookies or localStorage and harder for users to reset.
 */
export async function getDeviceFingerprint(): Promise<string> {
  // Use cached fingerprint if available and recent
  const now = Date.now()
  if (cachedFingerprint && now - lastFingerprintTime < FINGERPRINT_CACHE_TIME) {
    return cachedFingerprint
  }

  try {
    // Initialize FingerprintJS
    const fp = await load()
    
    // Get visitor data
    const result = await fp.get()
    
    // Get additional data that might help with identification
    const additionalData = await getAdditionalIdentifiers()
    
    // Combine FingerprintJS result with additional data for stronger fingerprint
    const combinedFingerprint = `${result.visitorId}-${additionalData}`
    
    // Hash the combined result for consistency and privacy
    const hashedFingerprint = hashString(combinedFingerprint)
    
    // Cache the result
    cachedFingerprint = hashedFingerprint
    lastFingerprintTime = now
    
    // Save in sessionStorage as a backup
    try {
      sessionStorage.setItem('_dekave_device_id', hashedFingerprint)
    } catch (e) {
      // Ignore errors from sessionStorage (e.g., in incognito mode)
    }
    
    return hashedFingerprint
  } catch (error) {
    console.error('Error generating fingerprint:', error)
    
    // Fallback to any previously stored fingerprint
    const storedFingerprint = sessionStorage.getItem('_dekave_device_id')
    if (storedFingerprint) {
      return storedFingerprint
    }
    
    // Last resort: generate a random identifier
    return generateRandomId()
  }
}

/**
 * Collects additional device/browser identifiers to enhance fingerprinting
 */
async function getAdditionalIdentifiers(): Promise<string> {
  const identifiers: string[] = []
  
  // Browser information
  identifiers.push(navigator.userAgent)
  identifiers.push(navigator.language)
  identifiers.push(String(screen.width))
  identifiers.push(String(screen.height))
  identifiers.push(String(screen.colorDepth))
  identifiers.push(String(new Date().getTimezoneOffset()))
  
  // Try to get platform-specific information
  if (navigator.platform) {
    identifiers.push(navigator.platform)
  }
  
  // Check for installed plugins
  if (navigator.plugins) {
    const pluginsString = Array.from(navigator.plugins)
      .map(p => p.name)
      .join('|')
    identifiers.push(pluginsString)
  }
  
  // Check for canvas fingerprint
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      canvas.width = 200
      canvas.height = 50
      
      // Draw some text and shapes with specific attributes
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#F60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('Dekave Fingerprint', 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText('Dekave Fingerprint', 4, 17)
      
      // Get the data URL
      const dataUrl = canvas.toDataURL()
      identifiers.push(dataUrl)
    }
  } catch (e) {
    console.error('Canvas fingerprinting error:', e)
  }
  
  // Combine all identifiers
  return identifiers.join('|||')
}

/**
 * Hash a string to a consistent fingerprint
 */
function hashString(str: string): string {
  try {
    // Use Node.js crypto if available (server-side)
    return createHash('sha256').update(str).digest('hex')
  } catch (e) {
    // Fallback for client-side
    return simpleClientHash(str)
  }
}

/**
 * Simple client-side hash function
 */
function simpleClientHash(str: string): string {
  let hash = 0
  if (str.length === 0) return hash.toString(16)
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  // Convert to hex string and ensure it's always positive
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Generate a random ID as last resort
 */
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}

/**
 * Get a persistent ID that combines fingerprint with any user ID
 */
export async function getPersistentUserId(providedUserId?: string): Promise<string> {
  // Get device fingerprint
  const fingerprint = await getDeviceFingerprint()
  
  // If user already has an ID, combine it with fingerprint for continuity
  if (providedUserId) {
    return `${providedUserId.split('-')[0]}-${fingerprint.substring(0, 8)}`
  }
  
  // Otherwise, create a new ID based on fingerprint
  return `user-${fingerprint.substring(0, 16)}-${Date.now().toString(36)}`
} 
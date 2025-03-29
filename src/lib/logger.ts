// Production-ready logger
// This provides a consistent logging interface with different behavior in development vs production
// In production, this could be configured to send logs to a service like LogDNA, Datadog, etc.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

// Helper to mask sensitive data
const maskSensitiveData = (data: any): any => {
  if (!data) return data;
  
  // Create a deep copy to avoid modifying the original object
  const maskedData = JSON.parse(JSON.stringify(data));
  
  // List of sensitive field names (case-insensitive)
  const sensitiveFields = ['password', 'token', 'api_key', 'apikey', 'secret', 'credential'];
  
  // Recursive function to mask fields in nested objects
  const maskRecursive = (obj: any) => {
    if (typeof obj !== 'object' || obj === null) return;
    
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        maskRecursive(obj[key]);
      } else if (
        sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase())) &&
        typeof obj[key] === 'string'
      ) {
        obj[key] = '***MASKED***';
      }
    });
  };
  
  maskRecursive(maskedData);
  return maskedData;
};

// Format log entry for output
const formatLogEntry = (entry: LogEntry): string => {
  try {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      data: entry.data ? maskSensitiveData(entry.data) : undefined
    });
  } catch (error) {
    return `[ERROR] Failed to stringify log entry: ${error}`;
  }
};

// The logger implementation
const logger = {
  debug: (message: string, data?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      data
    };
    
    // In development, use console with colors
    if (process.env.NODE_ENV === 'development') {
      console.debug(`%c[DEBUG] ${message}`, 'color: gray', data || '');
      return;
    }
    
    // In production environment, structured logging for better analysis
    console.debug(formatLogEntry(entry));
  },
  
  info: (message: string, data?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      data
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.info(`%c[INFO] ${message}`, 'color: blue', data || '');
      return;
    }
    
    console.info(formatLogEntry(entry));
  },
  
  warn: (message: string, data?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      data
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`%c[WARN] ${message}`, 'color: orange', data || '');
      return;
    }
    
    console.warn(formatLogEntry(entry));
  },
  
  error: (message: string, error?: any, additionalData?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      data: {
        ...(error && { 
          errorMessage: error.message,
          stack: error.stack,
          name: error.name
        }),
        ...(additionalData && { additionalData })
      }
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.error(`%c[ERROR] ${message}`, 'color: red; font-weight: bold', error || '', additionalData || '');
      return;
    }
    
    console.error(formatLogEntry(entry));
    
    // In production, you could send critical errors to a monitoring service
    // Example: if (process.env.NODE_ENV === 'production') sendToErrorMonitoring(error);
  }
};

export default logger; 
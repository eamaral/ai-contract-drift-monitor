/**
 * Sanitized Logger
 * 
 * Central logging utility that:
 * - Scrubs sensitive information (API keys, tokens, etc.)
 * - Adds run_id for traceability
 * - Never logs full payloads
 * - Consistent formatting
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';

const SCRUB_KEYS = (process.env.SCRUB_KEYS || 'authorization,api-key,set-cookie,x-api-key,cookie,token')
  .toLowerCase()
  .split(',')
  .map(k => k.trim());

// Generate a unique run_id for this process
export const RUN_ID = randomUUID().slice(0, 8);

/**
 * Scrub sensitive information from objects
 */
function scrubObject(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 5) return '[DEPTH_LIMIT]';
  
  if (obj === null || obj === undefined) return obj;
  
  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => scrubObject(item, depth + 1));
  }
  
  // Handle objects
  const scrubbed: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const isSensitive = SCRUB_KEYS.some(scrubKey => keyLower.includes(scrubKey));
    
    if (isSensitive) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      scrubbed[key] = scrubObject(value, depth + 1);
    } else {
      scrubbed[key] = value;
    }
  }
  
  return scrubbed;
}

/**
 * Truncate long strings to prevent log spam
 */
function truncate(str: string, maxLength = 500): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '... [TRUNCATED]';
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Sanitized logger
 */
export class SanitizedLogger {
  constructor(private readonly context: string) {}

  private format(level: LogLevel, message: string, metadata?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = metadata ? ` | ${JSON.stringify(scrubObject(metadata))}` : '';
    return `[${timestamp}] [${RUN_ID}] [${level}] [${this.context}] ${message}${metaStr}`;
  }

  debug(message: string, metadata?: any): void {
    console.debug(this.format(LogLevel.DEBUG, message, metadata));
  }

  info(message: string, metadata?: any): void {
    console.log(this.format(LogLevel.INFO, message, metadata));
  }

  warn(message: string, metadata?: any): void {
    console.warn(this.format(LogLevel.WARN, message, metadata));
  }

  error(message: string, error?: Error | any, metadata?: any): void {
    const errorMeta = error instanceof Error 
      ? { errorMessage: error.message, errorStack: truncate(error.stack || '', 1000) }
      : { error: scrubObject(error) };
    
    const combinedMeta = { ...errorMeta, ...metadata };
    console.error(this.format(LogLevel.ERROR, message, combinedMeta));
  }
}

/**
 * Create a logger for a specific context
 */
export function createLogger(context: string): SanitizedLogger {
  return new SanitizedLogger(context);
}

/**
 * Get the current run ID
 */
export function getRunId(): string {
  return RUN_ID;
}


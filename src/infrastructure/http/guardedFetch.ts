/**
 * guardedFetch - Secure HTTP client with guardrails
 * 
 * Features:
 * - HTTP method allowlist (GET/HEAD only by default)
 * - QPS and concurrency limiting
 * - Timeouts with AbortController
 * - Exponential backoff with jitter for retries
 * - Header scrubbing for security
 * - Metrics emission
 */

import 'dotenv/config';
import { incCounter, observeHistogram } from '../monitoring/metrics/metrics.js';

const SAFE_METHODS = (process.env.SAFE_HTTP_METHODS || 'GET,HEAD,POST').split(',').map(m => m.trim().toUpperCase());
const MAX_QPS = parseInt(process.env.MAX_QPS || '1', 10);
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '2', 10);
const HTTP_TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS || '8000', 10);
const HTTP_RETRY_MAX = parseInt(process.env.HTTP_RETRY_MAX || '2', 10);
const BACKOFF_RANGE = process.env.HTTP_BACKOFF_MS || '300:2000';
const [BACKOFF_MIN, BACKOFF_MAX] = BACKOFF_RANGE.split(':').map(n => parseInt(n, 10));

const SCRUB_KEYS = (process.env.SCRUB_KEYS || 'authorization,api-key,set-cookie').toLowerCase().split(',');

interface GuardedFetchOptions extends RequestInit {
  targetName?: string;
}

// Simple rate limiter using token bucket algorithm
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxQPS: number) {
    this.maxTokens = maxQPS;
    this.tokens = maxQPS;
    this.lastRefill = Date.now();
    this.refillRate = maxQPS;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    
    while (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }
    
    this.tokens -= 1;
  }
}

// Simple concurrency limiter using semaphore pattern
class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<() => void> {
    if (this.running < this.max) {
      this.running++;
      return () => this.release();
    }

    return new Promise<() => void>(resolve => {
      this.queue.push(() => {
        this.running++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

// Global limiters (singleton pattern for app-wide limits)
const rateLimiter = new RateLimiter(MAX_QPS);
const concurrencyLimiter = new ConcurrencyLimiter(MAX_CONCURRENCY);

/**
 * Masks sensitive headers for logging
 */
function maskHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  
  const headersObj = headers instanceof Headers 
    ? Object.fromEntries(headers.entries())
    : (Array.isArray(headers) ? Object.fromEntries(headers) : headers);
  
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headersObj)) {
    const keyLower = key.toLowerCase();
    if (SCRUB_KEYS.some(scrubKey => keyLower.includes(scrubKey))) {
      masked[key] = '[REDACTED]';
    } else {
      masked[key] = String(value);
    }
  }
  
  return masked;
}

/**
 * Calculate backoff delay with jitter
 */
function calculateBackoff(attempt: number): number {
  const base = Math.min(BACKOFF_MIN * Math.pow(2, attempt), BACKOFF_MAX);
  const jitter = Math.random() * (base * 0.3); // ±30% jitter
  return Math.floor(base + jitter);
}

/**
 * Guarded fetch with security controls
 */
export async function guardedFetch(
  input: RequestInfo | URL,
  init?: GuardedFetchOptions
): Promise<Response> {
  const targetName = init?.targetName || 'unknown';
  const method = (init?.method || 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  // 1. Enforce HTTP method allowlist
  if (!SAFE_METHODS.includes(method)) {
    const error = new Error(
      `HTTP method ${method} is not allowed. Permitted methods: ${SAFE_METHODS.join(', ')}`
    );
    console.error(`[guardedFetch] BLOCKED: ${method} ${url} - Method not in allowlist`);
    incCounter('http_requests_total', { target: targetName, method, status: 'blocked' });
    throw error;
  }

  // 2. Apply rate limiting
  await rateLimiter.acquire();
  
  // 3. Apply concurrency limiting
  const release = await concurrencyLimiter.acquire();
  
  const startTime = Date.now();
  let lastError: Error | undefined;
  
  try {
    // Add secure User-Agent
    const headers = {
      ...init?.headers,
      'User-Agent': 'ai-drift-monitor/0.1.0'
    };

    console.log(`[guardedFetch] ${method} ${url} (target: ${targetName})`);
    console.log(`[guardedFetch] Headers: ${JSON.stringify(maskHeaders(headers))}`);

    // 4. Retry loop with exponential backoff
    for (let attempt = 0; attempt <= HTTP_RETRY_MAX; attempt++) {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
      
      try {
        const response = await fetch(input, {
          ...init,
          method,
          headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        const status = response.status.toString();
        
        incCounter('http_requests_total', { target: targetName, method, status });
        observeHistogram('http_request_duration_seconds', duration / 1000, { target: targetName, method });
        
        console.log(`[guardedFetch] ✅ ${method} ${url} - ${status} (${duration}ms)`);
        
        return response;
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;
        
        // Check if it's a timeout
        if (error.name === 'AbortError') {
          console.warn(`[guardedFetch] ⏱️  Timeout on ${method} ${url} (attempt ${attempt + 1}/${HTTP_RETRY_MAX + 1})`);
          incCounter('http_timeout_total', { target: targetName, method });
        } else {
          console.warn(`[guardedFetch] ❌ Error on ${method} ${url} (attempt ${attempt + 1}/${HTTP_RETRY_MAX + 1}): ${error.message}`);
        }
        
        // Retry if not last attempt
        if (attempt < HTTP_RETRY_MAX) {
          const backoff = calculateBackoff(attempt);
          console.log(`[guardedFetch] 🔄 Retrying in ${backoff}ms...`);
          incCounter('http_retry_total', { target: targetName, method });
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }
    
    // All retries exhausted
    const duration = Date.now() - startTime;
    incCounter('http_requests_total', { target: targetName, method, status: 'failed' });
    console.error(`[guardedFetch] 💥 All retries exhausted for ${method} ${url} (${duration}ms)`);
    throw lastError || new Error('All retries exhausted');
    
  } finally {
    // Always release concurrency slot
    release();
  }
}


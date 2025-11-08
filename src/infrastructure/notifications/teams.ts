/**
 * Enhanced Teams Notifications
 * 
 * Features:
 * - Content sanitization (no PII/secrets)
 * - Rate limiting with deduplication
 * - Length capping
 * - Structured logging
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger, getRunId } from '../logging/logger.js';
import { incCounter } from '../monitoring/metrics/metrics.js';

const logger = createLogger('teams-notifications');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, '../../../../.cache');

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || process.env.TEAMS_WEBHOOK || '';
const TEAMS_RATE_LIMIT = process.env.TEAMS_RATE_LIMIT || '1/30m'; // 1 message per 30 minutes by default
const SCRUB_KEYS = (process.env.SCRUB_KEYS || 'authorization,api-key,set-cookie')
  .toLowerCase()
  .split(',')
  .map(k => k.trim());

const MAX_TEXT_LENGTH = 2000; // Teams message limit
const MAX_FACT_LENGTH = 500;

export type Fact = { name: string; value: string };

/**
 * Parse rate limit string (e.g., "1/30m" -> 30 minutes)
 */
function parseRateLimit(rateLimitStr: string): number {
  const match = rateLimitStr.match(/(\d+)\/(\d+)([smh])/);
  if (!match) {
    logger.warn(`Invalid rate limit format: ${rateLimitStr}, using 30 minutes`);
    return 30 * 60 * 1000;
  }
  
  const [, , amount, unit] = match;
  const value = parseInt(amount, 10);
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    default: return 30 * 60 * 1000;
  }
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Check rate limit using file-based cache
 */
function checkRateLimit(dedupeKey: string): boolean {
  ensureCacheDir();
  
  const rateLimitMs = parseRateLimit(TEAMS_RATE_LIMIT);
  const cacheFile = path.join(CACHE_DIR, `teams_${dedupeKey}.txt`);
  
  if (fs.existsSync(cacheFile)) {
    const lastSent = parseInt(fs.readFileSync(cacheFile, 'utf8'), 10);
    const elapsed = Date.now() - lastSent;
    
    if (elapsed < rateLimitMs) {
      const remainingMs = rateLimitMs - elapsed;
      const remainingMin = Math.ceil(remainingMs / 60000);
      logger.warn(`Rate limit: last message sent ${Math.floor(elapsed / 60000)} min ago, wait ${remainingMin} more min`);
      return false;
    }
  }
  
  // Update cache
  fs.writeFileSync(cacheFile, Date.now().toString(), 'utf8');
  return true;
}

/**
 * Sanitize content by removing sensitive information
 */
function sanitizeContent(content: string): string {
  let sanitized = content;
  
  // Remove potential API keys (patterns like "key: abc123xyz...")
  sanitized = sanitized.replace(/\b([a-z_-]*key|token|secret|password)[:\s=]+[a-zA-Z0-9_-]{16,}\b/gi, '[REDACTED]');
  
  // Remove authorization headers
  for (const scrubKey of SCRUB_KEYS) {
    const regex = new RegExp(`${scrubKey}[:\\s=]+[^\\s,}]+`, 'gi');
    sanitized = sanitized.replace(regex, `${scrubKey}: [REDACTED]`);
  }
  
  return sanitized;
}

/**
 * Truncate content to max length
 */
function truncate(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength - 20) + '\n\n[...truncated]';
}

/**
 * Send Teams message with all safety controls
 */
export async function sendTeamsMessage(
  webhookUrl: string,
  title: string,
  text: string,
  facts?: Fact[],
  dedupeKey?: string,
  actionUrl?: string
): Promise<void> {
  // Use webhook URL from param or env
  const webhook = webhookUrl || TEAMS_WEBHOOK_URL;
  
  if (!webhook) {
    logger.info('Teams webhook not configured, skipping notification');
    return;
  }
  
  try {
    // Rate limiting & deduplication
    const key = dedupeKey || getRunId();
    if (!checkRateLimit(key)) {
      logger.warn('Teams notification rate limited');
      incCounter('alerts_sent_total', { channel: 'teams', outcome: 'rate_limited' });
      return;
    }
    
    // Sanitize content
    const sanitizedTitle = sanitizeContent(title);
    const sanitizedText = sanitizeContent(truncate(text, MAX_TEXT_LENGTH));
    
    const sanitizedFacts = facts?.map(f => ({
      name: sanitizeContent(f.name).slice(0, 100),
      value: sanitizeContent(truncate(f.value, MAX_FACT_LENGTH))
    }));
    
    // Determine theme color based on severity
    const themeColor = title.includes('MAJOR') ? 'FF0000' : 
                       title.includes('MINOR') ? 'FFA500' : 
                       '00FF00';
    
    // Build Adaptive Card (modern format)
    const payload = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            body: [
              // Title
              {
                type: 'TextBlock',
                size: 'Large',
                weight: 'Bolder',
                text: sanitizedTitle,
                wrap: true,
                color: title.includes('MAJOR') ? 'Attention' : 
                       title.includes('MINOR') ? 'Warning' : 'Good'
              },
              // Main text with proper formatting
              {
                type: 'TextBlock',
                text: sanitizedText,
                wrap: true,
                separator: true
              },
              // Facts as FactSet
              ...(sanitizedFacts && sanitizedFacts.length > 0 ? [
                {
                  type: 'FactSet',
                  facts: sanitizedFacts.map(f => ({
                    title: f.name,
                    value: f.value
                  })),
                  separator: true
                }
              ] : [])
            ],
            actions: actionUrl ? [
              {
                type: 'Action.OpenUrl',
                title: '🔍 View Execution Details',
                url: actionUrl
              }
            ] : [],
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            version: '1.4'
          }
        }
      ]
    };
    
    logger.info(`Sending Teams notification: ${sanitizedTitle}`);
    
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Teams webhook failed: ${response.status} ${response.statusText} - ${body}`);
    }
    
    logger.info('Teams notification sent successfully');
    incCounter('alerts_sent_total', { channel: 'teams', outcome: 'success' });
    
  } catch (error: any) {
    logger.error('Failed to send Teams notification', error);
    incCounter('alerts_failed_total', { channel: 'teams' });
    throw error;
  }
}


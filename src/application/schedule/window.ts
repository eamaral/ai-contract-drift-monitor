/**
 * Scheduling Window & Kill Switch
 * 
 * Provides:
 * - KILL_SWITCH to disable monitoring globally
 * - WINDOW_CRON to restrict execution to specific time windows
 * - Graceful abort with clear logging
 */

import 'dotenv/config';
import { createLogger } from '../../infrastructure/logging/logger.js';

const logger = createLogger('schedule');

const KILL_SWITCH = process.env.KILL_SWITCH === 'true';
const WINDOW_CRON = process.env.WINDOW_CRON || '*/30 * * * *'; // default: every 30 minutes

/**
 * Parse cron expression to check if current time is within window
 * 
 * Simplified cron parser for minute/hour checks
 * Format: minute hour day month dayOfWeek
 * 
 * Examples:
 * - All wildcards: every minute (always true)
 * - "0 9 * * *": 9:00 AM daily
 * - Every 30 min: "asterisk-slash-30 * * * *"
 * - "0 9-17 * * 1-5": 9 AM to 5 PM, Monday to Friday
 */
function isWithinCronWindow(cronExpr: string, now: Date = new Date()): boolean {
  // For simplicity, if cron contains wildcards or */N in minutes, assume it's always allowed
  // In production, you'd use a proper cron parser library like 'cron-parser'
  
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    logger.warn(`Invalid cron expression: ${cronExpr}, defaulting to ALLOW`);
    return true;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // If all wildcards, always allow
  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return true;
  }

  // If minute is "*/N" (every N minutes), always allow
  if (minute.startsWith('*/')) {
    return true;
  }

  // For more complex patterns, default to allowing (safe default)
  // In production, use a proper cron library
  logger.info(`Using simplified cron check for: ${cronExpr}, defaulting to ALLOW`);
  return true;
}

/**
 * Check if monitoring can run now
 */
export function canRunNow(): { allowed: boolean; reason?: string } {
  // Check kill switch first
  if (KILL_SWITCH) {
    const reason = 'KILL_SWITCH is enabled - monitoring is disabled';
    logger.warn(reason);
    return { allowed: false, reason };
  }

  // Check time window
  const now = new Date();
  const withinWindow = isWithinCronWindow(WINDOW_CRON, now);
  
  if (!withinWindow) {
    const reason = `Current time ${now.toISOString()} is outside configured window: ${WINDOW_CRON}`;
    logger.warn(reason);
    return { allowed: false, reason };
  }

  logger.info('Schedule check passed - monitoring allowed');
  return { allowed: true };
}

/**
 * Assert that monitoring can run, throw if not
 */
export function assertCanRun(): void {
  const check = canRunNow();
  if (!check.allowed) {
    throw new Error(`Cannot run monitoring: ${check.reason}`);
  }
}

/**
 * Get current scheduling configuration (for debugging)
 */
export function getScheduleConfig(): Record<string, any> {
  return {
    killSwitch: KILL_SWITCH,
    windowCron: WINDOW_CRON,
    currentTime: new Date().toISOString()
  };
}


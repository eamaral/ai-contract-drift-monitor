/**
 * Drift Check CLI - HARDENED VERSION
 * 
 * Integrates all security guardrails:
 * - guardedFetch for all HTTP requests
 * - Severity classification
 * - PR-only snapshot updates
 * - AI with grounding and validation
 * - Sanitized logging
 * - Comprehensive metrics
 * - Scheduling window & kill switch
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Security & Infrastructure
import { guardedFetch } from '../infrastructure/http/guardedFetch.js';
import { createLogger, getRunId } from '../infrastructure/logging/logger.js';
import { assertCanRun } from '../application/schedule/window.js';
import { incCounter, observeHistogram } from '../infrastructure/monitoring/metrics/metrics.js';

// Business Logic
import { classifySeverity, hasChanges, formatSeverityReport } from '../application/diff/severity.js';
import { updateSnapshotsPROnly, shouldBlockCI } from '../application/snapshots/update.js';
import { summarizeDiffWithAI } from '../infrastructure/ai/summary.js';

// Notifications
import { sendTeamsMessage } from '../infrastructure/notifications/teams.js';
import { sendConsoleMessage } from '../infrastructure/notifications/reporting/console.js';

// GraphQL Support
import {
  isGraphQLTarget,
  INTROSPECTION_QUERY,
  extractGraphQLSchema,
  type GraphQLIntrospectionResult
} from '../infrastructure/api/graphql/introspection.js';

// Types
type Target = {
  id: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type Level1Schema = Record<string, string>;
type Snapshot = Record<string, Level1Schema>;

// Logger
const logger = createLogger('drift-check');

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
const TARGETS_PATH = path.resolve(ROOT, 'src/infrastructure/api/config', 'targets.json');
const SNAPSHOT_DIR = path.resolve(ROOT, 'snapshots');
const SNAPSHOT_FILE = path.resolve(SNAPSHOT_DIR, 'latest.json');

/**
 * Ensure directory exists
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Determine type of a value
 */
function typeOfValue(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

/**
 * Build Level-1 schema from JSON object
 */
function buildLevel1Schema(obj: unknown): Level1Schema {
  if (obj === null || typeof obj !== 'object') return {};
  const record = obj as Record<string, unknown>;
  const schema: Level1Schema = {};
  for (const [key, value] of Object.entries(record)) {
    schema[key] = typeOfValue(value);
  }
  return schema;
}

/**
 * Calculate diff between two schemas
 */
function diffSchemas(prev: Level1Schema, curr: Level1Schema): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  
  const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(curr || {})]);
  
  for (const key of allKeys) {
    const prevValue = prev?.[key];
    const currValue = curr?.[key];
    
    if (prevValue !== undefined && currValue === undefined) {
      removed.push(key);
      continue;
    }
    
    if (prevValue === undefined && currValue !== undefined) {
      added.push(key);
      continue;
    }
    
    // Handle array values (GraphQL types)
    if (Array.isArray(prevValue) && Array.isArray(currValue)) {
      const prevSet = new Set(prevValue);
      const currSet = new Set(currValue);
      
      for (const item of currValue) {
        if (!prevSet.has(item)) {
          added.push(`${key}.${item}`);
        }
      }
      
      for (const item of prevValue) {
        if (!currSet.has(item)) {
          removed.push(`${key}.${item}`);
        }
      }
    }
    // Type change detection
    else if (prevValue !== currValue) {
      added.push(`${key} (type changed)`);
    }
  }
  
  return { added, removed };
}

/**
 * Fetch JSON with security controls
 */
async function fetchJson(target: Target): Promise<unknown> {
  const isGraphQL = isGraphQLTarget(target.url, target.body);
  
  const options: RequestInit & { targetName?: string } = {
    method: target.method || 'GET',
    headers: target.headers,
    targetName: target.id
  };
  
  // For GraphQL, use introspection
  if (isGraphQL && target.method === 'POST') {
    logger.info(`Using GraphQL introspection for ${target.id}`);
    options.body = JSON.stringify({ query: INTROSPECTION_QUERY });
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json'
    };
  } else if (target.body && (target.method === 'POST' || target.method === 'PUT' || target.method === 'PATCH')) {
    options.body = JSON.stringify(target.body);
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json'
    };
  }
  
  // Use guardedFetch instead of raw fetch
  const res = await guardedFetch(target.url, options);
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed for ${target.id}: ${res.status} ${res.statusText} - ${text}`);
  }
  
  const json = await res.json();
  
  // Extract GraphQL schema if needed
  if (isGraphQL && json.data && '__schema' in json.data) {
    return extractGraphQLSchema(json.data as GraphQLIntrospectionResult);
  }
  
  return json;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  const runId = getRunId();
  
  logger.info(`🚀 Starting drift check - Run ID: ${runId}`);
  
  try {
    // 1. Check scheduling window & kill switch
    logger.info('Checking scheduling window...');
    assertCanRun();
    
    // 2. Load targets
    logger.info(`Loading targets from ${TARGETS_PATH}`);
    const rawTargets = fs.readFileSync(TARGETS_PATH, 'utf8');
    const targets = JSON.parse(rawTargets) as Target[];
    logger.info(`Loaded ${targets.length} target(s)`);
    
    // 3. Load previous snapshot
    const previous: Snapshot = fs.existsSync(SNAPSHOT_FILE)
      ? JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'))
      : {};
    
    const snapshotExists = Object.keys(previous).length > 0;
    logger.info(`Previous snapshot: ${snapshotExists ? `${Object.keys(previous).length} target(s)` : 'none (first run)'}`);
    
    // 4. Fetch current schemas
    const current: Snapshot = {};
    const perTargetDiff: Record<string, { added: string[]; removed: string[] }> = {};
    
    for (const target of targets) {
      try {
        logger.info(`Fetching ${target.id}...`);
        const json = await fetchJson(target);
        
        const isGraphQL = isGraphQLTarget(target.url, target.body);
        const schema = isGraphQL ? (json as Level1Schema) : buildLevel1Schema(json);
        
        current[target.id] = schema;
        
        const prev = previous[target.id] || {};
        const diff = diffSchemas(prev, schema);
        
        if (diff.added.length || diff.removed.length) {
          perTargetDiff[target.id] = diff;
          logger.warn(`Drift detected in ${target.id}: +${diff.added.length} -${diff.removed.length}`);
        } else {
          logger.info(`✅ No changes in ${target.id}`);
        }
        
      } catch (err: any) {
        logger.error(`Failed to fetch ${target.id}`, err);
        incCounter('drift_checks_total', { outcome: 'error' });
      }
    }
    
    // 5. Analyze changes
    const changedTargets = Object.keys(perTargetDiff);
    const totalTargets = Object.keys(current).length;
    const driftDetected = hasChanges(perTargetDiff);
    
    incCounter('drift_checks_total', { 
      outcome: driftDetected ? 'drift_detected' : 'no_changes'
    });
    
    if (driftDetected) {
      incCounter('drift_detected_total', {});
    }
    
    // 6. Classify severity
    let title: string;
    let text: string;
    let facts: { name: string; value: string }[];
    let exitCode = 0;
    
    if (!driftDetected) {
      // No changes - success notification
      title = '✅ API Contracts Status - All Good';
      text = `All ${totalTargets} endpoints are stable. No changes detected in monitored API schemas.`;
      facts = [
        { name: 'Run ID', value: runId },
        { name: 'APIs Monitored', value: String(totalTargets) },
        { name: 'APIs with Changes', value: '0' },
        { name: 'Status', value: '✅ Stable' }
      ];
      
      logger.info('✅ No drift detected - all APIs stable');
      
    } else {
      // Changes detected - classify severity
      logger.info('Classifying severity...');
      const classification = classifySeverity(perTargetDiff);
      
      // Emit metrics
      incCounter(`drift_${classification.severity}_total`, {});
      
      logger.warn(formatSeverityReport(classification));
      
      // Generate AI summary
      logger.info('Generating AI summary...');
      const aiSummary = await summarizeDiffWithAI(perTargetDiff);
      
      // Update snapshot (PR-only)
      logger.info('Updating snapshot (PR-only mode)...');
      const updateResult = updateSnapshotsPROnly({
        snapshotPath: SNAPSHOT_FILE,
        newSnapshot: current,
        classification,
        aiSummary,
        affectedTargets: changedTargets
      });
      
      incCounter('snapshot_pr_created_total', { 
        severity: classification.severity,
        should_block: updateResult.shouldBlock.toString()
      });
      
      // Determine exit code based on severity gate
      if (updateResult.shouldBlock) {
        exitCode = 1;
        logger.error(`🚨 BLOCKING: ${classification.severity.toUpperCase()} changes detected - CI will fail`);
      } else {
        logger.info(`⚠️ Non-blocking: ${classification.severity.toUpperCase()} changes detected - CI will pass`);
      }
      
      // Prepare notification
      const icon = classification.severity === 'major' ? '🚨' : '⚠️';
      title = `${icon} API Drift Detected - ${classification.severity.toUpperCase()}`;
      
      // Format text with better structure for multiple APIs
      const maxChanges = 3; // Show details for up to 3 APIs
      let summaryText = `\n📝 Summary:\n${aiSummary.summary}\n\n`;
      
      if (changedTargets.length <= maxChanges) {
        // Show full details for few APIs
        summaryText += `💥 Impact:\n\n${aiSummary.impact.map((i, idx) => `${idx + 1}. ${i}`).join('\n\n')}`;
      } else {
        // Summarize for many APIs
        summaryText += `💥 Impact:\n⚠️ ${changedTargets.length} APIs affected - showing top ${maxChanges}:\n\n`;
        summaryText += aiSummary.impact.slice(0, maxChanges).map((i, idx) => `${idx + 1}. ${i}`).join('\n\n');
        summaryText += `\n\n...and ${changedTargets.length - maxChanges} more. See execution details for full analysis.`;
      }
      
      if (aiSummary.risks.length > 0) {
        summaryText += `\n\n⚠️ Risks:\n\n${aiSummary.risks.map((r, idx) => `${idx + 1}. ${r}`).join('\n\n')}`;
      }
      
      text = summaryText;
      
      facts = [
        { name: '🆔 Run ID', value: runId },
        { name: '📊 Severity', value: classification.severity.toUpperCase() },
        { name: '🎯 APIs Monitored', value: String(totalTargets) },
        { name: '⚠️ APIs with Changes', value: String(changedTargets.length) },
        { name: '📍 Affected APIs', value: changedTargets.length <= 5 ? changedTargets.join(', ') : `${changedTargets.slice(0, 5).join(', ')}... (+${changedTargets.length - 5} more)` },
        { name: '🚦 Status', value: updateResult.shouldBlock ? '🚨 BLOCKING CI' : '⚠️ Alert Only' }
      ];
    }
    
    // 7. Send notifications
    await sendConsoleMessage(title, text, facts);
    
    const webhookUrl = process.env.TEAMS_WEBHOOK_URL || process.env.TEAMS_WEBHOOK || '';
    if (webhookUrl) {
      try {
        // Build GitHub Actions URL if running in CI
        const repoUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
          ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
          : null;
        const runId = process.env.GITHUB_RUN_ID;
        const actionUrl = (repoUrl && runId) ? `${repoUrl}/actions/runs/${runId}` : undefined;
        
        await sendTeamsMessage(webhookUrl, title, text, facts, runId, actionUrl);
        logger.info('✅ Teams notification sent');
      } catch (error: any) {
        logger.error('❌ Teams notification failed', error);
      }
    } else {
      logger.info('Teams webhook not configured, skipping');
    }
    
    // 8. Report metrics
    const duration = Date.now() - startTime;
    observeHistogram('drift_check_duration_seconds', duration / 1000, {});
    
    logger.info(`✅ Drift check completed in ${duration}ms - Exit code: ${exitCode}`);
    
    process.exitCode = exitCode;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('❌ Drift check failed', error);
    incCounter('drift_checks_total', { outcome: 'fatal_error' });
    observeHistogram('drift_check_duration_seconds', duration / 1000, { outcome: 'error' });
    process.exitCode = 1;
  }
}

// Execute
main().catch((e) => {
  console.error('[drift] FATAL ERROR:', e);
  process.exitCode = 1;
});


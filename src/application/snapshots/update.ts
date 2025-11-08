/**
 * Snapshot Update (PR-Only Mode)
 * 
 * Features:
 * - Enforces PR_ONLY mode (never direct commit)
 * - Severity gate (major blocks, minor alerts)
 * - Prepares snapshot for CI to commit to branch
 * - Includes PR body template with AI summary
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger, getRunId } from '../../infrastructure/logging/logger.js';
import type { Severity, SeverityClassification } from '../diff/severity.js';
import type { AISummary } from '../../infrastructure/ai/schemas/aiSummary.schema.js';
import { incCounter } from '../../infrastructure/monitoring/metrics/metrics.js';

const logger = createLogger('snapshot-update');

const SNAPSHOT_UPDATE_MODE = process.env.SNAPSHOT_UPDATE_MODE || 'PR_ONLY';
const DRIFT_SEVERITY_GATE = (process.env.DRIFT_SEVERITY_GATE || 'major') as Severity;

export interface SnapshotUpdateOptions {
  snapshotPath: string;
  newSnapshot: any;
  classification: SeverityClassification;
  aiSummary?: AISummary;
  affectedTargets: string[];
}

export interface UpdateResult {
  success: boolean;
  severity: Severity;
  shouldBlock: boolean;
  prBodyMarkdown: string;
}

/**
 * Update snapshots with PR-only enforcement
 */
export function updateSnapshotsPROnly(options: SnapshotUpdateOptions): UpdateResult {
  const { snapshotPath, newSnapshot, classification, aiSummary, affectedTargets } = options;
  
  // Safety check: enforce PR_ONLY mode
  if (SNAPSHOT_UPDATE_MODE !== 'PR_ONLY') {
    const error = new Error(
      `SNAPSHOT_UPDATE_MODE is '${SNAPSHOT_UPDATE_MODE}' but must be 'PR_ONLY' for safety`
    );
    logger.error('Snapshot update blocked - invalid mode', error);
    throw error;
  }
  
  logger.info(`Updating snapshot: ${snapshotPath} (mode: ${SNAPSHOT_UPDATE_MODE})`);
  
  // Determine if this should block CI
  const shouldBlock = classification.severity === DRIFT_SEVERITY_GATE || 
                     classification.severity === 'major'; // major always blocks
  
  // Write snapshot to file (CI will commit it to branch)
  try {
    const dir = path.dirname(snapshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(snapshotPath, JSON.stringify(newSnapshot, null, 2), 'utf8');
    logger.info(`✅ Snapshot written to ${snapshotPath}`);
    
    incCounter('snapshot_updates_total', { 
      severity: classification.severity,
      mode: SNAPSHOT_UPDATE_MODE
    });
    
  } catch (error: any) {
    logger.error('Failed to write snapshot', error);
    throw error;
  }
  
  // Generate PR body markdown
  const prBodyMarkdown = generatePRBody(classification, aiSummary, affectedTargets);
  
  // Write PR body to file for CI to use
  const prBodyPath = path.join(path.dirname(snapshotPath), '..', '.pr_body.md');
  fs.writeFileSync(prBodyPath, prBodyMarkdown, 'utf8');
  logger.info(`✅ PR body written to ${prBodyPath}`);
  
  return {
    success: true,
    severity: classification.severity,
    shouldBlock,
    prBodyMarkdown
  };
}

/**
 * Generate PR body markdown with all details
 */
function generatePRBody(
  classification: SeverityClassification,
  aiSummary: AISummary | undefined,
  affectedTargets: string[]
): string {
  const runId = getRunId();
  const icon = classification.severity === 'major' ? '🚨' : '⚠️';
  const severityLabel = classification.severity.toUpperCase();
  
  let body = `# ${icon} API Drift Detected - ${severityLabel}\n\n`;
  body += `**Run ID:** \`${runId}\`\n`;
  body += `**Severity:** ${severityLabel}\n`;
  body += `**Affected APIs:** ${affectedTargets.join(', ')}\n`;
  body += `**Timestamp:** ${new Date().toISOString()}\n\n`;
  
  body += `---\n\n`;
  
  // AI Summary (if available)
  if (aiSummary) {
    body += `## 🤖 AI Analysis\n\n`;
    body += `${aiSummary.summary}\n\n`;
    
    if (aiSummary.impact.length > 0) {
      body += `### 📊 Impact\n\n`;
      aiSummary.impact.forEach(i => {
        body += `- ${i}\n`;
      });
      body += `\n`;
    }
    
    if (aiSummary.risks.length > 0) {
      body += `### ⚠️ Risks\n\n`;
      aiSummary.risks.forEach(r => {
        body += `- ${r}\n`;
      });
      body += `\n`;
    }
    
    body += `---\n\n`;
  }
  
  // Detailed reasons
  body += `## 📝 Detailed Changes\n\n`;
  classification.reasons.forEach(reason => {
    body += `- ${reason}\n`;
  });
  body += `\n`;
  
  body += `---\n\n`;
  
  // What to do
  body += `## ✅ What to Do\n\n`;
  
  if (classification.severity === 'major') {
    body += `### 🚨 MAJOR BREAKING CHANGES DETECTED\n\n`;
    body += `This PR contains **breaking changes** that may impact existing integrations.\n\n`;
    body += `**Action Required:**\n`;
    body += `1. ❌ **DO NOT MERGE** without reviewing with API owners\n`;
    body += `2. 📞 Contact the API team to understand the changes\n`;
    body += `3. 🔍 Review the snapshot diff in \`snapshots/latest.json\`\n`;
    body += `4. 🧪 Test your integration with the new schema\n`;
    body += `5. 📝 Update your application code if needed\n`;
    body += `6. ✅ Only merge after confirming compatibility\n\n`;
  } else {
    body += `### ⚠️ Minor Changes Detected\n\n`;
    body += `This PR contains **additive changes** that should be safe.\n\n`;
    body += `**Recommended Actions:**\n`;
    body += `1. 🔍 Review the snapshot diff in \`snapshots/latest.json\`\n`;
    body += `2. 📝 Check for any deprecated fields\n`;
    body += `3. ✅ Merge when ready\n\n`;
  }
  
  body += `---\n\n`;
  body += `## 🔗 Resources\n\n`;
  body += `- [View Snapshots](../snapshots)\n`;
  body += `- [Drift Monitor Documentation](../README.md)\n`;
  body += `- [Run Logs](../../actions/runs)\n\n`;
  
  body += `---\n\n`;
  body += `*🤖 This PR was created automatically by the AI Contract Drift Monitor*\n`;
  
  return body;
}

/**
 * Check if snapshot update should block CI
 */
export function shouldBlockCI(severity: Severity): boolean {
  return severity === 'major' || severity === DRIFT_SEVERITY_GATE;
}


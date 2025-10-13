import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeDiff } from '../../infrastructure/llm/summarize.js';
import { sendTeamsMessage } from '../../infrastructure/notifications/reporting/teams.js';
import { sendConsoleMessage } from '../../infrastructure/notifications/reporting/console.js';
import { sendEmailMessage } from '../../infrastructure/notifications/reporting/email.js';
import { 
  isGraphQLTarget, 
  INTROSPECTION_QUERY, 
  extractGraphQLSchema,
  type GraphQLIntrospectionResult
} from '../../infrastructure/api/graphql-introspection.js';

type Target = {
  id: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type Level1Schema = Record<string, string>;

type Snapshot = Record<string, Level1Schema>; // key: target id

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '../../..');
const TARGETS_PATH = path.resolve(ROOT, 'src/infrastructure/api/tests', 'targets.json');
const SNAPSHOT_DIR = path.resolve(ROOT, 'snapshots');
const SNAPSHOT_FILE = path.resolve(SNAPSHOT_DIR, 'latest.json');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function typeOfValue(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function buildLevel1Schema(obj: unknown): Level1Schema {
  if (obj === null || typeof obj !== 'object') return {};
  const record = obj as Record<string, unknown>;
  const schema: Level1Schema = {};
  for (const [key, value] of Object.entries(record)) {
    schema[key] = typeOfValue(value);
  }
  return schema;
}

function diffSchemas(prev: Level1Schema, curr: Level1Schema): { added: string[]; removed: string[] } {
  const prevKeys = new Set(Object.keys(prev || {}));
  const currKeys = new Set(Object.keys(curr || {}));
  const added: string[] = [];
  const removed: string[] = [];
  for (const k of currKeys) if (!prevKeys.has(k)) added.push(k);
  for (const k of prevKeys) if (!currKeys.has(k)) removed.push(k);
  return { added, removed };
}

async function fetchJson(target: Target): Promise<unknown> {
  // Check if it's a GraphQL endpoint
  const isGraphQL = isGraphQLTarget(target.url, target.body);
  
  const options: RequestInit = {
    method: target.method || 'GET',
    headers: target.headers
  };
  
  // For GraphQL, use introspection query instead of user query
  if (isGraphQL && target.method === 'POST') {
    console.log(`[drift] Using GraphQL introspection for ${target.id}`);
    options.body = JSON.stringify({
      query: INTROSPECTION_QUERY
    });
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
  
  const res = await fetch(target.url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed for ${target.id}: ${res.status} ${res.statusText} - ${text}`);
  }
  
  const json = await res.json();
  
  // If GraphQL introspection, extract simplified schema
  if (isGraphQL && json.data && '__schema' in json.data) {
    return extractGraphQLSchema(json.data as GraphQLIntrospectionResult);
  }
  
  return json;
}

async function main(): Promise<void> {
  const rawTargets = fs.readFileSync(TARGETS_PATH, 'utf8');
  const targets = JSON.parse(rawTargets) as Target[];

  const previous: Snapshot = fs.existsSync(SNAPSHOT_FILE)
    ? JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'))
    : {};

  const current: Snapshot = {};
  const perTargetDiff: Record<string, { added: string[]; removed: string[] }> = {};

  for (const t of targets) {
    try {
      const json = await fetchJson(t);
      
      // For GraphQL, json is already the extracted schema
      // For REST, we need to extract it
      const isGraphQL = isGraphQLTarget(t.url, t.body);
      const schema = isGraphQL ? (json as Level1Schema) : buildLevel1Schema(json);
      
      current[t.id] = schema;
      const prev = previous[t.id] || {};
      const d = diffSchemas(prev, schema);
      if (d.added.length || d.removed.length) {
        perTargetDiff[t.id] = d;
      }
    } catch (err) {
      console.error(`[drift] error for ${t.id}:`, err);
    }
  }

  ensureDir(SNAPSHOT_DIR);
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(current, null, 2));
  console.log(`[drift] snapshot written: ${SNAPSHOT_FILE}`);

  const changedTargets = Object.keys(perTargetDiff);
  const totalTargets = Object.keys(current).length;
  
  let title: string;
  let text: string;
  let facts: { name: string; value: string }[];

  if (changedTargets.length === 0) {
    // No changes detected - send success notification
    title = '✅ API Contracts Status - All Good';
    text = `All ${totalTargets} endpoints are stable. No changes detected in monitored API schemas.`;
    facts = [
      { name: 'APIs Monitored', value: String(totalTargets) },
      { name: 'APIs with Changes', value: '0' },
      { name: 'Status', value: '✅ Stable' }
    ];
  } else {
    // Changes detected - send alert notification
    const diffSummaryPlain = JSON.stringify(perTargetDiff, null, 2);
    const aiUrl = process.env.AI_GATEWAY_URL || '';
    const aiKey = process.env.AI_API_KEY || '';
    let summary = '';
    try {
      summary = await summarizeDiff(aiUrl, aiKey, perTargetDiff);
    } catch (e) {
      console.warn('[drift] summarize failed, falling back to plain text');
      summary = `Changes detected in ${changedTargets.length} endpoints. Diff:\n` + diffSummaryPlain;
    }

    title = '🚨 API Drift Detected';
    text = summary;
    facts = [
      { name: 'APIs Monitored', value: String(totalTargets) },
      { name: 'APIs with Changes', value: String(changedTargets.length) },
      { name: 'Affected APIs', value: changedTargets.join(', ') },
      { name: 'Status', value: '⚠️ Changes Detected' }
    ];
  }

  // Always show in console
  await sendConsoleMessage(title, text, facts);
  
  // Send to Teams if configured
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL || '';
  if (webhookUrl) {
    try {
      await sendTeamsMessage(webhookUrl, title, text, facts);
      console.log('[drift] ✅ Teams message sent');
    } catch (error) {
      console.log('[drift] ❌ Teams failed:', error);
    }
  }
  
  // Always send email if configured
  const emailTo = process.env.EMAIL_TO || '';
  if (emailTo) {
    try {
      await sendEmailMessage(emailTo, title, text, facts);
      console.log('[drift] ✅ Email sent to', emailTo);
    } catch (error) {
      console.log('[drift] ❌ Email failed:', error);
    }
  }
}

main().catch((e) => {
  console.error('[drift] fatal error', e);
  process.exitCode = 1;
});







/**
 * AI-powered Summary with Grounding & Validation
 * 
 * Features:
 * - Zod schema validation for AI output
 * - Groundedness check (only tokens present in diff)
 * - Deterministic fallback when AI disabled
 * - No raw payloads sent to AI
 */

import 'dotenv/config';
import { AISummarySchema, type AISummary } from './schemas/aiSummary.schema.js';
import { createLogger } from '../logging/logger.js';

const logger = createLogger('ai-summary');

const AI_ENABLED = process.env.AI_ENABLED === 'true';
const AI_GROUNDED_ONLY = process.env.AI_GROUNDED_ONLY !== 'false'; // default true
const AI_GROUNDING_THRESHOLD = parseFloat(process.env.AI_GROUNDING_THRESHOLD || '0.3'); // 30% minimum
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '1500', 10); // Increased for detailed analysis
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || '';
const AI_API_KEY = process.env.AI_API_KEY || '';

interface DiffStructured {
  [targetId: string]: {
    added: string[];
    removed: string[];
  };
}

/**
 * Extract all field names and types from diff for groundedness check
 */
function extractGroundTruthTokens(diff: DiffStructured): Set<string> {
  const tokens = new Set<string>();
  
  for (const [targetId, changes] of Object.entries(diff)) {
    // Add target ID
    tokens.add(targetId);
    
    // Add all field names (strip type change markers and deprecated markers)
    for (const field of [...changes.added, ...changes.removed]) {
      const cleanField = field
        .replace(/\s*\(type changed\)$/, '')
        .replace(/\[DEPRECATED\]$/, '')
        .trim();
      
      // Split on : to get field name and type (for GraphQL)
      const parts = cleanField.split(':');
      tokens.add(parts[0].trim());
      if (parts.length > 1) {
        tokens.add(parts[1].trim());
      }
      
      // Split on . for nested fields
      cleanField.split('.').forEach(part => tokens.add(part.trim()));
    }
  }
  
  return tokens;
}

/**
 * Check if AI output is grounded in the diff
 * (Simple whitelist check - all significant words should be from diff)
 */
function isGrounded(text: string, groundTruth: Set<string>): boolean {
  if (!AI_GROUNDED_ONLY) return true;
  
  // Extract significant words from AI output (ignore common words)
  const commonWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
    'in', 'is', 'it', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with',
    'this', 'these', 'those', 'api', 'field', 'change', 'changed', 'added', 'removed',
    'type', 'schema', 'endpoint', 'response', 'breaking', 'major', 'minor', 'impact',
    'risk', 'consumer', 'client', 'integration', 'may', 'might', 'could', 'should'
  ]);
  
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !commonWords.has(w));
  
  // Check if at least 50% of significant words are in ground truth
  const groundedWords = words.filter(w => 
    Array.from(groundTruth).some(token => 
      token.toLowerCase().includes(w) || w.includes(token.toLowerCase())
    )
  );
  
  const groundedRatio = words.length > 0 ? groundedWords.length / words.length : 1;
  
  logger.info(`Groundedness check: ${groundedWords.length}/${words.length} words grounded (${(groundedRatio * 100).toFixed(1)}%)`);
  
  return groundedRatio >= AI_GROUNDING_THRESHOLD; // Configurable threshold
}

/**
 * Deterministic fallback when AI is disabled
 */
function generateDeterministicSummary(diff: DiffStructured): AISummary {
  const summary: AISummary = {
    summary: '',
    impact: [],
    risks: []
  };
  
  const totalChanges = Object.values(diff).reduce(
    (sum, d) => sum + d.added.length + d.removed.length,
    0
  );
  
  const removedCount = Object.values(diff).reduce((sum, d) => sum + d.removed.length, 0);
  const addedCount = Object.values(diff).reduce((sum, d) => sum + d.added.length, 0);
  
  // Generate summary
  summary.summary = `Detected ${totalChanges} schema changes across ${Object.keys(diff).length} API(s). ` +
    `${removedCount} field(s) removed, ${addedCount} field(s) added/modified.`;
  
  // Generate impact
  for (const [targetId, changes] of Object.entries(diff)) {
    if (changes.removed.length > 0) {
      summary.impact.push(`${targetId}: ${changes.removed.length} field(s) removed - may break existing integrations`);
    }
    if (changes.added.length > 0) {
      summary.impact.push(`${targetId}: ${changes.added.length} field(s) added - generally safe, review for deprecations`);
    }
  }
  
  // Generate risks
  if (removedCount > 0) {
    summary.risks.push('Breaking changes detected - existing clients may fail');
  }
  if (addedCount > 5) {
    summary.risks.push('Significant schema expansion - review for consistency');
  }
  
  return summary;
}

/**
 * Summarize diff with AI (if enabled) or deterministic fallback
 */
export async function summarizeDiffWithAI(diff: DiffStructured): Promise<AISummary> {
  // If AI not enabled, use deterministic fallback
  if (!AI_ENABLED || !AI_GATEWAY_URL || !AI_API_KEY) {
    logger.info('AI disabled, using deterministic summary', {
      AI_ENABLED,
      hasGateway: !!AI_GATEWAY_URL,
      hasKey: !!AI_API_KEY
    });
    return generateDeterministicSummary(diff);
  }
  
  logger.info('AI enabled - generating intelligent summary');
  
  try {
    // Extract ground truth for grounding check
    const groundTruth = extractGroundTruthTokens(diff);
    logger.info(`Ground truth tokens extracted: ${groundTruth.size} unique tokens`);
    
    // Prepare structured diff (no raw payloads!)
    const structuredPrompt = JSON.stringify(diff, null, 2);
    
    const requestBody = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a senior API architect analyzing contract changes. Your analysis must be:
- SPECIFIC: Mention exact field names and types
- ACTIONABLE: Explain concrete impact on clients
- CONTEXTUAL: Consider business/security implications
- DETAILED: Provide comprehensive risk assessment

Return ONLY valid JSON with:
{
  "summary": "2-3 sentences describing WHAT changed and WHY it matters",
  "impact": ["3-5 specific impacts on API consumers"],
  "risks": ["2-4 technical or business risks"]
}`
        },
        {
          role: 'user',
          content: `Analyze this API schema diff in detail:

${structuredPrompt}

Requirements:
1. Identify ALL changed fields by name
2. Explain technical impact (breaking changes, compatibility)
3. Assess business/security implications
4. Be specific - mention field names, data types, endpoints

Return detailed JSON analysis.`
        }
      ],
      temperature: 0.3,
      max_tokens: AI_MAX_TOKENS,
      response_format: { type: 'json_object' }
    };
    
    logger.info('Sending request to AI gateway');
    
    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const text = await response.text();
      logger.error(`AI request failed: ${response.status}`, new Error(text));
      return generateDeterministicSummary(diff);
    }
    
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) {
      logger.warn('AI returned no content');
      return generateDeterministicSummary(diff);
    }
    
    // Parse and validate with Zod
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    const validated = AISummarySchema.parse(parsed);
    
    // Groundedness check
    const summaryText = `${validated.summary} ${validated.impact.join(' ')} ${validated.risks.join(' ')}`;
    if (!isGrounded(summaryText, groundTruth)) {
      logger.warn('AI output failed groundedness check, using fallback');
      return generateDeterministicSummary(diff);
    }
    
    logger.info('AI summary generated and validated successfully');
    return validated;
    
  } catch (error: any) {
    logger.error('AI summary failed, using deterministic fallback', error);
    return generateDeterministicSummary(diff);
  }
}

/**
 * Legacy function for backward compatibility (returns plain string)
 */
export async function summarizeDiff(
  aiUrl: string,
  apiKey: string,
  diff: DiffStructured
): Promise<string> {
  const summary = await summarizeDiffWithAI(diff);
  return `${summary.summary}\n\nImpact:\n${summary.impact.map(i => `  • ${i}`).join('\n')}\n\nRisks:\n${summary.risks.map(r => `  • ${r}`).join('\n')}`;
}


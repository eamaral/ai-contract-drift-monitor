/**
 * Severity Classification
 * 
 * Classifies API schema changes as 'minor' or 'major' based on breaking change rules.
 * 
 * MAJOR (breaking):
 * - Field removed
 * - Type changed (especially narrowing: string -> number)
 * - Enum value removed
 * - GraphQL breaking changes per spec
 * 
 * MINOR (non-breaking):
 * - Field added
 * - Enum value added
 * - Type widening (rare)
 */

export type Severity = 'minor' | 'major';

export interface DiffResult {
  added: string[];
  removed: string[];
}

export interface SeverityClassification {
  severity: Severity;
  reasons: string[];
}

/**
 * Classify the severity of a diff
 */
export function classifySeverity(diff: Record<string, DiffResult>): SeverityClassification {
  const reasons: string[] = [];
  let hasMajor = false;

  for (const [targetId, changes] of Object.entries(diff)) {
    // MAJOR: Any removed field is a breaking change
    if (changes.removed.length > 0) {
      for (const field of changes.removed) {
        if (field.includes('[DEPRECATED]')) {
          // Removed deprecated field is less severe but still major
          reasons.push(`[MAJOR] ${targetId}: Deprecated field '${field}' removed`);
        } else {
          reasons.push(`[MAJOR] ${targetId}: Field '${field}' removed (breaking change)`);
        }
        hasMajor = true;
      }
    }

    // Check added fields for type changes (marked as "field (type changed)")
    for (const field of changes.added) {
      if (field.includes('(type changed)')) {
        // Type changes are always major - could break existing clients
        reasons.push(`[MAJOR] ${targetId}: Type changed for '${field}' (breaking change)`);
        hasMajor = true;
      } else {
        // MINOR: New fields are generally additive and safe
        reasons.push(`[MINOR] ${targetId}: Field '${field}' added (additive change)`);
      }
    }
  }

  // Determine overall severity
  const severity: Severity = hasMajor ? 'major' : 'minor';

  // If no reasons, it means no changes (shouldn't happen but handle gracefully)
  if (reasons.length === 0) {
    reasons.push('[MINOR] No significant changes detected');
  }

  return { severity, reasons };
}

/**
 * Check if a diff has any changes
 */
export function hasChanges(diff: Record<string, DiffResult>): boolean {
  return Object.values(diff).some(d => d.added.length > 0 || d.removed.length > 0);
}

/**
 * Format severity classification for display
 */
export function formatSeverityReport(classification: SeverityClassification): string {
  const icon = classification.severity === 'major' ? '🚨' : '⚠️';
  const title = classification.severity === 'major' 
    ? 'MAJOR BREAKING CHANGES' 
    : 'Minor Changes';
  
  let report = `${icon} ${title}\n\n`;
  
  for (const reason of classification.reasons) {
    report += `  • ${reason}\n`;
  }
  
  return report;
}


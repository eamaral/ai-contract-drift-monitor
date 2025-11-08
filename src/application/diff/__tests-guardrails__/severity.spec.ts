/**
 * Unit tests for severity classification
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { classifySeverity, hasChanges, formatSeverityReport, type DiffResult } from '../severity.js';

test('classifySeverity - field removed is major', () => {
  const diff: Record<string, DiffResult> = {
    'test_api': {
      added: [],
      removed: ['userId']
    }
  };

  const result = classifySeverity(diff);
  assert.strictEqual(result.severity, 'major');
  assert.ok(result.reasons.some(r => r.includes('MAJOR') && r.includes('removed')));
});

test('classifySeverity - field added is minor', () => {
  const diff: Record<string, DiffResult> = {
    'test_api': {
      added: ['newField'],
      removed: []
    }
  };

  const result = classifySeverity(diff);
  assert.strictEqual(result.severity, 'minor');
  assert.ok(result.reasons.some(r => r.includes('MINOR') && r.includes('added')));
});

test('classifySeverity - type change is major', () => {
  const diff: Record<string, DiffResult> = {
    'test_api': {
      added: ['count (type changed)'],
      removed: []
    }
  };

  const result = classifySeverity(diff);
  assert.strictEqual(result.severity, 'major');
  assert.ok(result.reasons.some(r => r.includes('MAJOR') && r.includes('type changed')));
});

test('classifySeverity - deprecated field removed is major but noted', () => {
  const diff: Record<string, DiffResult> = {
    'test_api': {
      added: [],
      removed: ['oldField[DEPRECATED]']
    }
  };

  const result = classifySeverity(diff);
  assert.strictEqual(result.severity, 'major');
  assert.ok(result.reasons.some(r => r.includes('MAJOR') && r.includes('Deprecated')));
});

test('classifySeverity - mixed changes, major takes precedence', () => {
  const diff: Record<string, DiffResult> = {
    'test_api': {
      added: ['newField'],
      removed: ['oldField']
    }
  };

  const result = classifySeverity(diff);
  assert.strictEqual(result.severity, 'major');
  assert.strictEqual(result.reasons.length, 2);
  assert.ok(result.reasons.some(r => r.includes('MAJOR')));
  assert.ok(result.reasons.some(r => r.includes('MINOR')));
});

test('classifySeverity - multiple targets with different severities', () => {
  const diff: Record<string, DiffResult> = {
    'api_1': {
      added: ['newField'],
      removed: []
    },
    'api_2': {
      added: [],
      removed: ['criticalField']
    }
  };

  const result = classifySeverity(diff);
  assert.strictEqual(result.severity, 'major');
  assert.ok(result.reasons.some(r => r.includes('api_2') && r.includes('MAJOR')));
  assert.ok(result.reasons.some(r => r.includes('api_1') && r.includes('MINOR')));
});

test('hasChanges - returns true when changes exist', () => {
  const diff: Record<string, DiffResult> = {
    'test_api': {
      added: ['newField'],
      removed: []
    }
  };

  assert.strictEqual(hasChanges(diff), true);
});

test('hasChanges - returns false when no changes', () => {
  const diff: Record<string, DiffResult> = {
    'test_api': {
      added: [],
      removed: []
    }
  };

  assert.strictEqual(hasChanges(diff), false);
});

test('formatSeverityReport - formats major correctly', () => {
  const classification = {
    severity: 'major' as const,
    reasons: ['[MAJOR] test: Field removed']
  };

  const report = formatSeverityReport(classification);
  assert.ok(report.includes('🚨'));
  assert.ok(report.includes('MAJOR BREAKING CHANGES'));
  assert.ok(report.includes('Field removed'));
});

test('formatSeverityReport - formats minor correctly', () => {
  const classification = {
    severity: 'minor' as const,
    reasons: ['[MINOR] test: Field added']
  };

  const report = formatSeverityReport(classification);
  assert.ok(report.includes('⚠️'));
  assert.ok(report.includes('Minor Changes'));
  assert.ok(report.includes('Field added'));
});


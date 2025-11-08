/**
 * Unified Metrics Module
 * 
 * Provides:
 * - Prometheus metrics (always enabled)
 * - DogStatsD integration (optional, if DD_AGENT_HOST is set)
 * - Custom counters and histograms for drift monitoring
 */

import 'dotenv/config';
import { Counter, Histogram, register, collectDefaultMetrics } from 'prom-client';
import { createSocket, Socket } from 'node:dgram';

// Configuration
const DD_AGENT_HOST = process.env.DD_AGENT_HOST || '';
const DD_DOGSTATSD_PORT = parseInt(process.env.DD_DOGSTATSD_PORT || '8125', 10);
const METRICS_ENABLED = true; // Always enabled for Prometheus

// DogStatsD client (optional)
let dogstatsdClient: Socket | null = null;
if (DD_AGENT_HOST) {
  dogstatsdClient = createSocket('udp4');
  console.log(`[metrics] DogStatsD enabled: ${DD_AGENT_HOST}:${DD_DOGSTATSD_PORT}`);
}

// Initialize default Prometheus metrics
collectDefaultMetrics({ prefix: 'ai_monitor_' });

// Custom Prometheus Metrics
const prometheusCounters: Map<string, Counter> = new Map();
const prometheusHistograms: Map<string, Histogram> = new Map();

/**
 * Metric definitions with their specific label names
 */
const METRIC_LABELS: Record<string, string[]> = {
  'http_requests_total': ['target', 'method', 'status'],
  'http_retry_total': ['target', 'method'],
  'http_timeout_total': ['target', 'method'],
  'http_request_duration_seconds': ['target', 'method'],
  'drift_checks_total': ['outcome'],
  'drift_detected_total': [],
  'drift_minor_total': [],
  'drift_major_total': [],
  'alerts_sent_total': ['channel', 'outcome'],
  'alerts_failed_total': ['channel'],
  'snapshot_updates_total': ['severity', 'mode'],
  'snapshot_pr_created_total': ['severity', 'should_block'],
  'flaky_tests_total': [],
  'reruns_total': [],
  'drift_check_duration_seconds': ['outcome']
};

/**
 * Get or create a Prometheus counter
 */
function getPrometheusCounter(name: string, help: string, labelNames?: string[]): Counter {
  if (!prometheusCounters.has(name)) {
    // Use metric-specific labels or default to empty
    const labels = labelNames || METRIC_LABELS[name] || [];
    prometheusCounters.set(name, new Counter({
      name: `ai_monitor_${name}`,
      help,
      labelNames: labels
    }));
  }
  return prometheusCounters.get(name)!;
}

/**
 * Get or create a Prometheus histogram
 */
function getPrometheusHistogram(name: string, help: string, labelNames?: string[]): Histogram {
  if (!prometheusHistograms.has(name)) {
    // Use metric-specific labels or default to empty
    const labels = labelNames || METRIC_LABELS[name] || [];
    prometheusHistograms.set(name, new Histogram({
      name: `ai_monitor_${name}`,
      help,
      labelNames: labels,
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    }));
  }
  return prometheusHistograms.get(name)!;
}

/**
 * Send metric to DogStatsD if enabled
 */
function sendDogStatsD(metric: string, value: number, type: 'c' | 'h' | 'ms', tags: string[] = []): void {
  if (!dogstatsdClient || !DD_AGENT_HOST) return;

  const tagsStr = tags.length > 0 ? `|#${tags.join(',')}` : '';
  const message = `ai_monitor.${metric}:${value}|${type}${tagsStr}`;

  dogstatsdClient.send(message, DD_DOGSTATSD_PORT, DD_AGENT_HOST, (err) => {
    if (err) {
      console.error(`[metrics] DogStatsD error:`, err);
    }
  });
}

/**
 * Increment a counter
 */
export function incCounter(name: string, labels: Record<string, string> = {}): void {
  if (!METRICS_ENABLED) return;

  // Prometheus
  const counter = getPrometheusCounter(name, `Counter for ${name}`);
  counter.inc(labels);

  // DogStatsD
  const tags = Object.entries(labels).map(([k, v]) => `${k}:${v}`);
  sendDogStatsD(name, 1, 'c', tags);
}

/**
 * Observe a histogram value (for durations)
 */
export function observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
  if (!METRICS_ENABLED) return;

  // Prometheus
  const histogram = getPrometheusHistogram(name, `Histogram for ${name}`);
  histogram.observe(labels, value);

  // DogStatsD (convert to milliseconds)
  const tags = Object.entries(labels).map(([k, v]) => `${k}:${v}`);
  sendDogStatsD(name, value * 1000, 'ms', tags);
}

/**
 * Register pre-defined metrics for the drift monitor
 */
export function registerDriftMetrics(): void {
  // HTTP metrics
  getPrometheusCounter('http_requests_total', 'Total HTTP requests');
  getPrometheusCounter('http_retry_total', 'Total HTTP retries');
  getPrometheusCounter('http_timeout_total', 'Total HTTP timeouts');
  getPrometheusHistogram('http_request_duration_seconds', 'HTTP request duration in seconds');

  // Drift metrics
  getPrometheusCounter('drift_checks_total', 'Total drift checks performed');
  getPrometheusCounter('drift_detected_total', 'Total drift events detected');
  getPrometheusCounter('drift_minor_total', 'Total minor drift events');
  getPrometheusCounter('drift_major_total', 'Total major drift events');

  // Alert metrics
  getPrometheusCounter('alerts_sent_total', 'Total alerts sent');
  getPrometheusCounter('alerts_failed_total', 'Total alerts failed');

  // Snapshot metrics
  getPrometheusCounter('snapshot_updates_total', 'Total snapshot updates');
  getPrometheusCounter('snapshot_pr_created_total', 'Total PRs created for snapshots');

  // Placeholder metrics for future use (test rerun tracking)
  getPrometheusCounter('flaky_tests_total', 'Total flaky tests detected');
  getPrometheusCounter('reruns_total', 'Total test reruns');

  console.log('[metrics] Drift monitor metrics registered');
}

/**
 * Get Prometheus registry (for exposing /metrics endpoint)
 */
export function getPrometheusRegistry() {
  return register;
}

/**
 * Close DogStatsD client if open
 */
export function closeDogStatsD(): void {
  if (dogstatsdClient) {
    dogstatsdClient.close();
    dogstatsdClient = null;
    console.log('[metrics] DogStatsD client closed');
  }
}

// Auto-register metrics on module load
registerDriftMetrics();


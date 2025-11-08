import 'dotenv/config';
import express from 'express';
import { getPrometheusRegistry } from './metrics.js';

const app = express();
const port = process.env.METRICS_PORT || process.env.PROMETHEUS_PORT || 9091;

// Get the unified metrics registry
const register = getPrometheusRegistry();

// Endpoint for Prometheus metrics
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex: any) {
    res.status(500).end(ex.message || 'Internal error');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    metrics: {
      endpoint: `http://localhost:${port}/metrics`,
      prefix: 'ai_monitor_'
    }
  });
});

app.listen(port, () => {
  console.log(`[metrics] 📊 Prometheus metrics server running`);
  console.log(`[metrics] 📈 Metrics: http://localhost:${port}/metrics`);
  console.log(`[metrics] ❤️  Health: http://localhost:${port}/health`);
  console.log(`[metrics] 🏷️  Prefix: ai_monitor_*`);
});

import 'dotenv/config';
import express from 'express';
import { register, collectDefaultMetrics } from 'prom-client';

// Coleta métricas padrão do Node.js
collectDefaultMetrics();

const app = express();
const port = process.env.METRICS_PORT || 9090;

// Endpoint para métricas Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`[metrics] Prometheus metrics server running on http://localhost:${port}/metrics`);
  console.log(`[metrics] Health check available at http://localhost:${port}/health`);
});

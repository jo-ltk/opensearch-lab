// New Relic must load before any other module so APM instrumentation wraps Express, HTTP, etc.
require('newrelic');

// Observability Lab API
// - APM:     New Relic agent     -> traces, errors, Node runtime metrics in NR UI
// - Logs:    pino + pino-http  -> structured JSON on stdout -> Fluent Bit -> OpenSearch (+ NR log forwarding)
// - Metrics: prom-client       -> GET /metrics              -> scraped by Prometheus

const express = require('express');
const cors = require('cors');
const pino = require('pino');
const pinoHttp = require('pino-http');
const promClient = require('prom-client');

const PORT = process.env.PORT || 4000;

// ---------------------------------------------------------------------------
// Logging setup (Phase 2)
// ---------------------------------------------------------------------------
const logger = pino({
  // ISO timestamps so Fluent Bit / OpenSearch can parse the event time
  timestamp: pino.stdTimeFunctions.isoTime,
  // Log "level":"info" instead of "level":30 — much nicer to filter in Dashboards
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: { service: 'lab-api' },
});

// Known routes only — anything else becomes "other" so we never create
// unbounded label values in metrics (cardinality!) or noisy log fields.
const hostDemo = require('./host-demo');

const KNOWN_ROUTES = [
  '/api/products',
  '/api/slow',
  '/api/error',
  '/api/burn',
  '/api/leak',
  '/api/demo/cpu',
  '/api/demo/memory',
  '/api/demo/disk',
  '/api/demo/network',
  '/api/demo/load',
  '/api/demo/payload',
  '/api/demo/slack',
  '/health',
  '/metrics',
  '/alert-hook',
];
const normalizeRoute = (path) => (KNOWN_ROUTES.includes(path) ? path : 'other');

// ---------------------------------------------------------------------------
// Metrics setup (Phase 3)
// ---------------------------------------------------------------------------
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register }); // node process CPU, memory, event loop lag...

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests handled',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5],
  registers: [register],
});

// ---------------------------------------------------------------------------
// App + middleware
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// Request logging: one structured log line per request
app.use(
  pinoHttp({
    logger,
    customProps: (req, res) => ({
      route: normalizeRoute(req.path ?? req.url),
      status: res.statusCode,
    }),
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: {
      ignore: (req) => req.url === '/metrics' || req.url === '/health',
    },
  })
);

// Request metrics: count + duration for every request
app.use((req, res, next) => {
  const endTimer = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: normalizeRoute(req.path),
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });
  next();
});

// ---------------------------------------------------------------------------
// Demo endpoints
// ---------------------------------------------------------------------------
const PRODUCTS = [
  { id: 1, name: 'Mechanical Keyboard', price: 4999 },
  { id: 2, name: 'Ultrawide Monitor', price: 28999 },
  { id: 3, name: 'USB-C Dock', price: 6499 },
  { id: 4, name: 'Noise-Cancelling Headphones', price: 15999 },
];

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime_s: Math.round(process.uptime()) });
});

app.get('/api/products', (req, res) => {
  req.log.info({ count: PRODUCTS.length }, 'products fetched');
  res.json({ products: PRODUCTS });
});

// Random 0.5s - 3s delay: feeds the latency histogram + p95 panels
app.get('/api/slow', async (req, res) => {
  const delayMs = 500 + Math.floor(Math.random() * 2500);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  req.log.info({ delay_ms: delayMs }, 'slow request completed');
  res.json({ message: 'finally done', delay_ms: delayMs });
});

// Fails ~30% of the time: feeds error logs + error-rate metric + alert
app.get('/api/error', (req, res) => {
  if (Math.random() < 0.3) {
    req.log.error({ reason: 'simulated_failure' }, 'flaky endpoint blew up');
    return res.status(500).json({ error: 'Something went wrong (on purpose)' });
  }
  res.json({ message: 'you got lucky this time' });
});

// Burns CPU in setImmediate slices (keeps event loop responsive) to trigger CPU alert.
// Usage: GET /api/burn?seconds=120
let burning = false;
app.get('/api/burn', (req, res) => {
  const seconds = Math.min(parseInt(req.query.seconds, 10) || 60, 300);
  if (burning) return res.json({ message: 'already burning' });
  burning = true;
  const endAt = Date.now() + seconds * 1000;
  req.log.warn({ seconds }, 'CPU burn started');
  const slice = () => {
    if (Date.now() >= endAt) {
      burning = false;
      logger.info('CPU burn finished');
      return;
    }
    const sliceEnd = Date.now() + 50; // burn 50ms, then yield
    while (Date.now() < sliceEnd) Math.sqrt(Math.random());
    setImmediate(slice);
  };
  setImmediate(slice);
  res.json({ message: `burning CPU for ${seconds}s`, tip: 'watch the CPU panel in Grafana' });
});

// Allocates and retains 50MB per call to trigger the memory alert.
// Usage: GET /api/leak   (repeat a few times)   GET /api/leak?clear=true to release
const leakedBuffers = [];
app.get('/api/leak', (req, res) => {
  if (req.query.clear === 'true') {
    leakedBuffers.length = 0;
    req.log.info('leaked memory released');
    return res.json({ message: 'memory released', retained_mb: 0 });
  }
  leakedBuffers.push(Buffer.alloc(50 * 1024 * 1024, 1));
  const retainedMb = leakedBuffers.length * 50;
  req.log.warn({ retained_mb: retainedMb }, 'memory leaked on purpose');
  res.json({ message: 'leaked 50MB', retained_mb: retainedMb });
});

// Host metrics demo — each endpoint moves one Grafana chart (Node Exporter path).
app.get('/api/demo/cpu', (req, res) => {
  const seconds = Math.min(parseInt(req.query.seconds, 10) || 45, 120);
  req.log.warn({ seconds }, 'host demo: CPU burn');
  res.json(hostDemo.startCpuBurn(seconds));
});

app.get('/api/demo/memory', (req, res) => {
  const mb = Math.min(parseInt(req.query.mb, 10) || 800, 1500);
  req.log.warn({ mb }, 'host demo: memory consume');
  res.json(hostDemo.startMemoryConsume(mb));
});

app.get('/api/demo/disk', (req, res) => {
  const mb = Math.min(parseInt(req.query.mb, 10) || 200, 1000);
  req.log.warn({ mb }, 'host demo: disk fill');
  res.json(hostDemo.startDiskFill(mb));
});

app.get('/api/demo/network', (req, res) => {
  const seconds = Math.min(parseInt(req.query.seconds, 10) || 30, 90);
  req.log.warn({ seconds }, 'host demo: network pump');
  res.json(hostDemo.startNetworkPump(seconds));
});

app.get('/api/demo/load', (req, res) => {
  const seconds = Math.min(parseInt(req.query.seconds, 10) || 45, 120);
  req.log.warn({ seconds }, 'host demo: system load');
  res.json(hostDemo.startLoad(seconds));
});

app.get('/api/demo/payload', hostDemo.payloadHandler);

app.get('/api/demo/slack', async (req, res) => {
  const alert = ['cpu', 'memory', 'disk'].includes(req.query.alert) ? req.query.alert : 'cpu';
  req.log.info({ alert }, 'host demo: slack alert');
  const result = await hostDemo.sendSlackAlert(alert);
  res.status(result.ok ? 200 : 503).json({ message: result.message });
});

// Grafana webhook contact point posts alert notifications here (Phase 5).
// The alert notification itself becomes a log you can find in OpenSearch!
app.post('/alert-hook', (req, res) => {
  const { status, alerts = [] } = req.body || {};
  req.log.warn(
    {
      alert_status: status,
      alert_names: alerts.map((a) => a.labels?.alertname),
      payload: req.body,
    },
    `grafana alert notification: ${status}`
  );
  res.json({ received: true });
});

// Prometheus scrapes this (Phase 3)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'lab-api listening');
});

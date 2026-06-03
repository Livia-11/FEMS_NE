require('dotenv').config({ path: '../.env' });
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const axios = require('axios');

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

const SERVICES = {
  users:         process.env.USER_SERVICE_URL         || 'http://localhost:3001',
  extinguishers: process.env.EXTINGUISHER_SERVICE_URL || 'http://localhost:3002',
  reports:       process.env.REPORTING_SERVICE_URL    || 'http://localhost:3003',
  notifications: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
};

// ── Security headers ─────────────────────────────────────────────────────────
// CSP is configured to allow Swagger UI's inline scripts/styles while still
// providing meaningful protection against XSS on other routes.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Swagger UI resources
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
// Restrict to known frontend origins rather than '*' to prevent
// cross-origin credential theft. Multiple origins can be supplied
// via CORS_ORIGIN as a comma-separated list (e.g. for staging + prod).
const ALLOWED_ORIGINS = Array.from(new Set([
  ...(process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  `http://localhost:${PORT}`,
]));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) return cb(null, true);
    cb(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Key'],
  credentials: true,
}));

// ── HTTP access logging ───────────────────────────────────────────────────────
// 'dev' format gives readable coloured output in development;
// 'combined' (Apache format) is better suited for log aggregation in production.
const IS_DEV = process.env.NODE_ENV !== 'production';
app.use(morgan(IS_DEV ? 'dev' : 'combined'));

// ── Request timing — stamps every request, prints breakdown on finish ─────────
app.use((req, res, next) => {
  req._gwStart = process.hrtime.bigint();
  res.on('finish', () => {
    const total = Number(process.hrtime.bigint() - req._gwStart) / 1e6;
    // Skip swagger/static noise — only log API calls
    if (!req.url.startsWith('/api')) return;
    const flag = total > 500 ? ' ⚠ SLOW' : total > 200 ? ' △' : '';
    console.log(`[GW] ${req.method} ${req.url} → ${res.statusCode} | total=${total.toFixed(1)}ms${flag}`);
  });
  next();
});

// ── Global rate limiter ───────────────────────────────────────────────────────
// Broad limit across all routes to blunt large-scale abuse and DDoS attempts.
// Intentionally generous — the per-route auth limiter below is much stricter.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ── Auth-endpoint rate limiter ────────────────────────────────────────────────
// Stricter limit on authentication endpoints to slow brute-force and
// credential-stuffing attacks without impacting normal API traffic.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/register',        authLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled(
    Object.entries(SERVICES).map(async ([name, url]) => {
      const resp = await axios.get(`${url}/health`, { timeout: 3000 });
      return { name, status: 'up', data: resp.data };
    })
  );
  const results = checks.map((c, i) => {
    const name = Object.keys(SERVICES)[i];
    return c.status === 'fulfilled' ? c.value : { name, status: 'down', error: c.reason?.message };
  });
  const allUp = results.every(r => r.status === 'up');
  res.status(allUp ? 200 : 207).json({
    gateway: 'up',
    timestamp: new Date().toISOString(),
    services: results,
  });
});

// ── Swagger spec cache (built once at startup, refreshed every 2 min) ─────────
let swaggerCache = null;

async function buildSwaggerSpec() {
  const specs = await Promise.allSettled(
    Object.entries(SERVICES).map(async ([name, url]) => {
      const resp = await axios.get(`${url}/swagger.json`, { timeout: 5000 });
      return { name, spec: resp.data };
    })
  );

  const combined = {
    openapi: '3.0.0',
    info: {
      title: 'TZW LTD — Fire Extinguisher Management System API',
      version: '1.0.0',
      description: 'Complete RESTful API for FEMS. All endpoints require a Bearer JWT token unless marked as public.',
      contact: { name: 'TZW LTD', email: 'dev@tzwltd.com' },
    },
    servers: [{ url: `http://localhost:${PORT}`, description: 'API Gateway' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas: {} },
    security: [{ bearerAuth: [] }],
    paths: {},
    tags: [],
  };

  for (const result of specs) {
    if (result.status === 'fulfilled') {
      const { spec } = result.value;
      if (spec.paths)               Object.assign(combined.paths, spec.paths);
      if (spec.components?.schemas) Object.assign(combined.components.schemas, spec.components.schemas);
      if (spec.tags)                combined.tags.push(...spec.tags);
    }
  }
  return combined;
}

// Wait for all services to be ready, then build cache.
// Retries every 2 s up to 30 attempts so it survives slow DB-init services.
async function buildCacheWhenReady(attempt = 1) {
  try {
    const spec = await buildSwaggerSpec();
    // Only accept the spec if it actually has paths (all services responded)
    if (Object.keys(spec.paths).length > 0) {
      swaggerCache = spec;
      console.log(`[gateway] Swagger spec cached (${Object.keys(spec.paths).length} paths, attempt ${attempt})`);
      // Refresh every 2 minutes in the background
      setInterval(() => {
        buildSwaggerSpec().then(s => {
          if (Object.keys(s.paths).length > 0) swaggerCache = s;
        }).catch(e => console.warn('[gateway] Swagger cache refresh failed:', e.message));
      }, 2 * 60 * 1000);
      return;
    }
  } catch (_) {}

  if (attempt < 30) {
    setTimeout(() => buildCacheWhenReady(attempt + 1), 2000);
  } else {
    console.warn('[gateway] Could not build swagger cache after 30 attempts');
  }
}

// Start the retry loop 2 s after gateway boot (give services time to start)
setTimeout(() => buildCacheWhenReady(), 2000);

app.get('/swagger.json', async (req, res) => {
  if (swaggerCache) return res.json(swaggerCache);
  // Cache not ready yet (services still booting) — build on demand
  try {
    const spec = await buildSwaggerSpec();
    if (Object.keys(spec.paths).length > 0) swaggerCache = spec;
    res.json(spec);
  } catch (err) {
    res.status(500).json({ error: 'Failed to aggregate swagger specs', detail: err.message });
  }
});

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(null, {
  swaggerOptions: { url: `http://localhost:${PORT}/swagger.json` },
  customSiteTitle: 'TZW LTD FEMS API Docs',
}));

// ── Proxy routes ──────────────────────────────────────────────────────────────
// Each route is forwarded to the appropriate downstream microservice.
// The proxy middleware measures round-trip time and logs gateway overhead
// separately from service latency to aid performance diagnosis.
function restreamJsonBody(proxyReq, req) {
  if (!req.body || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;

  const bodyData = JSON.stringify(req.body);
  proxyReq.setHeader('Content-Type', 'application/json');
  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
}

const proxyOpts = (target, serviceName) => ({
  target,
  changeOrigin: true,
  proxyTimeout: 10000,  // give up after 10s waiting for the downstream service
  onProxyReq: (proxyReq, req) => {
    req._svcStart = process.hrtime.bigint();
    req._svcName  = serviceName;
    restreamJsonBody(proxyReq, req);
  },
  onProxyRes: (proxyRes, req) => {
    const svcMs    = Number(process.hrtime.bigint() - (req._svcStart || process.hrtime.bigint())) / 1e6;
    const gwMs     = Number(process.hrtime.bigint() - (req._gwStart  || process.hrtime.bigint())) / 1e6;
    const overhead = gwMs - svcMs;
    console.log(
      `[GW→${req._svcName}] ${req.method} ${req.url} ${proxyRes.statusCode}` +
      ` | svc=${svcMs.toFixed(1)}ms  gw-overhead=${overhead.toFixed(1)}ms`
    );
  },
  onError: (err, req, res) => {
    const ms = req._svcStart
      ? (Number(process.hrtime.bigint() - req._svcStart) / 1e6).toFixed(0)
      : '?';
    console.error(`[GW→${serviceName}] ERROR after ${ms}ms: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: `${serviceName} service unavailable`, detail: err.message });
    }
  },
});

app.use('/api/auth',          createProxyMiddleware(proxyOpts(SERVICES.users,         'users')));
app.use('/api/users',         createProxyMiddleware(proxyOpts(SERVICES.users,         'users')));
app.use('/api/extinguishers', createProxyMiddleware(proxyOpts(SERVICES.extinguishers, 'extinguishers')));
app.use('/api/inspections',   createProxyMiddleware(proxyOpts(SERVICES.extinguishers, 'extinguishers')));
app.use('/api/maintenance',   createProxyMiddleware(proxyOpts(SERVICES.extinguishers, 'extinguishers')));
app.use('/api/reports',       createProxyMiddleware(proxyOpts(SERVICES.reports,       'reports')));
app.use('/api/notifications', createProxyMiddleware(proxyOpts(SERVICES.notifications, 'notifications')));

// ── Body parser ───────────────────────────────────────────────────────────────
// Keep this after proxy routes so proxied requests reach services with their
// original body stream intact.
app.use(express.json({ limit: '50kb' }));

app.get('/', (req, res) => {
  res.json({
    name: 'TZW LTD FEMS API Gateway',
    version: '1.0.0',
    docs: `http://localhost:${PORT}/api-docs`,
    health: `http://localhost:${PORT}/health`,
    services: Object.fromEntries(
      Object.entries(SERVICES).map(([k, v]) => [k, `${v}/api-docs`])
    ),
  });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
// Catch-all for any error thrown or passed to next() in the middleware chain.
// The gateway should never expose internal stack traces to clients.
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  console.error(`[gateway] ${req.method} ${req.url} → ERROR ${status}: ${err.message}`);
  res.status(status).json({ error: err.message || 'Gateway error' });
});

app.listen(PORT, () => {
  console.log(`\n==========================================`);
  console.log(`  TZW LTD FEMS API Gateway`);
  console.log(`  Port     : ${PORT}`);
  console.log(`  Docs     : http://localhost:${PORT}/api-docs`);
  console.log(`  Health   : http://localhost:${PORT}/health`);
  console.log(`==========================================\n`);
});

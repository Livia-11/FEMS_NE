require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const { initDb } = require('./database');
const path = require('path');
const timing = require('../shared/timing');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

const app  = express();
const PORT = process.env.USER_SERVICE_PORT || 3001;

// ── Security headers ──────────────────────────────────────────────────────────
// Helmet sets a strong baseline of HTTP security headers (X-Frame-Options,
// X-Content-Type-Options, HSTS, etc.) with Express defaults.
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
// Restrict to known frontend origins rather than '*' so cookies and
// Authorization headers cannot be read by arbitrary third-party sites.
// In production set CORS_ORIGIN to the actual frontend domain(s).
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim());
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

// ── Body parser ───────────────────────────────────────────────────────────────
// 50 kb cap prevents oversized payload attacks and reduces memory pressure
// from malformed or deliberately large request bodies.
app.use(express.json({ limit: '50kb' }));

// ── Rate limiter ──────────────────────────────────────────────────────────────
// Broad per-IP limit to blunt abuse. The API gateway applies its own
// stricter limiter on /api/auth/* routes before requests reach this service.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// ── Request timing ────────────────────────────────────────────────────────────
app.use(timing('user-svc'));

// ── Swagger / API docs ────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Management Service',
      version: '1.0.0',
      description: 'Handles registration, JWT authentication, and user profile management. Database: PostgreSQL (fems_users).',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Authentication', description: 'Login, register, password management' },
      { name: 'Users',          description: 'User CRUD and role management' },
    ],
  },
  apis: ['./routes/*.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (req, res) => res.json(swaggerSpec));

// ── Application routes ────────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/users', userRoutes);

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'user-service', port: PORT, db: 'postgresql' }));

// ── Global error handler ──────────────────────────────────────────────────────
// Hide stack traces from API responses in production to avoid leaking
// implementation details; expose full messages in development for easier debugging.
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const isDev  = process.env.NODE_ENV !== 'production';
  console.error(`[user-svc] ${req.method} ${req.url} → ${status}: ${err.message}`);
  if (isDev) console.error(err.stack);
  res.status(status).json({
    error: isDev ? err.message : (status < 500 ? err.message : 'Internal server error'),
  });
});

async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[user-service] Running on http://localhost:${PORT}`);
    console.log(`[user-service] Swagger UI: http://localhost:${PORT}/api-docs`);
  });
}

main().catch(err => {
  console.error('[user-service] Startup failed:', err.message);
  process.exit(1);
});

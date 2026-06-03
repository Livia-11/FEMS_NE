require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const path = require('path');
const timing = require('../shared/timing');
const reportRoutes = require('./routes/reports');

const app  = express();
const PORT = process.env.REPORTING_SERVICE_PORT || 3003;

// Detect environment once — used for logging verbosity and error detail
const IS_DEV = process.env.NODE_ENV !== 'production';

// helmet sets security-relevant HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
// in a single call; should be the first middleware so headers apply to every response
app.use(helmet());

// Restrict CORS to known frontend origins (configurable via CORS_ORIGIN env var)
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Morgan HTTP request logger — 'dev' is concise/colourised for local development;
// 'combined' emits Apache-style lines suitable for log aggregators in production
app.use(morgan(IS_DEV ? 'dev' : 'combined'));

// Enforce a body-size cap so a large payload cannot tie up the event loop
// or exhaust memory before route handlers even run
app.use(express.json({ limit: '50kb' }));

// Brute-force / DoS protection: cap each IP to 100 requests per 15-minute window
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Attach X-Response-Time header so slow queries are visible in logs/APM
app.use(timing('report-svc'));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Reporting Service',
      version: '1.0.0',
      description: 'Real-time reports: inventory, inspection, compliance, maintenance, PDF/CSV export.',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Reports', description: 'Inventory, inspection, compliance, maintenance reports' },
    ],
  },
  apis: ['./routes/*.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (req, res) => res.json(swaggerSpec));

app.use('/api/reports', reportRoutes);

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'reporting-service', port: PORT }));

// Global error handler — hides stack traces in production to prevent info leakage
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const isDev  = process.env.NODE_ENV !== 'production';
  console.error(`[report-svc] ${req.method} ${req.url} → ERROR ${status}: ${err.message}`);
  if (isDev) console.error(err.stack);
  res.status(status).json({
    error: isDev ? err.message : (status < 500 ? err.message : 'Internal server error'),
  });
});

app.listen(PORT, () => {
  console.log(`[reporting-service] Running on http://localhost:${PORT}`);
  console.log(`[reporting-service] Swagger UI: http://localhost:${PORT}/api-docs`);
});

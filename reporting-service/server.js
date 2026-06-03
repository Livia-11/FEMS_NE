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

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
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

app.use((err, req, res, _next) => {
  console.error('[reporting-service]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[reporting-service] Running on http://localhost:${PORT}`);
  console.log(`[reporting-service] Swagger UI: http://localhost:${PORT}/api-docs`);
});

require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const path = require('path');
const { initDb } = require('./database');
const timing = require('../shared/timing');
const extinguisherRoutes = require('./routes/extinguishers');
const inspectionRoutes   = require('./routes/inspections');
const maintenanceRoutes  = require('./routes/maintenance');

const app  = express();
const PORT = process.env.EXTINGUISHER_SERVICE_PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(timing('ext-svc'));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Fire Extinguisher Management Service',
      version: '1.0.0',
      description: 'Extinguisher inventory, inspection scheduling, and maintenance logging. Database: PostgreSQL (fems_extinguishers).',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Extinguishers', description: 'Fire extinguisher CRUD and inventory' },
      { name: 'Inspections',   description: 'Inspection scheduling and results' },
      { name: 'Maintenance',   description: 'Maintenance logging and history' },
    ],
  },
  apis: ['./routes/*.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (req, res) => res.json(swaggerSpec));

app.use('/api/extinguishers', extinguisherRoutes);
app.use('/api/inspections',   inspectionRoutes);
app.use('/api/maintenance',   maintenanceRoutes);

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'extinguisher-service', port: PORT, db: 'postgresql' }));

app.use((err, req, res, _next) => {
  console.error('[extinguisher-service]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[extinguisher-service] Running on http://localhost:${PORT}`);
    console.log(`[extinguisher-service] Swagger UI: http://localhost:${PORT}/api-docs`);
  });
}

main().catch(err => {
  console.error('[extinguisher-service] Startup failed:', err.message);
  process.exit(1);
});

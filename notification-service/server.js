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
const notificationRoutes = require('./routes/notifications');

const app  = express();
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use(timing('notify-svc'));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Notification Service',
      version: '1.0.0',
      description: 'In-app and email notifications. Database: PostgreSQL (fems_notifications).',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    security: [{ bearerAuth: [] }],
    tags: [{ name: 'Notifications', description: 'Notification management' }],
  },
  apis: ['./routes/*.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (req, res) => res.json(swaggerSpec));

app.use('/api/notifications', notificationRoutes);

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'notification-service', port: PORT, db: 'postgresql' }));

app.use((err, req, res, _next) => {
  console.error('[notification-service]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[notification-service] Running on http://localhost:${PORT}`);
    console.log(`[notification-service] Swagger UI: http://localhost:${PORT}/api-docs`);
  });
}

main().catch(err => {
  console.error('[notification-service] Startup failed:', err.message);
  process.exit(1);
});

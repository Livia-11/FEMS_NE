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

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use(timing('user-svc'));

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

app.use('/api/auth',  authRoutes);
app.use('/api/users', userRoutes);

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'user-service', port: PORT, db: 'postgresql' }));

app.use((err, req, res, _next) => {
  console.error('[user-service]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
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

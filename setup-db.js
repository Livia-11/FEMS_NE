/**
 * Creates all required PostgreSQL databases for FEMS.
 * Run once before starting services: node setup-db.js
 */
require('dotenv').config();
const { Client } = require('pg');

const PG_CONFIG = {
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'postgre',
  database: 'postgres',
};

// All services share the single 'fems' database
const DATABASES = ['fems'];

async function createIfMissing(name) {
  const client = new Client(PG_CONFIG);
  await client.connect();
  try {
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!res.rows.length) {
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`  ✓ Created: ${name}`);
    } else {
      console.log(`  - Exists:  ${name}`);
    }
  } finally {
    await client.end();
  }
}

(async () => {
  console.log('\nSetting up FEMS PostgreSQL databases...\n');
  for (const db of DATABASES) {
    await createIfMissing(db);
  }
  console.log('\nDone. Start services with: npm start\n');
})().catch(err => {
  console.error('\nError:', err.message);
  console.error('Make sure PostgreSQL is running and credentials in .env are correct.\n');
  process.exit(1);
});

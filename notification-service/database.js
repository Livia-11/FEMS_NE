require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host:                    process.env.PG_HOST            || 'localhost',
  port:                    parseInt(process.env.PG_PORT   || '5432'),
  user:                    process.env.PG_USER            || 'postgres',
  password:                process.env.PG_PASSWORD        || 'postgre',
  database:                process.env.PG_NOTIFICATION_DB || 'fems',
  max:                     10,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 5000,
  statement_timeout:       8000,
  query_timeout:           8000,
});

pool.on('error', (err) => console.error('[notification-service] PG pool error:', err.message));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id           SERIAL      PRIMARY KEY,
      recipient_id INTEGER,
      type         TEXT        NOT NULL,
      title        TEXT        NOT NULL,
      message      TEXT        NOT NULL,
      is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
      email_sent   BOOLEAN     NOT NULL DEFAULT FALSE,
      metadata     JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at      TIMESTAMPTZ
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notif_type      ON notifications(type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notif_read      ON notifications(is_read)`);

  console.log('[notification-service] PostgreSQL ready (fems)');
}

const _query = pool.query.bind(pool);
pool.query = function (text, params) {
  const start = Date.now();
  const sql   = (typeof text === 'string' ? text : text?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return _query(text, params).then(result => {
    const ms = Date.now() - start;
    if (ms > 20) console.log(`[notify-svc DB ${ms}ms] ${sql}`);
    return result;
  });
};

module.exports = { pool, initDb };

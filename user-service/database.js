require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host:                    process.env.PG_HOST     || 'localhost',
  port:                    parseInt(process.env.PG_PORT || '5432'),
  user:                    process.env.PG_USER     || 'postgres',
  password:                process.env.PG_PASSWORD || 'postgre',
  database:                process.env.PG_USER_DB  || 'fems',
  max:                     10,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 5000,
  statement_timeout:       8000,   // kill any query that takes > 8s
  query_timeout:           8000,
});

pool.on('error', (err) => console.error('[user-service] PG pool error:', err.message));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL      PRIMARY KEY,
      first_name    TEXT        NOT NULL,
      last_name     TEXT        NOT NULL,
      email         TEXT        NOT NULL UNIQUE,
      password_hash TEXT        NOT NULL,
      role          TEXT        NOT NULL DEFAULT 'user'
                    CHECK(role IN ('admin','inspector','user')),
      is_active     BOOLEAN     NOT NULL DEFAULT FALSE,
      email_verified BOOLEAN    NOT NULL DEFAULT FALSE,
      phone         TEXT,
      department    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_otps (
      id         SERIAL      PRIMARY KEY,
      user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      otp        TEXT        NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      verified   BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_otp_user ON email_verification_otps(user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         SERIAL      PRIMARY KEY,
      user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT        NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Admin account is pre-verified and active — no OTP needed
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'kireziliva@gmail.com';
  const adminPass  = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456';
  const exists     = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [adminEmail]);
  if (!exists.rows.length) {
    const hash = await bcrypt.hash(adminPass, 10);
    await pool.query(
      `INSERT INTO users (first_name,last_name,email,password_hash,role,is_active,email_verified)
       VALUES ($1,$2,$3,$4,'admin',TRUE,TRUE)`,
      ['System', 'Admin', adminEmail, hash]
    );
    console.log(`[user-service] Admin account created: ${adminEmail}`);
  }

  console.log('[user-service] PostgreSQL ready (fems)');
}

// ── DB query timer — logs any query that takes longer than 20ms ───────────────
const _query = pool.query.bind(pool);
pool.query = function (text, params) {
  const start = Date.now();
  const sql   = (typeof text === 'string' ? text : text?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return _query(text, params).then(result => {
    const ms = Date.now() - start;
    if (ms > 20) console.log(`[user-svc DB ${ms}ms] ${sql}`);
    return result;
  });
};

module.exports = { pool, initDb };

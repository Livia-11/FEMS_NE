require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host:                    process.env.PG_HOST            || 'localhost',
  port:                    parseInt(process.env.PG_PORT   || '5432'),
  user:                    process.env.PG_USER            || 'postgres',
  password:                process.env.PG_PASSWORD        || 'postgre',
  database:                process.env.PG_EXTINGUISHER_DB || 'fems',
  max:                     10,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 5000,
  statement_timeout:       8000,
  query_timeout:           8000,
});

pool.on('error', (err) => console.error('[extinguisher-service] PG pool error:', err.message));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS extinguishers (
      id                SERIAL      PRIMARY KEY,
      serial_number     TEXT        NOT NULL UNIQUE,
      location          TEXT        NOT NULL,
      building          TEXT,
      floor             TEXT,
      type              TEXT        NOT NULL
                        CHECK(type IN ('Water','CO2','Foam','Dry Chemical','Wet Chemical','Clean Agent')),
      size              TEXT        NOT NULL
                        CHECK(size IN ('1.5 lb','2 lb','2.5 lb','5 lb','6 lb','9 lb','10 lb','12 lb','20 lb')),
      installation_date DATE        NOT NULL,
      expiry_date       DATE        NOT NULL,
      last_inspected    DATE,
      next_inspection   DATE,
      status            TEXT        NOT NULL DEFAULT 'active'
                        CHECK(status IN ('active','inactive','expired','maintenance','decommissioned')),
      notes             TEXT,
      created_by        INTEGER,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ext_serial   ON extinguishers(serial_number)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ext_status   ON extinguishers(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ext_expiry   ON extinguishers(expiry_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ext_location ON extinguishers(location)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inspections (
      id               SERIAL      PRIMARY KEY,
      extinguisher_id  INTEGER     NOT NULL REFERENCES extinguishers(id) ON DELETE CASCADE,
      inspector_id     INTEGER,
      inspector_name   TEXT,
      scheduled_date   DATE        NOT NULL,
      scheduled_time   TEXT,
      actual_date      DATE,
      status           TEXT        NOT NULL DEFAULT 'scheduled'
                       CHECK(status IN ('scheduled','in_progress','completed','cancelled','overdue')),
      result           TEXT        CHECK(result IN ('pass','fail','needs_maintenance')),
      pressure_ok      BOOLEAN,
      seal_intact      BOOLEAN,
      label_readable   BOOLEAN,
      pin_in_place     BOOLEAN,
      notes            TEXT,
      created_by       INTEGER,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_insp_ext_id ON inspections(extinguisher_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_insp_status ON inspections(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_insp_date   ON inspections(scheduled_date)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id                  SERIAL      PRIMARY KEY,
      extinguisher_id     INTEGER     NOT NULL REFERENCES extinguishers(id) ON DELETE CASCADE,
      inspector_id        INTEGER,
      inspector_name      TEXT,
      action_taken        TEXT        NOT NULL,
      date_of_maintenance DATE        NOT NULL,
      issues_identified   TEXT,
      parts_replaced      TEXT,
      cost                DECIMAL(10,2),
      next_service_date   DATE,
      notes               TEXT,
      created_by          INTEGER,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_maint_ext_id ON maintenance_logs(extinguisher_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_maint_date   ON maintenance_logs(date_of_maintenance)`);

  console.log('[extinguisher-service] PostgreSQL ready (fems)');
}

const _query = pool.query.bind(pool);
pool.query = function (text, params) {
  const start = Date.now();
  const sql   = (typeof text === 'string' ? text : text?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return _query(text, params).then(result => {
    const ms = Date.now() - start;
    if (ms > 20) console.log(`[ext-svc DB ${ms}ms] ${sql}`);
    return result;
  });
};

module.exports = { pool, initDb };

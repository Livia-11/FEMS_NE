# TZW LTD — FEMS Database Model

**System:** Fire Extinguisher Management System  
**Database:** PostgreSQL (single database: `fems`)  
**Architecture:** Microservices — each service owns its tables but shares the same database  

---

## Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER SERVICE                                        │
│                                                                             │
│  ┌─────────────────────┐    ┌──────────────────────────┐                   │
│  │       users          │    │  email_verification_otps │                   │
│  ├─────────────────────┤    ├──────────────────────────┤                   │
│  │ PK  id              │◄───│ PK  id                   │                   │
│  │     first_name      │    │ FK  user_id              │                   │
│  │     last_name       │    │     otp                  │                   │
│  │     email (UNIQUE)  │    │     expires_at           │                   │
│  │     password_hash   │    │     verified             │                   │
│  │     role            │    │     created_at           │                   │
│  │     is_active       │    └──────────────────────────┘                   │
│  │     email_verified  │                                                    │
│  │     phone           │    ┌──────────────────────────┐                   │
│  │     department      │    │  password_reset_tokens   │                   │
│  │     created_at      │◄───├──────────────────────────┤                   │
│  │     updated_at      │    │ PK  id                   │                   │
│  └──────────┬──────────┘    │ FK  user_id              │                   │
│             │               │     token (UNIQUE)       │                   │
└─────────────┼───────────────│     expires_at           │───────────────────┘
              │               │     used                 │
              │ (soft ref)    │     created_at           │
              │               └──────────────────────────┘
              │
              │  * Cross-service references are intentionally soft
              │    (no DB-level FK) to preserve microservice independence
              │
┌─────────────┼───────────────────────────────────────────────────────────────┐
│             │               EXTINGUISHER SERVICE                            │
│             │                                                               │
│  ┌──────────▼──────────────────────────────────┐                           │
│  │                 extinguishers                │                           │
│  ├─────────────────────────────────────────────┤                           │
│  │ PK  id                                      │                           │
│  │     serial_number          UNIQUE NOT NULL  │                           │
│  │     location               NOT NULL         │                           │
│  │     building                                │                           │
│  │     floor                                   │                           │
│  │     type    CHECK(Water|CO2|Foam|Dry        │                           │
│  │             Chemical|Wet Chemical|Clean     │                           │
│  │             Agent)         NOT NULL         │                           │
│  │     size    CHECK(1.5 lb|2 lb|2.5 lb|5 lb  │                           │
│  │             |6 lb|9 lb|10 lb|12 lb|20 lb)   │                           │
│  │             NOT NULL                        │                           │
│  │     installation_date      NOT NULL         │                           │
│  │     expiry_date            NOT NULL         │                           │
│  │     last_inspected                          │                           │
│  │     next_inspection                         │                           │
│  │     status  CHECK(active|inactive|expired   │                           │
│  │             |maintenance|decommissioned)    │                           │
│  │             DEFAULT 'active'                │                           │
│  │     notes                                   │                           │
│  │ soft created_by → users.id                  │                           │
│  │     created_at                              │                           │
│  │     updated_at                              │                           │
│  └──────┬──────────────────┬──────────────────┘                           │
│         │                  │                                               │
│         │ 1:N              │ 1:N                                           │
│         │                  │                                               │
│  ┌──────▼──────────┐  ┌───▼──────────────────────────┐                   │
│  │   inspections   │  │       maintenance_logs        │                   │
│  ├─────────────────┤  ├──────────────────────────────┤                   │
│  │ PK  id          │  │ PK  id                       │                   │
│  │ FK  extinguisher│  │ FK  extinguisher_id          │                   │
│  │     _id CASCADE │  │     → extinguishers.id       │                   │
│  │     → extinc.id │  │     CASCADE DELETE           │                   │
│  │ soft inspector  │  │ soft inspector_id            │                   │
│  │     _id →users  │  │     → users.id               │                   │
│  │     inspector   │  │     inspector_name           │                   │
│  │     _name       │  │     action_taken   NOT NULL  │                   │
│  │     scheduled   │  │     date_of_mainten.NOT NULL │                   │
│  │     _date       │  │     issues_identified        │                   │
│  │     scheduled   │  │     parts_replaced           │                   │
│  │     _time       │  │     cost  DECIMAL(10,2)      │                   │
│  │     actual_date │  │     next_service_date        │                   │
│  │     status      │  │     notes                    │                   │
│  │     CHECK(      │  │ soft created_by → users.id   │                   │
│  │      scheduled  │  │     created_at               │                   │
│  │      in_progress│  │     updated_at               │                   │
│  │      completed  │  └──────────────────────────────┘                   │
│  │      cancelled  │                                                       │
│  │      overdue)   │                                                       │
│  │     result      │                                                       │
│  │     CHECK(pass  │                                                       │
│  │      fail       │                                                       │
│  │      needs_maint│                                                       │
│  │      enance)    │                                                       │
│  │     pressure_ok │                                                       │
│  │     seal_intact │                                                       │
│  │     label_read  │                                                       │
│  │     _able       │                                                       │
│  │     pin_in_place│                                                       │
│  │     notes       │                                                       │
│  │ soft created_by │                                                       │
│  │     → users.id  │                                                       │
│  │     created_at  │                                                       │
│  │     updated_at  │                                                       │
│  └─────────────────┘                                                       │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATION SERVICE                               │
│                                                                            │
│  ┌────────────────────────────────────┐                                   │
│  │            notifications           │                                   │
│  ├────────────────────────────────────┤                                   │
│  │ PK  id                             │                                   │
│  │ soft recipient_id → users.id       │                                   │
│  │     type          NOT NULL         │                                   │
│  │     title         NOT NULL         │                                   │
│  │     message       NOT NULL         │                                   │
│  │     is_read       DEFAULT FALSE    │                                   │
│  │     email_sent    DEFAULT FALSE    │                                   │
│  │     metadata      JSONB            │                                   │
│  │     created_at                     │                                   │
│  │     read_at                        │                                   │
│  └────────────────────────────────────┘                                   │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Table Definitions

### 1. `users`
**Service:** User Service | **Purpose:** All system accounts (admins, inspectors, regular users)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Auto-increment identifier |
| `first_name` | TEXT | NOT NULL | User's first name |
| `last_name` | TEXT | NOT NULL | User's last name |
| `email` | TEXT | NOT NULL UNIQUE | Login email (stored lowercase) |
| `password_hash` | TEXT | NOT NULL | bcrypt hashed password (cost=10) |
| `role` | TEXT | NOT NULL, CHECK(`admin`\|`inspector`\|`user`), DEFAULT `user` | Access level |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT FALSE | Account enabled flag |
| `email_verified` | BOOLEAN | NOT NULL, DEFAULT FALSE | OTP verification completed |
| `phone` | TEXT | nullable | Optional phone number |
| `department` | TEXT | nullable | Optional department/team |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes:** `idx_users_email` on `LOWER(email)`, `idx_users_role` on `role`

**Notes:**
- Admin accounts are created with `is_active=TRUE, email_verified=TRUE` (no OTP needed)
- Regular users register via public API and must verify email via OTP before `is_active` becomes TRUE
- Passwords are never stored in plain text — only the bcrypt hash

---

### 2. `email_verification_otps`
**Service:** User Service | **Purpose:** Stores 6-digit OTP codes for email verification

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Auto-increment identifier |
| `user_id` | INTEGER | NOT NULL, FK → `users.id` CASCADE DELETE | Owning user |
| `otp` | TEXT | NOT NULL | 6-digit code (e.g. `483921`) |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Expiry time (default: +10 minutes) |
| `verified` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether this OTP was used |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When OTP was issued |

**Indexes:** `idx_otp_user` on `user_id`

---

### 3. `password_reset_tokens`
**Service:** User Service | **Purpose:** Secure tokens for password reset flow

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Auto-increment identifier |
| `user_id` | INTEGER | NOT NULL, FK → `users.id` CASCADE DELETE | Owning user |
| `token` | TEXT | NOT NULL UNIQUE | 64-char hex token (crypto.randomBytes) |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Expiry time (+1 hour from creation) |
| `used` | BOOLEAN | NOT NULL, DEFAULT FALSE | Prevents token reuse |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When token was issued |

---

### 4. `extinguishers`
**Service:** Extinguisher Service | **Purpose:** Master registry of all physical fire extinguishers

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Auto-increment identifier |
| `serial_number` | TEXT | NOT NULL UNIQUE | Physical serial number (e.g. `FE-UNIV-001`) |
| `location` | TEXT | NOT NULL | Description of placement (e.g. `Library — Main Hall`) |
| `building` | TEXT | nullable | Building name |
| `floor` | TEXT | nullable | Floor level (G, 1, 2, B1...) |
| `type` | TEXT | NOT NULL, CHECK | Extinguisher class: `Water`, `CO2`, `Foam`, `Dry Chemical`, `Wet Chemical`, `Clean Agent` |
| `size` | TEXT | NOT NULL, CHECK | Weight: `1.5 lb`, `2 lb`, `2.5 lb`, `5 lb`, `6 lb`, `9 lb`, `10 lb`, `12 lb`, `20 lb` |
| `installation_date` | DATE | NOT NULL | Date unit was physically installed |
| `expiry_date` | DATE | NOT NULL | Date unit becomes legally expired |
| `last_inspected` | DATE | nullable | Date of most recent completed inspection |
| `next_inspection` | DATE | nullable | Date of next scheduled inspection |
| `status` | TEXT | NOT NULL, DEFAULT `active`, CHECK | `active`, `inactive`, `expired`, `maintenance`, `decommissioned` |
| `notes` | TEXT | nullable | Free-text notes |
| `created_by` | INTEGER | nullable (soft → `users.id`) | Admin/Inspector who registered it |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp |

**Indexes:** `idx_ext_serial`, `idx_ext_status`, `idx_ext_expiry`, `idx_ext_location`

---

### 5. `inspections`
**Service:** Extinguisher Service | **Purpose:** Inspection schedule and results for each extinguisher

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Auto-increment identifier |
| `extinguisher_id` | INTEGER | NOT NULL, FK → `extinguishers.id` CASCADE DELETE | Which unit |
| `inspector_id` | INTEGER | nullable (soft → `users.id`) | Assigned inspector (by ID) |
| `inspector_name` | TEXT | nullable | Inspector name (denormalized for display) |
| `scheduled_date` | DATE | NOT NULL | Planned inspection date |
| `scheduled_time` | TEXT | nullable | Planned time (HH:MM format) |
| `actual_date` | DATE | nullable | Date inspection was actually performed |
| `status` | TEXT | NOT NULL, DEFAULT `scheduled`, CHECK | `scheduled`, `in_progress`, `completed`, `cancelled`, `overdue` |
| `result` | TEXT | nullable, CHECK | `pass`, `fail`, `needs_maintenance` |
| `pressure_ok` | BOOLEAN | nullable | Checklist: pressure gauge reading OK |
| `seal_intact` | BOOLEAN | nullable | Checklist: tamper seal unbroken |
| `label_readable` | BOOLEAN | nullable | Checklist: instruction label legible |
| `pin_in_place` | BOOLEAN | nullable | Checklist: safety pin present |
| `notes` | TEXT | nullable | Inspector's notes and observations |
| `created_by` | INTEGER | nullable (soft → `users.id`) | Who scheduled the inspection |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp |

**Indexes:** `idx_insp_ext_id`, `idx_insp_status`, `idx_insp_date`

**Cascade behaviour:** Deleting an extinguisher automatically deletes all its inspection records.

---

### 6. `maintenance_logs`
**Service:** Extinguisher Service | **Purpose:** Full service history for each extinguisher

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Auto-increment identifier |
| `extinguisher_id` | INTEGER | NOT NULL, FK → `extinguishers.id` CASCADE DELETE | Which unit was serviced |
| `inspector_id` | INTEGER | nullable (soft → `users.id`) | Technician who performed the work (by ID) |
| `inspector_name` | TEXT | nullable | Technician name (denormalized) |
| `action_taken` | TEXT | NOT NULL | Description of work performed |
| `date_of_maintenance` | DATE | NOT NULL | Date service was performed |
| `issues_identified` | TEXT | nullable | Problems found during service |
| `parts_replaced` | TEXT | nullable | List of replaced components |
| `cost` | DECIMAL(10,2) | nullable | Service cost in local currency |
| `next_service_date` | DATE | nullable | Recommended date for next service |
| `notes` | TEXT | nullable | Additional technician notes |
| `created_by` | INTEGER | nullable (soft → `users.id`) | Who logged this record |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp |

**Indexes:** `idx_maint_ext_id`, `idx_maint_date`

**Cascade behaviour:** Deleting an extinguisher automatically deletes all its maintenance records.

---

### 7. `notifications`
**Service:** Notification Service | **Purpose:** In-app alerts and messages for system users

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | SERIAL | PRIMARY KEY | Auto-increment identifier |
| `recipient_id` | INTEGER | nullable (soft → `users.id`) | Target user (NULL = broadcast to all) |
| `type` | TEXT | NOT NULL | Category: `general`, `info`, `warning`, `success`, `error`, `inspection_scheduled` |
| `title` | TEXT | NOT NULL | Short notification heading |
| `message` | TEXT | NOT NULL | Full notification body text |
| `is_read` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether user has read it |
| `email_sent` | BOOLEAN | NOT NULL, DEFAULT FALSE | Whether an email copy was sent |
| `metadata` | JSONB | nullable | Structured extra data (e.g. `{"inspection_id": 5}`) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When notification was created |
| `read_at` | TIMESTAMPTZ | nullable | When user marked it read |

**Indexes:** `idx_notif_recipient`, `idx_notif_type`, `idx_notif_read`

---

## Relationships Summary

```
users ──────────────────────────────────────────────────────────
  │  1:N  email_verification_otps  (user_id FK, CASCADE DELETE)
  │  1:N  password_reset_tokens    (user_id FK, CASCADE DELETE)
  │  1:N  extinguishers.created_by (soft ref — no DB constraint)
  │  1:N  inspections.inspector_id (soft ref — no DB constraint)
  │  1:N  inspections.created_by   (soft ref — no DB constraint)
  │  1:N  maintenance_logs.inspector_id (soft ref)
  │  1:N  maintenance_logs.created_by   (soft ref)
  └──1:N  notifications.recipient_id    (soft ref)

extinguishers ──────────────────────────────────────────────────
  │  1:N  inspections     (extinguisher_id FK, CASCADE DELETE)
  └──1:N  maintenance_logs (extinguisher_id FK, CASCADE DELETE)
```

**Why soft references across services?**  
`extinguishers.created_by`, `inspections.inspector_id`, and `maintenance_logs.inspector_id` reference `users.id`, but since the User Service and Extinguisher Service run as independent microservices (potentially on separate servers), a hard database-level FK constraint would create a tight coupling between services. Soft references (stored integer IDs with no DB constraint) preserve service independence while still allowing the application layer to join the data when needed.

---

## Complete SQL DDL

```sql
-- ============================================================
--  TZW LTD FEMS — Complete Database Schema
--  Database: fems (PostgreSQL)
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- USER SERVICE TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL       PRIMARY KEY,
    first_name      TEXT         NOT NULL,
    last_name       TEXT         NOT NULL,
    email           TEXT         NOT NULL UNIQUE,
    password_hash   TEXT         NOT NULL,
    role            TEXT         NOT NULL DEFAULT 'user'
                    CHECK(role IN ('admin', 'inspector', 'user')),
    is_active       BOOLEAN      NOT NULL DEFAULT FALSE,
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    phone           TEXT,
    department      TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE        INDEX IF NOT EXISTS idx_users_role  ON users(role);


CREATE TABLE IF NOT EXISTS email_verification_otps (
    id          SERIAL       PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp         TEXT         NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    verified    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_user ON email_verification_otps(user_id);


CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          SERIAL       PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT         NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────
-- EXTINGUISHER SERVICE TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS extinguishers (
    id                SERIAL       PRIMARY KEY,
    serial_number     TEXT         NOT NULL UNIQUE,
    location          TEXT         NOT NULL,
    building          TEXT,
    floor             TEXT,
    type              TEXT         NOT NULL
                      CHECK(type IN (
                          'Water', 'CO2', 'Foam',
                          'Dry Chemical', 'Wet Chemical', 'Clean Agent'
                      )),
    size              TEXT         NOT NULL
                      CHECK(size IN (
                          '1.5 lb', '2 lb', '2.5 lb', '5 lb', '6 lb',
                          '9 lb', '10 lb', '12 lb', '20 lb'
                      )),
    installation_date DATE         NOT NULL,
    expiry_date       DATE         NOT NULL,
    last_inspected    DATE,
    next_inspection   DATE,
    status            TEXT         NOT NULL DEFAULT 'active'
                      CHECK(status IN (
                          'active', 'inactive', 'expired',
                          'maintenance', 'decommissioned'
                      )),
    notes             TEXT,
    created_by        INTEGER,                         -- soft ref → users.id
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ext_serial   ON extinguishers(serial_number);
CREATE INDEX IF NOT EXISTS idx_ext_status   ON extinguishers(status);
CREATE INDEX IF NOT EXISTS idx_ext_expiry   ON extinguishers(expiry_date);
CREATE INDEX IF NOT EXISTS idx_ext_location ON extinguishers(location);


CREATE TABLE IF NOT EXISTS inspections (
    id               SERIAL       PRIMARY KEY,
    extinguisher_id  INTEGER      NOT NULL
                     REFERENCES extinguishers(id) ON DELETE CASCADE,
    inspector_id     INTEGER,                          -- soft ref → users.id
    inspector_name   TEXT,
    scheduled_date   DATE         NOT NULL,
    scheduled_time   TEXT,                             -- HH:MM format
    actual_date      DATE,
    status           TEXT         NOT NULL DEFAULT 'scheduled'
                     CHECK(status IN (
                         'scheduled', 'in_progress', 'completed',
                         'cancelled', 'overdue'
                     )),
    result           TEXT
                     CHECK(result IN ('pass', 'fail', 'needs_maintenance')),
    pressure_ok      BOOLEAN,
    seal_intact      BOOLEAN,
    label_readable   BOOLEAN,
    pin_in_place     BOOLEAN,
    notes            TEXT,
    created_by       INTEGER,                          -- soft ref → users.id
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insp_ext_id ON inspections(extinguisher_id);
CREATE INDEX IF NOT EXISTS idx_insp_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_insp_date   ON inspections(scheduled_date);


CREATE TABLE IF NOT EXISTS maintenance_logs (
    id                   SERIAL        PRIMARY KEY,
    extinguisher_id      INTEGER       NOT NULL
                         REFERENCES extinguishers(id) ON DELETE CASCADE,
    inspector_id         INTEGER,                       -- soft ref → users.id
    inspector_name       TEXT,
    action_taken         TEXT          NOT NULL,
    date_of_maintenance  DATE          NOT NULL,
    issues_identified    TEXT,
    parts_replaced       TEXT,
    cost                 DECIMAL(10,2),
    next_service_date    DATE,
    notes                TEXT,
    created_by           INTEGER,                       -- soft ref → users.id
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maint_ext_id ON maintenance_logs(extinguisher_id);
CREATE INDEX IF NOT EXISTS idx_maint_date   ON maintenance_logs(date_of_maintenance);


-- ─────────────────────────────────────────────────────────────
-- NOTIFICATION SERVICE TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id            SERIAL       PRIMARY KEY,
    recipient_id  INTEGER,                              -- soft ref → users.id (NULL = broadcast)
    type          TEXT         NOT NULL,
    title         TEXT         NOT NULL,
    message       TEXT         NOT NULL,
    is_read       BOOLEAN      NOT NULL DEFAULT FALSE,
    email_sent    BOOLEAN      NOT NULL DEFAULT FALSE,
    metadata      JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    read_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_type      ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notif_read      ON notifications(is_read);
```

---

## Data Volume (Demo Seed)

| Table | Records |
|---|---|
| `users` | 10 (1 admin, 2 inspectors, 7 users) |
| `email_verification_otps` | varies (cleaned after use) |
| `password_reset_tokens` | varies (cleaned after use) |
| `extinguishers` | 13 (12 active, 1 expired) |
| `inspections` | 13 (6 scheduled, 6 completed, 1 overdue) |
| `maintenance_logs` | 5 |
| `notifications` | 13+ (auto-created when inspections scheduled) |

---

## Design Decisions

| Decision | Reasoning |
|---|---|
| **Single database (`fems`)** | Simplifies deployment for a single-company system. In a multi-tenant or very large scale system, each service would have its own database. |
| **Soft cross-service references** | `created_by`, `inspector_id`, `recipient_id` store integer IDs without FK constraints. This allows services to be deployed independently without schema coupling. |
| **Denormalized `inspector_name`** | Stored alongside `inspector_id` so display names survive even if the user record is later modified. |
| **CASCADE DELETE on extinguisher FKs** | Deleting an extinguisher removes all its inspection and maintenance history. This is intentional — a decommissioned unit's history should be removed together. |
| **TIMESTAMPTZ (timezone-aware)** | All timestamps include timezone so the system works correctly across regions. |
| **CHECK constraints on enums** | `type`, `size`, `status`, `role`, `result` all use CHECK constraints instead of separate lookup tables — simpler for a small system, validated at DB level. |
| **bcrypt cost=10** | Standard work factor: ~100ms on modern hardware, resistant to brute-force. |
| **OTP in response (dev mode)** | When `NODE_ENV != production`, the OTP and reset token are returned in the API response for easy testing without configuring SMTP. |

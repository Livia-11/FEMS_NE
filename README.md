# TZW LTD — Fire Extinguisher Management System (FEMS)

RESTful Microservices Architecture · Node.js · Postgres · JWT · Swagger/OpenAPI

---

## Architecture

```
Client / Postman / Browser
          |
    [API Gateway :3000]  ← Single entry point, Swagger UI, health dashboard
          |
    ┌─────┴──────────────────────────────────────────┐
    │                                                │
[User Service :3001]            [Extinguisher Service :3002]
  - Register / Login               - Extinguisher CRUD
  - JWT Auth (BCrypt)              - Inspection Scheduling
  - Role-based access              - Maintenance Logging
  - Profile management
    │                                                │
    └─────────────────┬──────────────────────────────┘
                      │
           [Reporting Service :3003]
             - Inventory reports (daily/monthly/yearly)
             - Inspection reports (pending/completed/overdue)
             - Compliance reports (expired/upcoming)
             - Maintenance reports
             - PDF & CSV export
                      │
           [Notification Service :3004]
             - In-app notifications
             - Email (optional, configure SMTP)
             - Service-to-service internal notifications
```

**No Docker required** — each microservice is a standalone Node.js process.
Process management: `concurrently` (dev) or `pm2` (production).

---

## Quick Start

### Prerequisites
- Node.js >= 18
- npm >= 9

### 1. Install all dependencies
```bash
npm run install:all
```

### 2. Configure environment
The `.env` file is pre-configured for local development. Edit if needed.

### 3. Start all services
```bash
npm start          # production-style (node)
# or
npm run dev        # development mode (nodemon — auto-restart)
```

### 4. Seed sample data (optional)
```bash
# In a separate terminal, after services start:
node seed.js
```

---

## Service Ports & URLs

| Service               | Port | Swagger UI                         |
|-----------------------|------|------------------------------------|
| API Gateway           | 3000 | http://localhost:3000/api-docs     |
| User Service          | 3001 | http://localhost:3001/api-docs     |
| Extinguisher Service  | 3002 | http://localhost:3002/api-docs     |
| Reporting Service     | 3003 | http://localhost:3003/api-docs     |
| Notification Service  | 3004 | http://localhost:3004/api-docs     |

**Health dashboard:** http://localhost:3000/health

---

## Default Admin Credentials

```
Email:    kireziliva@gmail.com
Password: Admin@123
```

---

## User Roles

| Role       | Permissions |
|------------|-------------|
| `admin`    | Full access — manage users, extinguishers, view all reports |
| `inspector`| Register/update extinguishers, schedule & complete inspections, log maintenance |
| `user`     | View extinguisher status, view inspection history, view reports |

---

## API Overview

### Authentication (`/api/auth/`)
| Method | Endpoint                  | Description                  |
|--------|---------------------------|------------------------------|
| POST   | /api/auth/register        | Register new user            |
| POST   | /api/auth/login           | Login → JWT token            |
| GET    | /api/auth/me              | Current user profile         |
| POST   | /api/auth/forgot-password | Request password reset token |
| POST   | /api/auth/reset-password  | Reset password with token    |
| PUT    | /api/auth/change-password | Change password (auth req'd) |

### Users (`/api/users/`) — Admin only
| Method | Endpoint                | Description              |
|--------|-------------------------|--------------------------|
| GET    | /api/users              | List all users           |
| POST   | /api/users              | Create user with role    |
| GET    | /api/users/:id          | Get user details         |
| PUT    | /api/users/:id          | Update user              |
| DELETE | /api/users/:id          | Delete user              |
| PATCH  | /api/users/:id/activate | Activate user            |
| PATCH  | /api/users/:id/deactivate | Deactivate user        |

### Extinguishers (`/api/extinguishers/`)
| Method | Endpoint                          | Roles              |
|--------|-----------------------------------|--------------------|
| GET    | /api/extinguishers                | All authenticated  |
| POST   | /api/extinguishers                | Admin, Inspector   |
| GET    | /api/extinguishers/:id            | All authenticated  |
| PUT    | /api/extinguishers/:id            | Admin, Inspector   |
| DELETE | /api/extinguishers/:id            | Admin              |
| GET    | /api/extinguishers/stats/summary  | All authenticated  |

### Inspections (`/api/inspections/`)
| Method | Endpoint                     | Description               |
|--------|------------------------------|---------------------------|
| GET    | /api/inspections             | List inspections          |
| POST   | /api/inspections             | Schedule inspection       |
| GET    | /api/inspections/:id         | Get details               |
| PUT    | /api/inspections/:id         | Update / record results   |
| DELETE | /api/inspections/:id         | Cancel (admin)            |
| POST   | /api/inspections/overdue/mark | Auto-mark overdue (admin)|

### Maintenance (`/api/maintenance/`)
| Method | Endpoint               | Description           |
|--------|------------------------|-----------------------|
| GET    | /api/maintenance       | List maintenance logs |
| POST   | /api/maintenance       | Log activity          |
| GET    | /api/maintenance/:id   | Get details           |
| PUT    | /api/maintenance/:id   | Update log            |
| DELETE | /api/maintenance/:id   | Delete (admin)        |

### Reports (`/api/reports/`)
| Method | Endpoint                     | Description                 |
|--------|------------------------------|-----------------------------|
| GET    | /api/reports/dashboard       | All-in-one dashboard        |
| GET    | /api/reports/inventory       | Inventory summary           |
| GET    | /api/reports/inventory/daily | Daily summary               |
| GET    | /api/reports/inventory/monthly | Monthly summary           |
| GET    | /api/reports/inventory/yearly | Yearly summary             |
| GET    | /api/reports/inspections     | Inspection overview         |
| GET    | /api/reports/compliance      | Compliance status           |
| GET    | /api/reports/maintenance     | Maintenance history         |
| GET    | /api/reports/export/pdf?type=inventory | PDF download    |
| GET    | /api/reports/export/csv?type=extinguishers | CSV download |

### Notifications (`/api/notifications/`)
| Method | Endpoint                          | Description            |
|--------|-----------------------------------|------------------------|
| GET    | /api/notifications                | My notifications       |
| GET    | /api/notifications/unread-count   | Unread badge count     |
| PATCH  | /api/notifications/:id/read       | Mark read              |
| PATCH  | /api/notifications/read-all       | Mark all read          |
| POST   | /api/notifications/send           | Send notification (admin) |
| DELETE | /api/notifications/:id            | Delete notification    |

---

## Production Deployment with PM2

```bash
npm install -g pm2
npm run pm2:start     # start all services
npm run pm2:logs      # tail logs
npm run pm2:stop      # stop all services
```

---

## Email Notifications (Optional)

Edit `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
FROM_EMAIL=noreply@tzwltd.com
```
For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833).

---

## Database

Each service maintains its own **SQLite** database file (`*/data/*.db`).
No database server required. Files are auto-created on first run.

| Service              | Database file                             |
|----------------------|-------------------------------------------|
| User Service         | `user-service/data/users.db`              |
| Extinguisher Service | `extinguisher-service/data/extinguishers.db` |
| Notification Service | `notification-service/data/notifications.db` |

Export with: `sqlite3 user-service/data/users.db .dump > backup_users.sql`

---

## Technologies

- **Runtime**: Node.js 18+
- **Framework**: Express 4
- **Database**: SQLite via `better-sqlite3` (no server needed)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Validation**: express-validator
- **API Docs**: swagger-jsdoc + swagger-ui-express (OpenAPI 3.0)
- **PDF Export**: pdfkit
- **CSV Export**: csv-stringify
- **Email**: nodemailer
- **Security**: helmet, cors, express-rate-limit
- **Process Mgmt**: concurrently (dev) / pm2 (prod)

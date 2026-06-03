# FEMS — Complete Testing & Verification Guide

TZW LTD Fire Extinguisher Management System

---

## STEP 0 — Start the System

### 0.1 Kill any running instances
```
npx kill-port 3000 3001 3002 3003 3004
```

### 0.2 Start all 5 services
```
cd C:\Users\kirez\OneDrive\Documents\fems
npm start
```

Wait for all 5 "Running on..." messages before testing.

### 0.3 (Optional) Seed sample data
In a second terminal:
```
node seed.js
```

### Service URLs
| Service            | URL                              |
|--------------------|----------------------------------|
| API Gateway        | http://localhost:3000             |
| Swagger (all APIs) | http://localhost:3000/api-docs    |
| Health dashboard   | http://localhost:3000/health      |

---

## STEP 1 — System Health Check

**Requirement:** All services must be running and connected to PostgreSQL.

**Test:**
```
GET http://localhost:3000/health
```

**Expected response:**
```json
{
  "gateway": "up",
  "services": [
    { "name": "users",         "status": "up" },
    { "name": "extinguishers", "status": "up" },
    { "name": "reports",       "status": "up" },
    { "name": "notifications", "status": "up" }
  ]
}
```

**Verify:** All four services show `"status": "up"`.

---

## STEP 2 — Admin Login

**Requirement:** Admin can log in and receives a JWT token.

**Test:**
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "kireziliva@gmail.com",
  "password": "Admin@123456"
}
```

**Expected response:**
```json
{
  "message": "Login successful",
  "token": "<JWT>",
  "user": { "role": "admin", "is_active": true, "email_verified": true }
}
```

**Save the token** — you'll need it for every admin action below.

---

## STEP 3 — Admin Invites an Inspector

**Requirement:** Admin invites inspectors. Inspectors cannot self-register.  
The system generates a temporary password and emails the username/password to the inspector.

**Test:**
```
POST http://localhost:3000/api/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "first_name": "Alice",
  "last_name":  "Inspector",
  "email":      "alice.inspector@tzwltd.com",
  "role":       "inspector",
  "department": "Fire Safety"
}
```

**Expected response:**
```json
{
  "message": "Inspector invitation sent successfully.",
  "user": { "role": "inspector", "is_active": true, "email_verified": true }
}
```

**Verify:**
- `is_active: true` and `email_verified: true`
- Inspector receives an email containing username and temporary password
- Inspector can log in with the temporary password and later change it from Profile

---

## STEP 4 — Inspector Login

**Test:**
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email":    "alice.inspector@tzwltd.com",
  "password": "<temporary_password_from_email>"
}
```

**Expected:** `"role": "inspector"`, token issued. **Save inspector token.**

---

## STEP 5 — User Self-Registration with OTP

**Requirement:** Regular users self-register. Account is inactive until OTP is verified.

### 5.1 Register
```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "first_name": "John",
  "last_name":  "Facilities",
  "email":      "john.facilities@company.com",
  "password":   "User@1234"
}
```

**Expected response:**
```json
{
  "message": "Registration successful. A 6-digit OTP has been sent...",
  "user_id": 5,
  "email_sent": true
}
```

> **Note:** OTP codes are no longer returned by the API or printed to the console.  
> Configure SMTP in `.env`, then read the OTP from the user's real email inbox.

**Verify:** User cannot log in yet (account inactive until OTP verified).

### 5.2 Try login before verification
```
POST http://localhost:3000/api/auth/login
{ "email": "john.facilities@company.com", "password": "User@1234" }
```

**Expected:** `403 — Email not verified. Please check your inbox for the OTP.`

### 5.3 Verify OTP
```
POST http://localhost:3000/api/auth/verify-email
Content-Type: application/json

{
  "email": "john.facilities@company.com",
  "otp":   "382741"
}
```

**Expected response:**
```json
{
  "message": "Email verified successfully. Account activated.",
  "token": "<JWT>",
  "user": { "is_active": true, "email_verified": true, "role": "user" }
}
```

### 5.4 Resend OTP (if expired)
```
POST http://localhost:3000/api/auth/resend-otp
{ "email": "john.facilities@company.com" }
```

**Expected:** New OTP issued, old one invalidated.

---

## STEP 6 — Admin Manages Users

**Requirement:** Admin can view, update, deactivate, and delete users.

### 6.1 List all users
```
GET http://localhost:3000/api/users
Authorization: Bearer <admin_token>
```

Query parameters to test:
- `?role=inspector` — filter by role
- `?search=alice` — search by name/email
- `?is_active=false` — show inactive accounts
- `?page=1&limit=10` — pagination

### 6.2 Deactivate a user
```
PATCH http://localhost:3000/api/users/{id}/deactivate
Authorization: Bearer <admin_token>
```

**Verify:** User cannot log in after deactivation (`403 — Account deactivated`).

### 6.3 Activate a user
```
PATCH http://localhost:3000/api/users/{id}/activate
Authorization: Bearer <admin_token>
```

### 6.4 Update user (admin changes role)
```
PUT http://localhost:3000/api/users/{id}
Authorization: Bearer <admin_token>
Content-Type: application/json

{ "role": "inspector", "department": "Maintenance" }
```

### 6.5 Delete a user
```
DELETE http://localhost:3000/api/users/{id}
Authorization: Bearer <admin_token>
```

**Verify:** Cannot delete own account (returns `403`).

---

## STEP 7 — Fire Extinguisher Management

**Requirement:** Admin/Inspector can register, view, update, and delete extinguishers.

### 7.1 Register a new extinguisher
```
POST http://localhost:3000/api/extinguishers
Authorization: Bearer <admin_or_inspector_token>
Content-Type: application/json

{
  "serial_number":     "FE-2024-001",
  "location":          "Building A - Main Lobby",
  "building":          "Building A",
  "floor":             "Ground Floor",
  "type":              "CO2",
  "size":              "5 lb",
  "installation_date": "2024-01-15",
  "expiry_date":       "2025-01-15",
  "status":            "active"
}
```

Valid types: `Water`, `CO2`, `Foam`, `Dry Chemical`, `Wet Chemical`, `Clean Agent`  
Valid sizes: `1.5 lb`, `2 lb`, `2.5 lb`, `5 lb`, `6 lb`, `9 lb`, `10 lb`, `12 lb`, `20 lb`  
Valid statuses: `active`, `inactive`, `expired`, `maintenance`, `decommissioned`

### 7.2 List all extinguishers
```
GET http://localhost:3000/api/extinguishers
Authorization: Bearer <token>
```

Filters to test:
- `?status=expired`
- `?type=CO2`
- `?location=lobby`
- `?expiring_days=30` — expiring within 30 days
- `?search=FE-2024`

### 7.3 Get extinguisher by ID
```
GET http://localhost:3000/api/extinguishers/1
Authorization: Bearer <token>
```

**Verify:** Response includes `recent_inspections` and `recent_maintenance` arrays.

### 7.4 Update extinguisher
```
PUT http://localhost:3000/api/extinguishers/1
Authorization: Bearer <admin_or_inspector_token>
Content-Type: application/json

{ "status": "maintenance", "notes": "Pressure issue detected" }
```

### 7.5 Inventory statistics
```
GET http://localhost:3000/api/extinguishers/stats/summary
Authorization: Bearer <token>
```

**Expected:**
```json
{
  "total": 8,
  "by_status": [...],
  "by_type": [...],
  "expired": 2,
  "expiring_in_30_days": 1,
  "expiring_in_90_days": 3
}
```

### 7.6 Delete extinguisher (admin only)
```
DELETE http://localhost:3000/api/extinguishers/1
Authorization: Bearer <admin_token>
```

---

## STEP 8 — Inspection Scheduling

**Requirement:** Schedule inspections, assign inspector, record results.

### 8.1 Schedule an inspection
```
POST http://localhost:3000/api/inspections
Authorization: Bearer <token>
Content-Type: application/json

{
  "extinguisher_id": 1,
  "inspector_id":    2,
  "inspector_name":  "Alice Inspector",
  "scheduled_date":  "2024-08-15",
  "scheduled_time":  "09:00",
  "notes":           "Annual inspection"
}
```

**Verify:** `extinguisher.next_inspection` is updated automatically.

### 8.2 List inspections with filters
```
GET http://localhost:3000/api/inspections?status=scheduled
GET http://localhost:3000/api/inspections?from_date=2024-08-01&to_date=2024-08-31
GET http://localhost:3000/api/inspections?extinguisher_id=1
```

**Verify (Role-based):**  
- Inspector only sees their own inspections
- Admin/User see all

### 8.3 Record inspection result (inspector)
```
PUT http://localhost:3000/api/inspections/1
Authorization: Bearer <inspector_token>
Content-Type: application/json

{
  "status":         "completed",
  "actual_date":    "2024-08-15",
  "result":         "pass",
  "pressure_ok":    true,
  "seal_intact":    true,
  "label_readable": true,
  "pin_in_place":   true,
  "notes":          "All checks passed. Good condition."
}
```

**Verify:** `extinguisher.last_inspected` is updated.

### 8.4 Mark overdue inspections
```
POST http://localhost:3000/api/inspections/overdue/mark
Authorization: Bearer <admin_token>
```

---

## STEP 9 — Maintenance Logging

**Requirement:** Inspectors log maintenance activities with cost and parts.

### 9.1 Log maintenance
```
POST http://localhost:3000/api/maintenance
Authorization: Bearer <inspector_token>
Content-Type: application/json

{
  "extinguisher_id":     1,
  "action_taken":        "Full service — recharged and replaced safety pin",
  "date_of_maintenance": "2024-08-10",
  "issues_identified":   "Low pressure, corroded safety pin",
  "parts_replaced":      "Safety pin, pressure gauge",
  "cost":                75.50,
  "next_service_date":   "2025-08-10",
  "notes":               "Extinguisher in good condition after service"
}
```

### 9.2 View maintenance history
```
GET http://localhost:3000/api/maintenance?extinguisher_id=1
GET http://localhost:3000/api/maintenance?from_date=2024-01-01&to_date=2024-12-31
```

---

## STEP 10 — Reports

**Requirement:** Real-time reports for inventory, inspections, compliance, and maintenance.

### 10.1 Dashboard (all metrics in one call)
```
GET http://localhost:3000/api/reports/dashboard
Authorization: Bearer <token>
```

### 10.2 Inventory reports
```
GET http://localhost:3000/api/reports/inventory
GET http://localhost:3000/api/reports/inventory/daily?date=2024-08-15
GET http://localhost:3000/api/reports/inventory/monthly?year=2024&month=8
GET http://localhost:3000/api/reports/inventory/yearly?year=2024
```

### 10.3 Inspection reports
```
GET http://localhost:3000/api/reports/inspections
GET http://localhost:3000/api/reports/inspections?from_date=2024-01-01&to_date=2024-12-31
```

**Verify:** Response includes separate `scheduled`, `completed`, and `overdue` sections with counts.

### 10.4 Compliance report
```
GET http://localhost:3000/api/reports/compliance
```

**Verify:** Shows `compliance_rate`, `expired`, `expiring_in_30_days`, `expiring_in_90_days`.

### 10.5 Maintenance report
```
GET http://localhost:3000/api/reports/maintenance?from_date=2024-01-01
```

**Verify:** Shows `total_activities`, `total_cost`, `most_maintained` extinguishers.

---

## STEP 11 — Export Reports

**Requirement:** Export reports in PDF and CSV formats.

### 11.1 PDF export
```
GET http://localhost:3000/api/reports/export/pdf?type=inventory
GET http://localhost:3000/api/reports/export/pdf?type=compliance
GET http://localhost:3000/api/reports/export/pdf?type=inspections
GET http://localhost:3000/api/reports/export/pdf?type=maintenance
Authorization: Bearer <token>
```

**Verify:** Response is a `application/pdf` file download.

### 11.2 CSV export
```
GET http://localhost:3000/api/reports/export/csv?type=extinguishers
GET http://localhost:3000/api/reports/export/csv?type=inspections
GET http://localhost:3000/api/reports/export/csv?type=maintenance
Authorization: Bearer <token>
```

**Verify:** Response is a `text/csv` file download with headers.

---

## STEP 12 — Notifications

**Requirement:** In-app notifications; email optional.

### 12.1 Check unread count
```
GET http://localhost:3000/api/notifications/unread-count
Authorization: Bearer <token>
```

### 12.2 Get my notifications
```
GET http://localhost:3000/api/notifications
GET http://localhost:3000/api/notifications?unread_only=true
Authorization: Bearer <token>
```

### 12.3 Admin sends a notification
```
POST http://localhost:3000/api/notifications/send
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "recipient_id": 3,
  "type":         "reminder",
  "title":        "Inspection Due Tomorrow",
  "message":      "Reminder: FE-2024-001 inspection is scheduled for tomorrow at 09:00."
}
```

### 12.4 Mark notification as read
```
PATCH http://localhost:3000/api/notifications/1/read
Authorization: Bearer <token>
```

### 12.5 Mark all as read
```
PATCH http://localhost:3000/api/notifications/read-all
Authorization: Bearer <token>
```

---

## STEP 13 — Role Access Control Verification

**Requirement:** Each role can only access what they are permitted to.

| Action                          | Admin | Inspector | User |
|---------------------------------|-------|-----------|------|
| Login                           | ✓     | ✓         | ✓    |
| Self-register                   | ✗     | ✗         | ✓    |
| Create inspector/admin accounts | ✓     | ✗         | ✗    |
| List all users                  | ✓     | ✗         | ✗    |
| Register extinguisher           | ✓     | ✓         | ✗    |
| Update extinguisher             | ✓     | ✓         | ✗    |
| Delete extinguisher             | ✓     | ✗         | ✗    |
| Schedule inspection             | ✓     | ✓         | ✓    |
| Record inspection result        | ✓     | ✓         | ✗    |
| Log maintenance                 | ✓     | ✓         | ✗    |
| View reports                    | ✓     | ✓         | ✓    |
| Export PDF/CSV                  | ✓     | ✓         | ✓    |
| Send notifications              | ✓     | ✗         | ✗    |

**Test denied actions return `403 Forbidden`.**

---

## STEP 14 — Swagger API Documentation

Open each service's Swagger UI to verify all endpoints are documented:

| Service              | Swagger URL                        |
|----------------------|------------------------------------|
| All APIs (gateway)   | http://localhost:3000/api-docs     |
| User Service         | http://localhost:3001/api-docs     |
| Extinguisher Service | http://localhost:3002/api-docs     |
| Reporting Service    | http://localhost:3003/api-docs     |
| Notification Service | http://localhost:3004/api-docs     |

**Verify:** Use "Authorize" button in Swagger UI, paste your JWT token, and test endpoints directly.

---

## STEP 15 — Email Configuration (Optional)

To enable actual email delivery of OTPs:

1. Edit `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=kireziliva@gmail.com
SMTP_PASS=<your_gmail_app_password>
FROM_EMAIL=kireziliva@gmail.com
```

2. Generate Gmail App Password:  
   Google Account → Security → 2-Step Verification → App Passwords

3. Restart services:
```
npx kill-port 3000 3001 3002 3003 3004
npm start
```

4. Set `NODE_ENV=production` in `.env` to hide OTP from API responses (email only).

---

## Recommended Testing Tool

Use **Postman** or the built-in **Swagger UI** at http://localhost:3000/api-docs.

**Postman workflow:**
1. Create a collection named `FEMS`
2. Add an environment variable `base_url = http://localhost:3000`
3. Add `token` variable — set it from the login response
4. Use `{{base_url}}` and `Bearer {{token}}` in all requests

---

## Database Inspection

Connect to PostgreSQL to verify data directly:
```sql
-- Check users
SELECT id, first_name, email, role, is_active, email_verified FROM fems_users.public.users;

-- Check extinguishers
SELECT id, serial_number, location, type, status, expiry_date FROM fems_extinguishers.public.extinguishers;

-- Check OTPs
SELECT u.email, o.otp, o.expires_at, o.verified
FROM fems_users.public.email_verification_otps o
JOIN fems_users.public.users u ON u.id = o.user_id;
```

---

## Requirements Checklist

### Activity 2 — User Management
- [x] Admin role — manages users, creates inspectors
- [x] Inspector role — created by admin only
- [x] User role — self-registers with OTP verification
- [x] Registration API with validation
- [x] Duplicate email prevention
- [x] Passwords hashed with bcrypt (cost factor 12)
- [x] JWT authentication
- [x] Role-based access control
- [x] Profile view/update
- [x] Change password
- [x] Forgot/reset password
- [x] OTP email verification on self-registration

### Activity 3 — Extinguisher Management
- [x] Register extinguisher (serial, location, type, size, dates, status)
- [x] List all extinguishers with filters
- [x] View extinguisher details by ID
- [x] Update extinguisher information
- [x] Delete extinguisher
- [x] Schedule inspections (date, time, notify inspector)
- [x] Log maintenance (action, date, issues, parts, cost, notes)

### Activity 4 — Reporting Service
- [x] Inventory — total, daily, monthly, yearly
- [x] Inspections — pending, completed, overdue
- [x] Compliance — expired, upcoming expirations
- [x] Maintenance — history, frequency, recent activities
- [x] Export as PDF
- [x] Export as CSV

### Activity 5 — API Testing & Deployment
- [x] Swagger/OpenAPI documentation on all services
- [x] Database: PostgreSQL (fems_users, fems_extinguishers, fems_notifications)
- [x] PDF export via pdfkit
- [x] CSV export via csv-stringify
- [x] Process management: concurrently (dev) / pm2 (production)

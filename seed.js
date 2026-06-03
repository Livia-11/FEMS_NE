/**
 * Seeds a complete demo flow for the Fire Extinguisher Management System.
 *
 * Run after the services are started:
 *   node seed.js
 */
require('dotenv').config();

const { Pool } = require('pg');
const axios = require('./api-gateway/node_modules/axios');
const bcrypt = require('./user-service/node_modules/bcryptjs');

const GW = process.env.GATEWAY_URL || 'http://localhost:3000';
const DEMO_PASSWORD = 'Demo@1234';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgre',
  database: process.env.PG_USER_DB || 'fems',
});

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function ensureUser(user) {
  const existing = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [user.email]);
  if (existing.rows.length) {
    console.log(`- User exists: ${user.email}`);
    return existing.rows[0];
  }

  const hash = await bcrypt.hash(user.password || DEMO_PASSWORD, 10);
  const result = await pool.query(
    `INSERT INTO users (first_name,last_name,email,password_hash,role,is_active,email_verified,phone,department)
     VALUES ($1,$2,$3,$4,$5,TRUE,TRUE,$6,$7) RETURNING *`,
    [user.first_name, user.last_name, user.email, hash, user.role, user.phone || null, user.department || null]
  );
  console.log(`✓ Created ${user.role}: ${user.email}`);
  return result.rows[0];
}

async function login(email, password) {
  const resp = await axios.post(`${GW}/api/auth/login`, { email, password });
  return resp.data;
}

async function getOrCreateExtinguisher(token, data) {
  try {
    const resp = await axios.post(`${GW}/api/extinguishers`, data, authHeader(token));
    console.log(`✓ Registered extinguisher: ${data.serial_number}`);
    return resp.data.data;
  } catch (err) {
    if (err.response?.status === 409) {
      const list = await axios.get(
        `${GW}/api/extinguishers?search=${encodeURIComponent(data.serial_number)}&limit=5`,
        authHeader(token)
      );
      const found = list.data.data?.find(item => item.serial_number === data.serial_number);
      if (found) {
        console.log(`- Extinguisher exists: ${data.serial_number}`);
        return found;
      }
    }
    throw err;
  }
}

async function scheduleInspection(token, data) {
  const resp = await axios.post(`${GW}/api/inspections`, data, authHeader(token));
  console.log(`✓ Scheduled inspection: extinguisher #${data.extinguisher_id}`);
  return resp.data.data;
}

async function updateInspection(token, id, data) {
  await axios.put(`${GW}/api/inspections/${id}`, data, authHeader(token));
}

async function logMaintenance(token, data) {
  await axios.post(`${GW}/api/maintenance`, data, authHeader(token));
  console.log(`✓ Logged maintenance: extinguisher #${data.extinguisher_id}`);
}

async function sendNotification(token, data) {
  await axios.post(`${GW}/api/notifications/send`, data, authHeader(token));
  console.log(`✓ Sent notification: ${data.title}`);
}

async function main() {
  console.log('\nTZW LTD FEMS - Seeding demo data\n');

  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'kireziliva@gmail.com';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';

  const john = await ensureUser({
    first_name: 'John',
    last_name: 'Kariuki',
    email: 'john.inspector@tzwltd.com',
    password: DEMO_PASSWORD,
    role: 'inspector',
    department: 'Fire Safety',
  });

  const sarah = await ensureUser({
    first_name: 'Sarah',
    last_name: 'Mukama',
    email: 'sarah.inspector@tzwltd.com',
    password: DEMO_PASSWORD,
    role: 'inspector',
    department: 'Fire Safety',
  });

  const facilitiesUser = await ensureUser({
    first_name: 'Alice',
    last_name: 'Facilities',
    email: 'alice.facilities@tzwltd.com',
    password: DEMO_PASSWORD,
    role: 'user',
    department: 'Facilities',
  });

  await ensureUser({
    first_name: 'Bob',
    last_name: 'Operations',
    email: 'bob.operations@tzwltd.com',
    password: DEMO_PASSWORD,
    role: 'user',
    department: 'Operations',
  });

  const adminLogin = await login(adminEmail, adminPassword);
  const johnLogin = await login(john.email, DEMO_PASSWORD);
  const sarahLogin = await login(sarah.email, DEMO_PASSWORD);
  const adminToken = adminLogin.token;
  const johnToken = johnLogin.token;
  const sarahToken = sarahLogin.token;

  console.log('\nDemo credentials');
  console.log(`Admin:     ${adminEmail} / ${adminPassword}`);
  console.log(`Inspector: ${john.email} / ${DEMO_PASSWORD}`);
  console.log(`Inspector: ${sarah.email} / ${DEMO_PASSWORD}`);
  console.log(`User:      ${facilitiesUser.email} / ${DEMO_PASSWORD}`);

  console.log('\nRegistering extinguishers');
  const extinguishers = [];
  const extinguisherDefs = [
    { serial_number: 'FE-DEMO-001', location: 'Building A - Main Lobby', building: 'Building A', floor: 'G', type: 'CO2', size: '5 lb', installation_date: daysFromNow(-900), expiry_date: daysFromNow(450), status: 'active', notes: 'Recently inspected and compliant.' },
    { serial_number: 'FE-DEMO-002', location: 'Building A - Server Room', building: 'Building A', floor: '2', type: 'Clean Agent', size: '5 lb', installation_date: daysFromNow(-500), expiry_date: daysFromNow(900), status: 'active', notes: 'Critical server room unit.' },
    { serial_number: 'FE-DEMO-003', location: 'Warehouse - Loading Bay', building: 'Warehouse', floor: 'G', type: 'Dry Chemical', size: '12 lb', installation_date: daysFromNow(-700), expiry_date: daysFromNow(60), status: 'active', notes: 'Expiring soon.' },
    { serial_number: 'FE-DEMO-004', location: 'Cafeteria - Kitchen', building: 'Cafeteria', floor: 'G', type: 'Wet Chemical', size: '6 lb', installation_date: daysFromNow(-1200), expiry_date: daysFromNow(-30), status: 'expired', notes: 'Expired unit awaiting replacement.' },
    { serial_number: 'FE-DEMO-005', location: 'Parking Garage - Level 1', building: 'Parking Garage', floor: '1', type: 'Foam', size: '9 lb', installation_date: daysFromNow(-650), expiry_date: daysFromNow(500), status: 'maintenance', notes: 'Valve issue reported.' },
    { serial_number: 'FE-DEMO-006', location: 'Workshop - Engineering', building: 'Workshop', floor: 'G', type: 'Water', size: '20 lb', installation_date: daysFromNow(-300), expiry_date: daysFromNow(1000), status: 'active', notes: 'Upcoming inspection scheduled.' },
  ];

  for (const item of extinguisherDefs) {
    extinguishers.push(await getOrCreateExtinguisher(adminToken, item));
  }

  console.log('\nScheduling and completing inspections');
  const inspection1 = await scheduleInspection(adminToken, {
    extinguisher_id: extinguishers[0].id,
    inspector_id: john.id,
    inspector_name: 'John Kariuki',
    scheduled_date: daysFromNow(-7),
    scheduled_time: '09:00',
    notes: 'Annual inspection.',
  });
  await updateInspection(johnToken, inspection1.id, {
    status: 'completed',
    result: 'pass',
    actual_date: daysFromNow(-7),
    pressure_ok: true,
    seal_intact: true,
    label_readable: true,
    pin_in_place: true,
    notes: 'Passed all inspection checks.',
  });

  const inspection2 = await scheduleInspection(adminToken, {
    extinguisher_id: extinguishers[4].id,
    inspector_id: sarah.id,
    inspector_name: 'Sarah Mukama',
    scheduled_date: daysFromNow(-3),
    scheduled_time: '11:00',
    notes: 'Investigate valve issue.',
  });
  await updateInspection(sarahToken, inspection2.id, {
    status: 'completed',
    result: 'needs_maintenance',
    actual_date: daysFromNow(-3),
    pressure_ok: false,
    seal_intact: true,
    label_readable: true,
    pin_in_place: true,
    notes: 'Pressure below operating range. Maintenance required.',
  });

  await scheduleInspection(adminToken, {
    extinguisher_id: extinguishers[5].id,
    inspector_id: john.id,
    inspector_name: 'John Kariuki',
    scheduled_date: daysFromNow(5),
    scheduled_time: '14:30',
    notes: 'Upcoming routine inspection.',
  });

  console.log('\nLogging maintenance');
  await logMaintenance(sarahToken, {
    extinguisher_id: extinguishers[4].id,
    inspector_id: sarah.id,
    inspector_name: 'Sarah Mukama',
    action_taken: 'Replaced valve assembly and recharged unit',
    date_of_maintenance: daysFromNow(-1),
    issues_identified: 'Low pressure caused by leaking valve.',
    parts_replaced: 'Valve assembly, pressure seal',
    cost: 125.00,
    next_service_date: daysFromNow(180),
    notes: 'Unit returned to service after pressure test.',
  });

  await logMaintenance(adminToken, {
    extinguisher_id: extinguishers[3].id,
    inspector_id: john.id,
    inspector_name: 'John Kariuki',
    action_taken: 'Marked expired unit for replacement',
    date_of_maintenance: daysFromNow(-2),
    issues_identified: 'Expiry date passed.',
    cost: 0,
    notes: 'Replacement purchase order pending.',
  });

  console.log('\nCreating notifications');
  await sendNotification(adminToken, {
    recipient_id: john.id,
    type: 'inspection',
    title: 'Upcoming Inspection',
    message: 'You have an upcoming routine inspection for FE-DEMO-006.',
  });
  await sendNotification(adminToken, {
    recipient_id: facilitiesUser.id,
    type: 'status',
    title: 'Extinguisher Status Updated',
    message: 'The Parking Garage unit was serviced and returned to active status.',
  });

  console.log('\nDemo seed complete. Open http://localhost:5173 and log in with the demo credentials above.\n');
}

main()
  .catch(err => {
    console.error('Seed failed:', err.response?.data || err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

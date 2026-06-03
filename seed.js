/**
 * Seed script — populates all services with sample data for testing.
 * Run AFTER starting all services: node seed.js
 */
const axios = require('axios');

const GW = 'http://localhost:3000';
let token = '';

async function login() {
  const resp = await axios.post(`${GW}/api/auth/login`, {
    email: 'kireziliva@gmail.com',
    password: 'Admin@123456',
  });
  token = resp.data.token;
  console.log('✓ Logged in as admin');
}

function auth() { return { headers: { Authorization: `Bearer ${token}` } }; }

async function seedUsers() {
  const users = [
    { first_name: 'Alice', last_name: 'Inspector', email: 'alice@tzwltd.com', password: 'Inspector@123', role: 'inspector', department: 'Fire Safety' },
    { first_name: 'Bob', last_name: 'Inspector', email: 'bob@tzwltd.com', password: 'Inspector@123', role: 'inspector', department: 'Maintenance' },
    { first_name: 'Carol', last_name: 'Manager', email: 'carol@tzwltd.com', password: 'Manager@123', role: 'user', department: 'Facilities' },
    { first_name: 'David', last_name: 'Tech', email: 'david@tzwltd.com', password: 'Viewer@1234', role: 'user', department: 'IT' },
  ];
  for (const u of users) {
    try {
      await axios.post(`${GW}/api/users`, u, auth());
      console.log(`✓ Created user: ${u.email}`);
    } catch (e) {
      if (e.response?.status === 409) console.log(`- User exists: ${u.email}`);
      else console.error(`✗ User error: ${e.response?.data?.error}`);
    }
  }
}

async function seedExtinguishers() {
  const items = [
    { serial_number: 'FE-2024-001', location: 'Building A - Main Lobby',      building: 'Building A', floor: 'G', type: 'CO2',          size: '5 lb',   installation_date: '2023-01-15', expiry_date: '2024-01-15', status: 'expired' },
    { serial_number: 'FE-2024-002', location: 'Building A - Level 2 Corridor', building: 'Building A', floor: '2', type: 'Dry Chemical',  size: '10 lb',  installation_date: '2023-06-01', expiry_date: '2025-06-01', status: 'active' },
    { serial_number: 'FE-2024-003', location: 'Building B - Server Room',       building: 'Building B', floor: '1', type: 'Clean Agent',   size: '9 lb',   installation_date: '2024-01-10', expiry_date: '2025-01-10', status: 'active' },
    { serial_number: 'FE-2024-004', location: 'Building B - Kitchen',           building: 'Building B', floor: 'G', type: 'Wet Chemical',  size: '6 lb',   installation_date: '2023-09-20', expiry_date: '2024-09-20', status: 'active' },
    { serial_number: 'FE-2024-005', location: 'Warehouse - Loading Bay',        building: 'Warehouse',  floor: 'G', type: 'Water',         size: '20 lb',  installation_date: '2022-11-05', expiry_date: '2024-11-05', status: 'active' },
    { serial_number: 'FE-2024-006', location: 'Building C - Reception',         building: 'Building C', floor: 'G', type: 'CO2',           size: '2.5 lb', installation_date: '2024-03-01', expiry_date: '2026-03-01', status: 'active' },
    { serial_number: 'FE-2024-007', location: 'Parking Garage - Level 1',       building: 'Parking',    floor: '1', type: 'Dry Chemical',  size: '12 lb',  installation_date: '2023-07-15', expiry_date: '2025-07-15', status: 'active' },
    { serial_number: 'FE-2024-008', location: 'Building A - Boiler Room',       building: 'Building A', floor: 'B', type: 'Foam',          size: '9 lb',   installation_date: '2024-02-20', expiry_date: '2025-02-20', status: 'maintenance' },
  ];
  const ids = [];
  for (const e of items) {
    try {
      const resp = await axios.post(`${GW}/api/extinguishers`, e, auth());
      ids.push(resp.data.data.id);
      console.log(`✓ Registered: ${e.serial_number}`);
    } catch (err) {
      if (err.response?.status === 409) {
        console.log(`- Extinguisher exists: ${e.serial_number}`);
      } else {
        console.error(`✗ Extinguisher error: ${err.response?.data?.error}`);
      }
    }
  }
  return ids;
}

async function seedInspections(extIds) {
  if (!extIds.length) return;
  const today = new Date();
  const inspections = [
    { extinguisher_id: extIds[0], scheduled_date: '2024-02-01', scheduled_time: '09:00', inspector_name: 'Alice Inspector', status: 'completed', result: 'fail', notes: 'Extinguisher expired' },
    { extinguisher_id: extIds[1], scheduled_date: new Date(today.getTime() + 7*86400000).toISOString().split('T')[0], scheduled_time: '10:30', inspector_name: 'Bob Inspector' },
    { extinguisher_id: extIds[2], scheduled_date: new Date(today.getTime() + 14*86400000).toISOString().split('T')[0], scheduled_time: '14:00', inspector_name: 'Alice Inspector' },
    { extinguisher_id: extIds[3], scheduled_date: '2024-01-10', scheduled_time: '11:00', inspector_name: 'Bob Inspector', notes: 'Annual check' },
  ];
  for (const ins of inspections) {
    try {
      await axios.post(`${GW}/api/inspections`, ins, auth());
      console.log(`✓ Scheduled inspection for extinguisher #${ins.extinguisher_id}`);
    } catch (err) {
      console.error(`✗ Inspection error: ${err.response?.data?.error}`);
    }
  }
}

async function seedMaintenance(extIds) {
  if (!extIds.length) return;
  const logs = [
    { extinguisher_id: extIds[0], action_taken: 'Annual recharge and pressure test', date_of_maintenance: '2024-01-15', issues_identified: 'Low pressure', cost: 75.00, inspector_name: 'Bob Inspector' },
    { extinguisher_id: extIds[4], action_taken: 'Replaced safety pin and inspection tag', date_of_maintenance: '2024-02-20', parts_replaced: 'Safety pin, inspection tag', cost: 12.50, inspector_name: 'Alice Inspector' },
    { extinguisher_id: extIds[7], action_taken: 'Full service — replaced valve and recharged', date_of_maintenance: '2024-03-01', issues_identified: 'Leaking valve', parts_replaced: 'Valve assembly', cost: 145.00, next_service_date: '2025-03-01', inspector_name: 'Bob Inspector' },
  ];
  for (const m of logs) {
    try {
      await axios.post(`${GW}/api/maintenance`, m, auth());
      console.log(`✓ Logged maintenance for extinguisher #${m.extinguisher_id}`);
    } catch (err) {
      console.error(`✗ Maintenance error: ${err.response?.data?.error}`);
    }
  }
}

async function main() {
  console.log('\n🔥 TZW LTD FEMS — Seeding sample data\n');
  try {
    await login();
    await seedUsers();
    const ids = await seedExtinguishers();
    await seedInspections(ids);
    await seedMaintenance(ids);
    console.log('\n✅ Seeding complete!\n');
  } catch (err) {
    console.error('Seed error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('⚠  Services not running. Start with: npm start');
    }
    process.exit(1);
  }
}

main();

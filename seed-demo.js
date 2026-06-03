/**
 * seed-demo.js — Full demo data for FEMS showing the complete system flow.
 *
 * FLOW DEMONSTRATED:
 * 1. Admin registers 12 extinguishers across university buildings
 * 2. Admin creates inspector and staff accounts
 * 3. Admin schedules inspections assigned to specific inspectors
 * 4. Inspectors complete inspections (pass / fail / needs_maintenance)
 * 5. Inspectors log maintenance activities for failed units
 * 6. Users can see equipment status and report issues
 *
 * Run: node seed-demo.js   (services must be running: npm start)
 */

require('dotenv').config();
// axios lives in a service's node_modules — resolve from there
const axios = require('./api-gateway/node_modules/axios');

const GW = process.env.GATEWAY_URL || 'http://localhost:3000';

/* ── helpers ──────────────────────────────────────────────────────── */
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function login(email, password) {
  const r = await axios.post(`${GW}/api/auth/login`, { email, password });
  return r.data.token;
}

async function getOrCreateUser(adminToken, data) {
  // Admin can only create admin/inspector. For 'user' role, use register+verify flow.
  if (data.role === 'user') return getOrRegisterUser(data);

  try {
    const r = await axios.post(`${GW}/api/users`, data, authHeader(adminToken));
    console.log(`  ✓ Created ${data.role}: ${data.first_name} ${data.last_name} <${data.email}>`);
    return r.data.user;
  } catch (e) {
    if (e.response?.status === 409) {
      const list = await axios.get(
        `${GW}/api/users?search=${encodeURIComponent(data.email)}&limit=5`,
        authHeader(adminToken)
      );
      const found = list.data.data?.find(u => u.email === data.email);
      if (found) { console.log(`  - Exists (${data.role}): ${data.email}`); return found; }
    }
    console.error(`  ✗ User error for ${data.email}: ${e.response?.data?.error ?? e.message}`);
    return null;
  }
}

async function getOrRegisterUser(data) {
  // Try logging in first (user might already exist)
  try {
    const r = await axios.post(`${GW}/api/auth/login`, { email: data.email, password: data.password });
    console.log(`  - Exists (user): ${data.email}`);
    return r.data.user;
  } catch (_) { /* not found or not verified yet */ }

  // Register + auto-verify using dev OTP
  try {
    const reg = await axios.post(`${GW}/api/auth/register`, {
      first_name: data.first_name, last_name: data.last_name,
      email: data.email, password: data.password,
    });
    const otp = reg.data.otp ?? reg.data.dev_otp;
    if (!otp) { console.error(`  ✗ No dev OTP returned for ${data.email}. Is NODE_ENV=development?`); return null; }

    const verify = await axios.post(`${GW}/api/auth/verify-email`, { email: data.email, otp });
    console.log(`  ✓ Registered & verified user: ${data.first_name} ${data.last_name} <${data.email}>`);
    return verify.data.user;
  } catch (e) {
    console.error(`  ✗ Register error for ${data.email}: ${e.response?.data?.error ?? e.message}`);
    return null;
  }
}

async function getOrCreateExtinguisher(adminToken, data) {
  try {
    const r = await axios.post(`${GW}/api/extinguishers`, data, authHeader(adminToken));
    process.stdout.write(`  ✓ ${data.serial_number}\n`);
    return r.data.data;
  } catch (e) {
    if (e.response?.status === 409) {
      const list = await axios.get(
        `${GW}/api/extinguishers?search=${encodeURIComponent(data.serial_number)}&limit=5`,
        authHeader(adminToken)
      );
      const found = list.data.data?.find(x => x.serial_number === data.serial_number);
      if (found) { process.stdout.write(`  - Exists: ${data.serial_number}\n`); return found; }
    }
    console.error(`  ✗ Extinguisher error (${data.serial_number}): ${e.response?.data?.error ?? e.message}`);
    return null;
  }
}

async function scheduleInspection(adminToken, data) {
  try {
    const r = await axios.post(`${GW}/api/inspections`, data, authHeader(adminToken));
    return r.data.data;
  } catch (e) {
    console.error(`  ✗ Inspection error: ${e.response?.data?.error ?? e.message}`);
    return null;
  }
}

async function recordResult(inspectorToken, inspectionId, data) {
  try {
    await axios.put(`${GW}/api/inspections/${inspectionId}`, data, authHeader(inspectorToken));
    return true;
  } catch (e) {
    console.error(`  ✗ Result update error (id=${inspectionId}): ${e.response?.data?.error ?? e.message}`);
    return false;
  }
}

async function logMaintenance(token, data) {
  try {
    await axios.post(`${GW}/api/maintenance`, data, authHeader(token));
    process.stdout.write(`  ✓ Maintenance: ${data.action_taken.slice(0, 50)}\n`);
  } catch (e) {
    console.error(`  ✗ Maintenance error: ${e.response?.data?.error ?? e.message}`);
  }
}

/* ── main ─────────────────────────────────────────────────────────── */
async function main() {
  console.log('\n🔥  TZW LTD FEMS — Seeding full demo data\n');

  /* ── 1. Admin login ──────────────────────────────────────────────── */
  let adminToken;
  try {
    adminToken = await login('kireziliva@gmail.com', 'Admin@123456');
    console.log('✓ Admin logged in\n');
  } catch (e) {
    console.error('✗ Admin login failed:', e.response?.data?.error ?? e.message);
    console.error('  → Make sure all services are running: npm start');
    process.exit(1);
  }

  /* ── 2. Create staff accounts ────────────────────────────────────── */
  console.log('── Creating Users ──');
  const john = await getOrCreateUser(adminToken, {
    first_name: 'John', last_name: 'Kariuki',
    email: 'john.inspector@tzwltd.com', password: 'Inspector@123',
    role: 'inspector', department: 'Fire Safety',
  });
  const sarah = await getOrCreateUser(adminToken, {
    first_name: 'Sarah', last_name: 'Mukama',
    email: 'sarah.inspector@tzwltd.com', password: 'Inspector@123',
    role: 'inspector', department: 'Fire Safety',
  });
  const alice = await getOrCreateUser(adminToken, {
    first_name: 'Alice', last_name: 'Nzuki',
    email: 'alice.staff@tzwltd.com', password: 'Staff@1234',
    role: 'user', department: 'Administration',
  });
  await getOrCreateUser(adminToken, {
    first_name: 'Bob', last_name: 'Odhiambo',
    email: 'bob.facilities@tzwltd.com', password: 'Staff@1234',
    role: 'user', department: 'Facilities',
  });

  /* ── 3. Register Extinguishers ───────────────────────────────────── */
  console.log('\n── Registering Extinguishers (Admin adds physical assets) ──');

  const extDefs = [
    // Active — recently inspected (PASS)
    { serial_number: 'FE-UNIV-001', location: 'Library — Main Hall',        building: 'Library',          floor: 'G', type: 'CO2',          size: '5 lb',   installation_date: '2022-01-15', expiry_date: '2026-01-15', status: 'active',      notes: 'Near main entrance' },
    // Active — inspection found it needs maintenance (recently recharged)
    { serial_number: 'FE-UNIV-002', location: 'Computer Lab — Room 101',    building: 'Science Block',    floor: '1', type: 'CO2',          size: '9 lb',   installation_date: '2022-03-20', expiry_date: '2026-03-20', status: 'active',      notes: 'Serviced after low-pressure finding' },
    // Active — upcoming inspection scheduled
    { serial_number: 'FE-UNIV-003', location: 'Chemistry Lab — Room 205',   building: 'Science Block',    floor: '2', type: 'Dry Chemical', size: '12 lb',  installation_date: '2022-06-10', expiry_date: '2026-06-10', status: 'active',      notes: 'Inspection scheduled' },
    // Active — OVERDUE inspection
    { serial_number: 'FE-UNIV-004', location: 'Main Kitchen',               building: 'Cafeteria',        floor: 'G', type: 'Wet Chemical', size: '6 lb',   installation_date: '2023-01-05', expiry_date: '2027-01-05', status: 'active',      notes: 'Overdue inspection' },
    // Expired — inspection confirmed it's dead
    { serial_number: 'FE-UNIV-005', location: 'Main Corridor — Block A',    building: 'Block A',          floor: '1', type: 'Foam',         size: '9 lb',   installation_date: '2020-08-01', expiry_date: '2023-08-01', status: 'expired',     notes: 'Replacement ordered after inspection failure' },
    // Active — critical unit, upcoming inspection
    { serial_number: 'FE-UNIV-006', location: 'Server Room — IT Dept',      building: 'Admin Block',      floor: '3', type: 'Clean Agent',  size: '5 lb',   installation_date: '2024-01-10', expiry_date: '2028-01-10', status: 'active',      notes: 'Critical asset — server room protection' },
    // Under maintenance — inspection found serious issues
    { serial_number: 'FE-UNIV-007', location: 'Parking Garage — Level 1',   building: 'Parking Block',    floor: '1', type: 'Water',        size: '20 lb',  installation_date: '2021-05-15', expiry_date: '2025-05-15', status: 'maintenance', notes: 'Valve replaced during service' },
    // Active — recently serviced
    { serial_number: 'FE-UNIV-008', location: 'Reception — Main Building',  building: 'Admin Block',      floor: 'G', type: 'CO2',          size: '2.5 lb', installation_date: '2023-09-01', expiry_date: '2027-09-01', status: 'active',      notes: 'Annual service done' },
    // Active — upcoming inspection in 3 days
    { serial_number: 'FE-UNIV-009', location: 'Workshop — Engineering Dept',building: 'Engineering Block',floor: 'G', type: 'Dry Chemical', size: '12 lb',  installation_date: '2023-03-15', expiry_date: '2027-03-15', status: 'active',      notes: 'Inspection due soon' },
    // Active — no recent inspection
    { serial_number: 'FE-UNIV-010', location: 'Storage Room — Block B',     building: 'Block B',          floor: 'B1',type: 'Foam',         size: '5 lb',   installation_date: '2023-07-20', expiry_date: '2027-07-20', status: 'active' },
    // Active — recently inspected (PASS) by John
    { serial_number: 'FE-UNIV-011', location: 'Lecture Hall — Auditorium',  building: 'Main Building',    floor: 'G', type: 'CO2',          size: '9 lb',   installation_date: '2022-11-01', expiry_date: '2026-11-01', status: 'active' },
    // Active — new unit
    { serial_number: 'FE-UNIV-012', location: 'Staff Office — Block C',     building: 'Block C',          floor: '2', type: 'CO2',          size: '5 lb',   installation_date: '2025-02-01', expiry_date: '2029-02-01', status: 'active',      notes: 'Newly installed' },
  ];

  const exts = [];
  for (const d of extDefs) {
    const e = await getOrCreateExtinguisher(adminToken, d);
    exts.push(e);
  }

  const e = (i) => exts[i];
  const valid = (i) => e(i)?.id;

  /* ── 4. Schedule Inspections ─────────────────────────────────────── */
  console.log('\n── Scheduling Inspections (Admin assigns to inspectors) ──');

  // Past inspections (will be updated with results)
  const i001 = valid(0) && await scheduleInspection(adminToken, {
    extinguisher_id: e(0).id, inspector_id: john?.id, inspector_name: 'John Kariuki',
    scheduled_date: daysFromNow(-14), scheduled_time: '09:00',
    notes: 'Annual inspection — Library unit',
  });
  console.log(i001 ? `  ✓ Scheduled: FE-UNIV-001 → John (${daysFromNow(-14)})` : '  - FE-UNIV-001 inspection skipped');

  const i002 = valid(1) && await scheduleInspection(adminToken, {
    extinguisher_id: e(1).id, inspector_id: john?.id, inspector_name: 'John Kariuki',
    scheduled_date: daysFromNow(-7), scheduled_time: '10:00',
    notes: 'Routine inspection — Computer Lab',
  });
  console.log(i002 ? `  ✓ Scheduled: FE-UNIV-002 → John (${daysFromNow(-7)})` : '  - FE-UNIV-002 inspection skipped');

  const i005 = valid(4) && await scheduleInspection(adminToken, {
    extinguisher_id: e(4).id, inspector_id: sarah?.id, inspector_name: 'Sarah Mukama',
    scheduled_date: daysFromNow(-21), scheduled_time: '15:00',
    notes: 'Compliance check — Main Corridor (unit may have expired)',
  });
  console.log(i005 ? `  ✓ Scheduled: FE-UNIV-005 → Sarah (${daysFromNow(-21)})` : '  - FE-UNIV-005 inspection skipped');

  const i007 = valid(6) && await scheduleInspection(adminToken, {
    extinguisher_id: e(6).id, inspector_id: john?.id, inspector_name: 'John Kariuki',
    scheduled_date: daysFromNow(-30), scheduled_time: '08:00',
    notes: 'Annual inspection — Parking Garage',
  });
  console.log(i007 ? `  ✓ Scheduled: FE-UNIV-007 → John (${daysFromNow(-30)})` : '  - FE-UNIV-007 inspection skipped');

  const i008 = valid(7) && await scheduleInspection(adminToken, {
    extinguisher_id: e(7).id, inspector_id: sarah?.id, inspector_name: 'Sarah Mukama',
    scheduled_date: daysFromNow(-45), scheduled_time: '11:00',
    notes: 'Annual service check — Reception',
  });
  console.log(i008 ? `  ✓ Scheduled: FE-UNIV-008 → Sarah (${daysFromNow(-45)})` : '  - FE-UNIV-008 inspection skipped');

  const i011 = valid(10) && await scheduleInspection(adminToken, {
    extinguisher_id: e(10).id, inspector_id: john?.id, inspector_name: 'John Kariuki',
    scheduled_date: daysFromNow(-3), scheduled_time: '11:00',
    notes: 'Annual inspection — Auditorium',
  });
  console.log(i011 ? `  ✓ Scheduled: FE-UNIV-011 → John (${daysFromNow(-3)})` : '  - FE-UNIV-011 inspection skipped');

  // Future / overdue
  valid(2) && await scheduleInspection(adminToken, {
    extinguisher_id: e(2).id, inspector_id: sarah?.id, inspector_name: 'Sarah Mukama',
    scheduled_date: daysFromNow(7), scheduled_time: '11:00',
    notes: 'Annual inspection — Chemistry Lab',
  }) && console.log(`  ✓ Scheduled: FE-UNIV-003 → Sarah (upcoming ${daysFromNow(7)})`);

  valid(3) && await scheduleInspection(adminToken, {
    extinguisher_id: e(3).id, inspector_id: john?.id, inspector_name: 'John Kariuki',
    scheduled_date: daysFromNow(-5), scheduled_time: '14:00',
    notes: 'Quarterly inspection — Kitchen (OVERDUE)',
  }) && console.log(`  ✓ Scheduled: FE-UNIV-004 → John (overdue, ${daysFromNow(-5)})`);

  valid(5) && await scheduleInspection(adminToken, {
    extinguisher_id: e(5).id, inspector_id: sarah?.id, inspector_name: 'Sarah Mukama',
    scheduled_date: daysFromNow(14), scheduled_time: '09:30',
    notes: 'Annual inspection — Server Room (critical asset)',
  }) && console.log(`  ✓ Scheduled: FE-UNIV-006 → Sarah (upcoming ${daysFromNow(14)})`);

  valid(8) && await scheduleInspection(adminToken, {
    extinguisher_id: e(8).id, inspector_id: sarah?.id, inspector_name: 'Sarah Mukama',
    scheduled_date: daysFromNow(3), scheduled_time: '10:30',
    notes: 'Routine inspection — Workshop',
  }) && console.log(`  ✓ Scheduled: FE-UNIV-009 → Sarah (upcoming ${daysFromNow(3)})`);

  /* ── 5. Mark overdue inspections ─────────────────────────────────── */
  try {
    await axios.post(`${GW}/api/inspections/overdue/mark`, {}, authHeader(adminToken));
    console.log('\n  ✓ Overdue inspections marked');
  } catch (e) {
    console.error('  ✗ Could not mark overdue:', e.response?.data?.error);
  }

  /* ── 6. Record inspection results ───────────────────────────────── */
  console.log('\n── Recording Inspection Results (Inspectors completing their work) ──');

  let johnToken, sarahToken;
  try {
    johnToken = await login('john.inspector@tzwltd.com', 'Inspector@123');
    console.log('  ✓ Logged in as John Kariuki (Inspector)');
  } catch (e) { console.error('  ✗ John login failed:', e.response?.data?.error); }

  try {
    sarahToken = await login('sarah.inspector@tzwltd.com', 'Inspector@123');
    console.log('  ✓ Logged in as Sarah Mukama (Inspector)');
  } catch (e) { console.error('  ✗ Sarah login failed:', e.response?.data?.error); }

  if (i001?.id && johnToken) {
    await recordResult(johnToken, i001.id, {
      status: 'completed', result: 'pass', actual_date: daysFromNow(-14),
      pressure_ok: true, seal_intact: true, label_readable: true, pin_in_place: true,
      notes: 'All checks passed. Unit in excellent condition. Pressure 16 bar (nominal). Next inspection recommended in 12 months.',
    });
    console.log('  ✓ FE-UNIV-001: PASS — Library unit healthy');
  }

  if (i002?.id && johnToken) {
    await recordResult(johnToken, i002.id, {
      status: 'completed', result: 'needs_maintenance', actual_date: daysFromNow(-7),
      pressure_ok: false, seal_intact: true, label_readable: true, pin_in_place: true,
      notes: 'Pressure gauge reads 8 bar — below minimum of 14 bar. Unit must be recharged before next use. Maintenance request raised.',
    });
    console.log('  ✓ FE-UNIV-002: NEEDS MAINTENANCE — Low pressure detected');
  }

  if (i005?.id && sarahToken) {
    await recordResult(sarahToken, i005.id, {
      status: 'completed', result: 'fail', actual_date: daysFromNow(-21),
      pressure_ok: false, seal_intact: false, label_readable: false, pin_in_place: true,
      notes: 'UNIT CONDEMNED. Expired Aug 2023 — zero pressure, corroded seal, degraded label. IMMEDIATE REPLACEMENT REQUIRED. DO NOT USE.',
    });
    console.log('  ✓ FE-UNIV-005: FAIL — Expired unit condemned, replacement ordered');
  }

  if (i007?.id && johnToken) {
    await recordResult(johnToken, i007.id, {
      status: 'completed', result: 'fail', actual_date: daysFromNow(-30),
      pressure_ok: false, seal_intact: true, label_readable: true, pin_in_place: false,
      notes: 'Valve assembly corroded. Safety pin missing. Unit taken out of service immediately. Full service booked.',
    });
    console.log('  ✓ FE-UNIV-007: FAIL — Corroded valve, missing pin');
  }

  if (i008?.id && sarahToken) {
    await recordResult(sarahToken, i008.id, {
      status: 'completed', result: 'pass', actual_date: daysFromNow(-45),
      pressure_ok: true, seal_intact: true, label_readable: true, pin_in_place: true,
      notes: 'Annual check passed. Label renewed. Pressure confirmed at 15 bar.',
    });
    console.log('  ✓ FE-UNIV-008: PASS — Reception unit good');
  }

  if (i011?.id && johnToken) {
    await recordResult(johnToken, i011.id, {
      status: 'completed', result: 'pass', actual_date: daysFromNow(-3),
      pressure_ok: true, seal_intact: true, label_readable: true, pin_in_place: true,
      notes: 'Annual inspection complete. All systems nominal. Auditorium unit in good condition.',
    });
    console.log('  ✓ FE-UNIV-011: PASS — Auditorium unit healthy');
  }

  /* ── 7. Log Maintenance Activities ──────────────────────────────── */
  console.log('\n── Logging Maintenance (Inspectors recording their service work) ──');

  // FE-UNIV-002: Recharge after failed inspection
  if (valid(1) && johnToken) {
    await logMaintenance(johnToken, {
      extinguisher_id: e(1).id,
      inspector_id: john?.id, inspector_name: 'John Kariuki',
      action_taken: 'Recharged unit and replaced pressure gauge',
      date_of_maintenance: daysFromNow(-5),
      issues_identified: 'Pressure 8 bar (minimum 14 bar). Gauge faulty.',
      parts_replaced: 'CO2 cartridge, pressure gauge assembly',
      cost: 85.00,
      next_service_date: daysFromNow(365),
      notes: 'Unit now at 16 bar. Fully operational. Pressure tested and certified.',
    });
  }

  // FE-UNIV-007: Full service after major failure
  if (valid(6) && johnToken) {
    await logMaintenance(johnToken, {
      extinguisher_id: e(6).id,
      inspector_id: john?.id, inspector_name: 'John Kariuki',
      action_taken: 'Full overhaul — replaced valve assembly, safety pin, and recharged',
      date_of_maintenance: daysFromNow(-25),
      issues_identified: 'Corroded valve, missing safety pin, zero pressure.',
      parts_replaced: 'Valve assembly, discharge hose, safety pin, pressure indicator',
      cost: 165.00,
      next_service_date: daysFromNow(180),
      notes: 'Unit returned to service after full overhaul. Recommend 6-month inspection cycle for this location.',
    });
  }

  // FE-UNIV-005: Decommission + replacement order
  if (valid(4) && sarahToken) {
    await logMaintenance(sarahToken, {
      extinguisher_id: e(4).id,
      inspector_id: sarah?.id, inspector_name: 'Sarah Mukama',
      action_taken: 'Decommissioned expired unit — replacement ordered',
      date_of_maintenance: daysFromNow(-20),
      issues_identified: 'Expired 2023-08-01. Zero pressure, corroded body, degraded label.',
      parts_replaced: 'Full unit replacement (order placed)',
      cost: 260.00,
      notes: 'Temporary unit placed at location. New FE-UNIV-005 replacement due within 2 weeks.',
    });
  }

  // FE-UNIV-008: Annual service
  if (valid(7) && sarahToken) {
    await logMaintenance(sarahToken, {
      extinguisher_id: e(7).id,
      inspector_id: sarah?.id, inspector_name: 'Sarah Mukama',
      action_taken: 'Annual service — cleaned, lubricated, new inspection tag',
      date_of_maintenance: daysFromNow(-44),
      issues_identified: 'Dust accumulation, label slightly faded.',
      parts_replaced: 'Inspection tag, label',
      cost: 35.00,
      next_service_date: daysFromNow(320),
      notes: 'Unit in good condition. New label applied.',
    });
  }

  // FE-UNIV-012: New unit commissioning
  if (valid(11) && adminToken) {
    await logMaintenance(adminToken, {
      extinguisher_id: e(11).id,
      inspector_name: 'System Admin',
      action_taken: 'New unit commissioned and registered in system',
      date_of_maintenance: daysFromNow(-10),
      notes: 'New unit installed in Block C Staff Office. All paperwork filed.',
      cost: 0,
    });
  }

  /* ── Done ────────────────────────────────────────────────────────── */
  console.log('\n✅  Demo data seeded successfully!\n');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│              LOGIN CREDENTIALS                      │');
  console.log('├─────────────────────────────────────────────────────┤');
  console.log('│  ADMIN                                              │');
  console.log('│  Email:    kireziliva@gmail.com                     │');
  console.log('│  Password: Admin@123456                             │');
  console.log('├─────────────────────────────────────────────────────┤');
  console.log('│  INSPECTOR (John Kariuki)                           │');
  console.log('│  Email:    john.inspector@tzwltd.com                │');
  console.log('│  Password: Inspector@123                            │');
  console.log('│                                                     │');
  console.log('│  INSPECTOR (Sarah Mukama)                           │');
  console.log('│  Email:    sarah.inspector@tzwltd.com               │');
  console.log('│  Password: Inspector@123                            │');
  console.log('├─────────────────────────────────────────────────────┤');
  console.log('│  USER (Alice Nzuki — Administration)                │');
  console.log('│  Email:    alice.staff@tzwltd.com                   │');
  console.log('│  Password: Staff@1234                               │');
  console.log('│                                                     │');
  console.log('│  USER (Bob Odhiambo — Facilities)                   │');
  console.log('│  Email:    bob.facilities@tzwltd.com                │');
  console.log('│  Password: Staff@1234                               │');
  console.log('└─────────────────────────────────────────────────────┘');
  console.log('\n🔥  DEMO FLOW:');
  console.log('  1. Admin   → Full dashboard, 12 extinguishers, all reports');
  console.log('  2. John    → 4 completed inspections, 2 maintenance logs');
  console.log('  3. Sarah   → 2 upcoming + 1 completed + 2 maintenance logs');
  console.log('  4. Alice   → Equipment status, expiry alerts, schedule inspection');
}

main().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('   → Are all services running? Try: npm start');
  }
  process.exit(1);
});

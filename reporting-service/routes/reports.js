require('dotenv').config({ path: '../../.env' });
const express = require('express');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const { stringify } = require('csv-stringify');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const EXT_URL  = process.env.EXTINGUISHER_SERVICE_URL || 'http://localhost:3002';
const USER_URL = process.env.USER_SERVICE_URL         || 'http://localhost:3001';

async function getExt(path, token, params = {}) {
  const resp = await axios.get(`${EXT_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    timeout: 10000,
  });
  return resp.data;
}

function fwdToken(req) {
  return req.headers.authorization?.split(' ')[1];
}

/**
 * @swagger
 * tags:
 *   - name: Reports
 *     description: Real-time reporting and analytics
 */

/**
 * @swagger
 * /api/reports/inventory:
 *   get:
 *     tags: [Reports]
 *     summary: Overall inventory report
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory summary
 */
router.get('/inventory', authenticate, async (req, res) => {
  try {
    const token = fwdToken(req);
    const [summary, allExts] = await Promise.all([
      getExt('/api/extinguishers/stats/summary', token),
      getExt('/api/extinguishers', token, { limit: 1000 }),
    ]);

    res.json({
      report_type: 'inventory',
      generated_at: new Date().toISOString(),
      summary,
      total_extinguishers: allExts.pagination?.total || 0,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch inventory data', detail: err.message });
  }
});

/**
 * @swagger
 * /api/reports/inventory/daily:
 *   get:
 *     tags: [Reports]
 *     summary: Daily inventory summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Daily inventory report
 */
router.get('/inventory/daily', authenticate, async (req, res) => {
  try {
    const token = fwdToken(req);
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const [exts, inspections, maintenance] = await Promise.all([
      getExt('/api/extinguishers', token, { limit: 1000 }),
      getExt('/api/inspections', token, { from_date: date, to_date: date, limit: 1000 }),
      getExt('/api/maintenance', token, { from_date: date, to_date: date, limit: 1000 }),
    ]);

    res.json({
      report_type: 'daily_inventory',
      date,
      generated_at: new Date().toISOString(),
      total_extinguishers: exts.pagination?.total || 0,
      inspections_today: inspections.pagination?.total || 0,
      maintenance_today: maintenance.pagination?.total || 0,
      extinguishers_data: exts.data || [],
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to generate daily report', detail: err.message });
  }
});

/**
 * @swagger
 * /api/reports/inventory/monthly:
 *   get:
 *     tags: [Reports]
 *     summary: Monthly inventory summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200:
 *         description: Monthly inventory report
 */
router.get('/inventory/monthly', authenticate, async (req, res) => {
  try {
    const token = fwdToken(req);
    const now   = new Date();
    const year  = parseInt(req.query.year  || now.getFullYear());
    const month = parseInt(req.query.month || (now.getMonth() + 1));
    const from  = `${year}-${String(month).padStart(2,'0')}-01`;
    const to    = new Date(year, month, 0).toISOString().split('T')[0];

    const [inspections, maintenance] = await Promise.all([
      getExt('/api/inspections', token, { from_date: from, to_date: to, limit: 1000 }),
      getExt('/api/maintenance', token, { from_date: from, to_date: to, limit: 1000 }),
    ]);

    res.json({
      report_type: 'monthly_inventory',
      period: { year, month, from, to },
      generated_at: new Date().toISOString(),
      inspections_count: inspections.pagination?.total || 0,
      maintenance_count: maintenance.pagination?.total || 0,
      inspections: inspections.data || [],
      maintenance:  maintenance.data || [],
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to generate monthly report', detail: err.message });
  }
});

/**
 * @swagger
 * /api/reports/inventory/yearly:
 *   get:
 *     tags: [Reports]
 *     summary: Yearly inventory summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Yearly inventory report
 */
router.get('/inventory/yearly', authenticate, async (req, res) => {
  try {
    const token = fwdToken(req);
    const year  = parseInt(req.query.year || new Date().getFullYear());

    const [inspections, maintenance, summary] = await Promise.all([
      getExt('/api/inspections', token, { from_date: `${year}-01-01`, to_date: `${year}-12-31`, limit: 2000 }),
      getExt('/api/maintenance', token, { from_date: `${year}-01-01`, to_date: `${year}-12-31`, limit: 2000 }),
      getExt('/api/extinguishers/stats/summary', token),
    ]);

    res.json({
      report_type: 'yearly_inventory',
      year,
      generated_at: new Date().toISOString(),
      inventory_summary: summary,
      annual_inspections: inspections.pagination?.total || 0,
      annual_maintenance: maintenance.pagination?.total || 0,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to generate yearly report', detail: err.message });
  }
});

/**
 * @swagger
 * /api/reports/inspections:
 *   get:
 *     tags: [Reports]
 *     summary: Inspection report overview
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to_date
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Inspection report
 */
router.get('/inspections', authenticate, async (req, res) => {
  try {
    const token = fwdToken(req);
    const { from_date, to_date } = req.query;
    const params = { limit: 2000 };
    if (from_date) params.from_date = from_date;
    if (to_date)   params.to_date   = to_date;

    const [scheduled, completed, overdue] = await Promise.all([
      getExt('/api/inspections', token, { ...params, status: 'scheduled' }),
      getExt('/api/inspections', token, { ...params, status: 'completed' }),
      getExt('/api/inspections', token, { ...params, status: 'overdue' }),
    ]);

    res.json({
      report_type: 'inspections',
      generated_at: new Date().toISOString(),
      period: { from_date, to_date },
      scheduled:  { count: scheduled.pagination?.total || 0,  data: scheduled.data || [] },
      completed:  { count: completed.pagination?.total || 0,  data: completed.data || [] },
      overdue:    { count: overdue.pagination?.total   || 0,  data: overdue.data   || [] },
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to generate inspection report', detail: err.message });
  }
});

/**
 * @swagger
 * /api/reports/compliance:
 *   get:
 *     tags: [Reports]
 *     summary: Compliance report
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compliance status report
 */
router.get('/compliance', authenticate, async (req, res) => {
  try {
    const token = fwdToken(req);
    const [expired, expiring30, expiring90, all] = await Promise.all([
      getExt('/api/extinguishers', token, { status: 'expired', limit: 1000 }),
      getExt('/api/extinguishers', token, { expiring_days: 30, limit: 1000 }),
      getExt('/api/extinguishers', token, { expiring_days: 90, limit: 1000 }),
      getExt('/api/extinguishers/stats/summary', token),
    ]);

    const total   = all.total || 0;
    const expCnt  = expired.pagination?.total || 0;
    const exp30   = expiring30.pagination?.total || 0;
    const exp90   = expiring90.pagination?.total || 0;
    const compliant = total - expCnt;
    const rate    = total > 0 ? ((compliant / total) * 100).toFixed(1) : '100.0';

    res.json({
      report_type: 'compliance',
      generated_at: new Date().toISOString(),
      compliance_rate: `${rate}%`,
      total_extinguishers: total,
      compliant,
      expired:    { count: expCnt,  data: expired.data || [] },
      expiring_in_30_days: { count: exp30,  data: expiring30.data || [] },
      expiring_in_90_days: { count: exp90,  data: expiring90.data || [] },
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to generate compliance report', detail: err.message });
  }
});

/**
 * @swagger
 * /api/reports/maintenance:
 *   get:
 *     tags: [Reports]
 *     summary: Maintenance report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to_date
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Maintenance history and statistics
 */
router.get('/maintenance', authenticate, authorize('admin', 'inspector'), async (req, res) => {
  try {
    const token = fwdToken(req);
    const { from_date, to_date } = req.query;
    const params = { limit: 2000 };
    if (from_date) params.from_date = from_date;
    if (to_date)   params.to_date   = to_date;

    const logs = await getExt('/api/maintenance', token, params);
    const data = logs.data || [];

    const totalCost = data.reduce((sum, record) => sum + Number(record.cost || 0), 0);
    const byExtinguisher = {};
    for (const r of data) {
      byExtinguisher[r.extinguisher_id] = (byExtinguisher[r.extinguisher_id] || 0) + 1;
    }
    const mostFrequent = Object.entries(byExtinguisher)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ extinguisher_id: parseInt(id), maintenance_count: count }));

    res.json({
      report_type: 'maintenance',
      generated_at: new Date().toISOString(),
      period: { from_date, to_date },
      total_activities: data.length,
      total_cost: totalCost.toFixed(2),
      most_maintained: mostFrequent,
      recent_activities: data.slice(0, 20),
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to generate maintenance report', detail: err.message });
  }
});

/**
 * @swagger
 * /api/reports/dashboard:
 *   get:
 *     tags: [Reports]
 *     summary: Dashboard summary — all key metrics in one call
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const token = fwdToken(req);
    const today = new Date().toISOString().split('T')[0];

    const [summary, overdue, scheduled, expiring] = await Promise.all([
      getExt('/api/extinguishers/stats/summary', token),
      getExt('/api/inspections', token, { status: 'overdue', limit: 5 }),
      getExt('/api/inspections', token, { status: 'scheduled', from_date: today, limit: 5 }),
      getExt('/api/extinguishers', token, { expiring_days: 30, limit: 5 }),
    ]);

    res.json({
      generated_at: new Date().toISOString(),
      inventory: summary,
      overdue_inspections: overdue.pagination?.total || 0,
      upcoming_inspections_today: scheduled.data || [],
      expiring_soon: expiring.data || [],
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to generate dashboard', detail: err.message });
  }
});

/**
 * @swagger
 * /api/reports/export/pdf:
 *   get:
 *     tags: [Reports]
 *     summary: Export report as PDF
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [inventory, inspections, compliance, maintenance] }
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export/pdf', authenticate, async (req, res) => {
  const { type = 'inventory' } = req.query;
  const token = fwdToken(req);

  if (type === 'maintenance' && !['admin', 'inspector'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Maintenance reports require admin or inspector role' });
  }

  try {
    let reportData;
    if (type === 'inventory')    reportData = await getExt('/api/extinguishers/stats/summary', token);
    else if (type === 'compliance') {
      const expired = await getExt('/api/extinguishers', token, { status: 'expired', limit: 1000 });
      reportData = { expired_count: expired.pagination?.total, items: expired.data?.slice(0, 50) };
    } else if (type === 'inspections') {
      const data = await getExt('/api/inspections', token, { limit: 100 });
      reportData = { total: data.pagination?.total, items: data.data };
    } else {
      const data = await getExt('/api/maintenance', token, { limit: 100 });
      reportData = { total: data.pagination?.total, items: data.data };
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fems_${type}_report_${Date.now()}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('TZW LTD', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Fire Extinguisher Management System', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).font('Helvetica-Bold').text(`${type.toUpperCase()} REPORT`, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Content
    if (type === 'inventory' && reportData) {
      doc.fontSize(12).font('Helvetica-Bold').text('Inventory Summary');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica').text(`Total Extinguishers: ${reportData.total}`);
      doc.text(`Expired: ${reportData.expired}`);
      doc.text(`Expiring in 30 days: ${reportData.expiring_in_30_days}`);
      doc.text(`Expiring in 90 days: ${reportData.expiring_in_90_days}`);
      doc.moveDown();
      if (reportData.by_status?.length) {
        doc.font('Helvetica-Bold').text('By Status:');
        doc.font('Helvetica');
        for (const s of reportData.by_status) doc.text(`  ${s.status}: ${s.count}`);
      }
      doc.moveDown();
      if (reportData.by_type?.length) {
        doc.font('Helvetica-Bold').text('By Type:');
        doc.font('Helvetica');
        for (const t of reportData.by_type) doc.text(`  ${t.type}: ${t.count}`);
      }
    } else if (reportData?.items?.length) {
      doc.fontSize(12).font('Helvetica-Bold').text(`Total Records: ${reportData.total}`);
      doc.moveDown(0.5);
      for (const item of reportData.items) {
        doc.fontSize(10).font('Helvetica');
        const line = Object.entries(item)
          .filter(([k]) => !['id','created_at','updated_at','notes'].includes(k))
          .map(([k, v]) => `${k}: ${v || '-'}`)
          .join(' | ');
        doc.text(line, { width: 495 });
      }
    } else {
      doc.text('No data available for this report type.');
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor('gray').text('This report is generated automatically by the TZW LTD FEMS system.', { align: 'center' });
    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF', detail: err.message });
  }
});

/**
 * @swagger
 * /api/reports/export/csv:
 *   get:
 *     tags: [Reports]
 *     summary: Export report as CSV
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [extinguishers, inspections, maintenance] }
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export/csv', authenticate, async (req, res) => {
  const { type = 'extinguishers' } = req.query;
  const token = fwdToken(req);

  if (type === 'maintenance' && !['admin', 'inspector'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Maintenance reports require admin or inspector role' });
  }

  let endpoint, filename;
  if (type === 'extinguishers') {
    endpoint = '/api/extinguishers'; filename = 'extinguishers';
  } else if (type === 'inspections') {
    endpoint = '/api/inspections'; filename = 'inspections';
  } else {
    endpoint = '/api/maintenance'; filename = 'maintenance';
  }

  try {
    const resp = await getExt(endpoint, token, { limit: 5000 });
    const rows = resp.data || [];

    if (!rows.length) return res.status(404).json({ error: 'No data to export' });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="fems_${filename}_${Date.now()}.csv"`);

    const headers = Object.keys(rows[0]);
    stringify(rows, { header: true, columns: headers }, (err, output) => {
      if (err) return res.status(500).json({ error: 'CSV generation failed' });
      res.send(output);
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to generate CSV', detail: err.message });
  }
});

module.exports = router;

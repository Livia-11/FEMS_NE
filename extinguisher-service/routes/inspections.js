const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const { pool } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const NOTIFY_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';

async function notifyInspection(inspection, extinguisher) {
  try {
    await axios.post(`${NOTIFY_URL}/api/notifications/internal`, {
      type: 'inspection_scheduled',
      title: 'Inspection Scheduled',
      message: `Inspection for ${extinguisher.serial_number} at ${extinguisher.location} on ${inspection.scheduled_date}`,
      recipient_id: inspection.inspector_id,
      metadata: { inspection_id: inspection.id, extinguisher_id: extinguisher.id },
    }, { headers: { 'X-Service-Key': process.env.INTERNAL_SERVICE_KEY }, timeout: 3000 });
  } catch (_) { /* non-critical */ }
}

/**
 * @swagger
 * tags:
 *   - name: Inspections
 *     description: Inspection scheduling and results management
 */

/**
 * @swagger
 * /api/inspections:
 *   get:
 *     tags: [Inspections]
 *     summary: List all inspections with filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [scheduled, in_progress, completed, cancelled, overdue] }
 *       - in: query
 *         name: extinguisher_id
 *         schema: { type: integer }
 *       - in: query
 *         name: inspector_id
 *         schema: { type: integer }
 *       - in: query
 *         name: from_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated inspection list }
 */
router.get('/', authenticate, async (req, res) => {
  const { status, extinguisher_id, inspector_id, from_date, to_date, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (status)          { conditions.push(`i.status = $${idx++}`);           params.push(status); }
  if (extinguisher_id) { conditions.push(`i.extinguisher_id = $${idx++}`);  params.push(extinguisher_id); }
  if (inspector_id)    { conditions.push(`i.inspector_id = $${idx++}`);     params.push(inspector_id); }
  if (from_date)       { conditions.push(`i.scheduled_date >= $${idx++}`);  params.push(from_date); }
  if (to_date)         { conditions.push(`i.scheduled_date <= $${idx++}`);  params.push(to_date); }

  if (req.user.role === 'inspector') {
    conditions.push(`i.inspector_id = $${idx++}`);
    params.push(req.user.id);
  } else if (req.user.role === 'user') {
    conditions.push(`i.created_by = $${idx++}`);
    params.push(req.user.id);
  }

  const wc    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = parseInt((await pool.query(`SELECT COUNT(*) FROM inspections i ${wc}`, params)).rows[0].count);

  params.push(parseInt(limit), offset);
  const data  = await pool.query(`
    SELECT i.*, e.serial_number, e.location, e.type, e.size
    FROM inspections i
    LEFT JOIN extinguishers e ON e.id = i.extinguisher_id
    ${wc} ORDER BY i.scheduled_date DESC LIMIT $${idx++} OFFSET $${idx++}
  `, params);

  res.json({ data: data.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
});

/**
 * @swagger
 * /api/inspections/{id}:
 *   get:
 *     tags: [Inspections]
 *     summary: Get inspection by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Inspection details }
 */
router.get('/:id', authenticate, async (req, res) => {
  const result = await pool.query(`
    SELECT i.*, e.serial_number, e.location, e.type, e.size, e.building, e.floor
    FROM inspections i
    LEFT JOIN extinguishers e ON e.id = i.extinguisher_id
    WHERE i.id = $1
  `, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Inspection not found' });
  const inspection = result.rows[0];
  if (req.user.role === 'inspector' && inspection.inspector_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (req.user.role === 'user' && inspection.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json({ data: result.rows[0] });
});

/**
 * @swagger
 * /api/inspections:
 *   post:
 *     tags: [Inspections]
 *     summary: Schedule a new inspection
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [extinguisher_id, scheduled_date]
 *             properties:
 *               extinguisher_id:  { type: integer }
 *               inspector_id:     { type: integer }
 *               inspector_name:   { type: string }
 *               scheduled_date:   { type: string, format: date }
 *               scheduled_time:   { type: string, example: "09:00" }
 *               notes:            { type: string }
 *     responses:
 *       201: { description: Inspection scheduled }
 */
router.post('/', authenticate, authorize('admin', 'user'),
  [
    body('extinguisher_id').isInt({ min: 1 }),
    body('scheduled_date').isDate(),
    body('scheduled_time').optional().matches(/^\d{2}:\d{2}$/),
    body('inspector_id').optional().isInt({ min: 1 }),
    body('inspector_name').optional().trim(),
    body('notes').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { extinguisher_id, scheduled_date, scheduled_time, inspector_id, inspector_name, notes } = req.body;
    try {
      const ext = await pool.query('SELECT * FROM extinguishers WHERE id=$1', [extinguisher_id]);
      if (!ext.rows.length) return res.status(404).json({ error: 'Extinguisher not found' });

      const assignedInspectorId = req.user.role === 'admin' ? inspector_id : null;
      const assignedInspectorName = req.user.role === 'admin' ? inspector_name : null;

      const result = await pool.query(`
        INSERT INTO inspections
          (extinguisher_id,inspector_id,inspector_name,scheduled_date,scheduled_time,notes,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
      `, [extinguisher_id, assignedInspectorId||null, assignedInspectorName||null,
          scheduled_date, scheduled_time||null, notes||null, req.user.id]);

      await pool.query('UPDATE extinguishers SET next_inspection=$1,updated_at=NOW() WHERE id=$2',
        [scheduled_date, extinguisher_id]);

      await notifyInspection(result.rows[0], ext.rows[0]);
      res.status(201).json({ message: 'Inspection scheduled', data: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to schedule inspection' });
    }
  }
);

/**
 * @swagger
 * /api/inspections/{id}:
 *   put:
 *     tags: [Inspections]
 *     summary: Update inspection (reschedule or record results)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduled_date:   { type: string, format: date }
 *               actual_date:      { type: string, format: date }
 *               inspector_id:     { type: integer }
 *               inspector_name:   { type: string }
 *               status:           { type: string, enum: [scheduled, in_progress, completed, cancelled, overdue] }
 *               result:           { type: string, enum: [pass, fail, needs_maintenance] }
 *               pressure_ok:      { type: boolean }
 *               seal_intact:      { type: boolean }
 *               label_readable:   { type: boolean }
 *               pin_in_place:     { type: boolean }
 *               notes:            { type: string }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticate, authorize('admin', 'inspector'),
  [
    body('scheduled_date').optional().isDate(),
    body('actual_date').optional().isDate(),
    body('status').optional().isIn(['scheduled','in_progress','completed','cancelled','overdue']),
    body('result').optional().isIn(['pass','fail','needs_maintenance']),
    body('pressure_ok').optional().isBoolean(),
    body('seal_intact').optional().isBoolean(),
    body('label_readable').optional().isBoolean(),
    body('pin_in_place').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const existing = await pool.query('SELECT * FROM inspections WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Inspection not found' });
    const ins = existing.rows[0];

    if (req.user.role === 'inspector' && ins.inspector_id !== req.user.id) {
      return res.status(403).json({ error: 'Inspectors can only update inspections assigned to them' });
    }

    if (req.user.role === 'inspector') {
      delete req.body.scheduled_date;
      delete req.body.scheduled_time;
      delete req.body.inspector_id;
      delete req.body.inspector_name;
    }

    const fields = ['scheduled_date','scheduled_time','actual_date','inspector_id','inspector_name',
                    'status','result','pressure_ok','seal_intact','label_readable','pin_in_place','notes'];
    const vals   = fields.map(f => req.body[f] !== undefined ? req.body[f] : ins[f]);

    const result = await pool.query(`
      UPDATE inspections SET
        scheduled_date=$1,scheduled_time=$2,actual_date=$3,inspector_id=$4,inspector_name=$5,
        status=$6,result=$7,pressure_ok=$8,seal_intact=$9,label_readable=$10,pin_in_place=$11,notes=$12,
        updated_at=NOW()
      WHERE id=$13 RETURNING *
    `, [...vals, ins.id]);

    if (vals[5] === 'completed') {
      await pool.query('UPDATE extinguishers SET last_inspected=$1,updated_at=NOW() WHERE id=$2',
        [vals[2] || vals[0], ins.extinguisher_id]);
    }

    res.json({ message: 'Inspection updated', data: result.rows[0] });
  }
);

/**
 * @swagger
 * /api/inspections/{id}:
 *   delete:
 *     tags: [Inspections]
 *     summary: Delete an inspection (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const r = await pool.query('DELETE FROM inspections WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Inspection not found' });
  res.json({ message: 'Inspection deleted' });
});

/**
 * @swagger
 * /api/inspections/overdue/mark:
 *   post:
 *     tags: [Inspections]
 *     summary: Mark past-scheduled inspections as overdue (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Overdue count }
 */
router.post('/overdue/mark', authenticate, authorize('admin'), async (req, res) => {
  const r = await pool.query(
    "UPDATE inspections SET status='overdue',updated_at=NOW() WHERE status='scheduled' AND scheduled_date < CURRENT_DATE"
  );
  res.json({ message: `${r.rowCount} inspections marked as overdue` });
});

module.exports = router;

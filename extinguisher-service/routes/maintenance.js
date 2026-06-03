const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Maintenance
 *     description: Maintenance activity logging and history
 */

/**
 * @swagger
 * /api/maintenance:
 *   get:
 *     tags: [Maintenance]
 *     summary: List maintenance logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       200: { description: Paginated maintenance logs }
 */
router.get('/', authenticate, authorize('admin', 'inspector'), async (req, res) => {
  const { extinguisher_id, inspector_id, from_date, to_date, serial_number, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (extinguisher_id) { conditions.push(`m.extinguisher_id = $${idx++}`);       params.push(extinguisher_id); }
  if (inspector_id)    { conditions.push(`m.inspector_id = $${idx++}`);           params.push(inspector_id); }
  if (from_date)       { conditions.push(`m.date_of_maintenance >= $${idx++}`);  params.push(from_date); }
  if (to_date)         { conditions.push(`m.date_of_maintenance <= $${idx++}`);  params.push(to_date); }
  if (serial_number)   { conditions.push(`e.serial_number ILIKE $${idx++}`);     params.push(`%${serial_number}%`); }

  if (req.user.role === 'inspector') {
    conditions.push(`m.inspector_id = $${idx++}`);
    params.push(req.user.id);
  }

  const wc    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = parseInt((await pool.query(`
    SELECT COUNT(*)
    FROM maintenance_logs m
    LEFT JOIN extinguishers e ON e.id = m.extinguisher_id
    ${wc}
  `, params)).rows[0].count);

  params.push(parseInt(limit), offset);
  const data  = await pool.query(`
    SELECT m.*, e.serial_number, e.location, e.type
    FROM maintenance_logs m
    LEFT JOIN extinguishers e ON e.id = m.extinguisher_id
    ${wc} ORDER BY m.date_of_maintenance DESC LIMIT $${idx++} OFFSET $${idx++}
  `, params);

  res.json({ data: data.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
});

/**
 * @swagger
 * /api/maintenance/{id}:
 *   get:
 *     tags: [Maintenance]
 *     summary: Get maintenance log by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Log details }
 */
router.get('/:id', authenticate, authorize('admin', 'inspector'), async (req, res) => {
  const result = await pool.query(`
    SELECT m.*, e.serial_number, e.location, e.type, e.size
    FROM maintenance_logs m
    LEFT JOIN extinguishers e ON e.id = m.extinguisher_id
    WHERE m.id = $1
  `, [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Maintenance log not found' });
  if (req.user.role === 'inspector' && result.rows[0].inspector_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json({ data: result.rows[0] });
});

/**
 * @swagger
 * /api/maintenance:
 *   post:
 *     tags: [Maintenance]
 *     summary: Log a maintenance activity
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [extinguisher_id, action_taken, date_of_maintenance]
 *             properties:
 *               extinguisher_id:     { type: integer }
 *               inspector_id:        { type: integer }
 *               inspector_name:      { type: string }
 *               action_taken:        { type: string, example: "Replaced valve and recharged" }
 *               date_of_maintenance: { type: string, format: date }
 *               issues_identified:   { type: string }
 *               parts_replaced:      { type: string }
 *               cost:                { type: number, example: 45.50 }
 *               next_service_date:   { type: string, format: date }
 *               notes:               { type: string }
 *     responses:
 *       201: { description: Logged }
 */
router.post('/', authenticate, authorize('admin', 'inspector'),
  [
    body('extinguisher_id').isInt({ min: 1 }),
    body('action_taken').trim().notEmpty(),
    body('date_of_maintenance').isDate(),
    body('inspector_id').optional().isInt({ min: 1 }),
    body('inspector_name').optional().trim(),
    body('issues_identified').optional().trim(),
    body('parts_replaced').optional().trim(),
    body('cost').optional().isFloat({ min: 0 }),
    body('next_service_date').optional().isDate(),
    body('notes').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { extinguisher_id, action_taken, date_of_maintenance, inspector_id, inspector_name,
            issues_identified, parts_replaced, cost, next_service_date, notes } = req.body;

    try {
      const ext = await pool.query('SELECT * FROM extinguishers WHERE id=$1', [extinguisher_id]);
      if (!ext.rows.length) return res.status(404).json({ error: 'Extinguisher not found' });

      const result = await pool.query(`
        INSERT INTO maintenance_logs
          (extinguisher_id,inspector_id,inspector_name,action_taken,date_of_maintenance,
           issues_identified,parts_replaced,cost,next_service_date,notes,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `, [extinguisher_id, inspector_id||req.user.id, inspector_name||null, action_taken,
          date_of_maintenance, issues_identified||null, parts_replaced||null,
          cost!==undefined?cost:null, next_service_date||null, notes||null, req.user.id]);

      if (ext.rows[0].status === 'maintenance') {
        await pool.query("UPDATE extinguishers SET status='active',updated_at=NOW() WHERE id=$1", [extinguisher_id]);
      }

      res.status(201).json({ message: 'Maintenance logged', data: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to log maintenance' });
    }
  }
);

/**
 * @swagger
 * /api/maintenance/{id}:
 *   put:
 *     tags: [Maintenance]
 *     summary: Update a maintenance log
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
 *               action_taken:        { type: string }
 *               date_of_maintenance: { type: string, format: date }
 *               issues_identified:   { type: string }
 *               parts_replaced:      { type: string }
 *               cost:                { type: number }
 *               next_service_date:   { type: string, format: date }
 *               notes:               { type: string }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticate, authorize('admin', 'inspector'),
  [
    body('action_taken').optional().trim().notEmpty(),
    body('date_of_maintenance').optional().isDate(),
    body('cost').optional().isFloat({ min: 0 }),
    body('next_service_date').optional().isDate(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const existing = await pool.query('SELECT * FROM maintenance_logs WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Maintenance log not found' });
    const m = existing.rows[0];

    if (req.user.role === 'inspector' && m.inspector_id !== req.user.id) {
      return res.status(403).json({ error: 'Inspectors can only update maintenance logs assigned to them' });
    }

    const fields = ['action_taken','date_of_maintenance','issues_identified','parts_replaced',
                    'cost','next_service_date','notes'];
    const vals   = fields.map(f => req.body[f] !== undefined ? req.body[f] : m[f]);

    const result = await pool.query(`
      UPDATE maintenance_logs SET
        action_taken=$1,date_of_maintenance=$2,issues_identified=$3,parts_replaced=$4,
        cost=$5,next_service_date=$6,notes=$7,updated_at=NOW()
      WHERE id=$8 RETURNING *
    `, [...vals, m.id]);

    res.json({ message: 'Maintenance log updated', data: result.rows[0] });
  }
);

/**
 * @swagger
 * /api/maintenance/{id}:
 *   delete:
 *     tags: [Maintenance]
 *     summary: Delete a maintenance log (admin only)
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
  const r = await pool.query('DELETE FROM maintenance_logs WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Maintenance log not found' });
  res.json({ message: 'Maintenance log deleted' });
});

module.exports = router;

const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const VALID_TYPES    = ['Water','CO2','Foam','Dry Chemical','Wet Chemical','Clean Agent'];
const VALID_SIZES    = ['1.5 lb','2 lb','2.5 lb','5 lb','6 lb','9 lb','10 lb','12 lb','20 lb'];
const VALID_STATUSES = ['active','inactive','expired','maintenance','decommissioned'];

/**
 * @swagger
 * tags:
 *   - name: Extinguishers
 *     description: Fire extinguisher inventory management
 */

/**
 * @swagger
 * /api/extinguishers:
 *   get:
 *     tags: [Extinguishers]
 *     summary: List all fire extinguishers with filtering and pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive, expired, maintenance, decommissioned] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: location
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: expiring_days
 *         schema: { type: integer, description: "Expiring within N days" }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated extinguisher list }
 */
router.get('/', authenticate, async (req, res) => {
  const { status, type, location, search, expiring_days, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (status)        { conditions.push(`status = $${idx++}`);                                          params.push(status); }
  if (type)          { conditions.push(`type = $${idx++}`);                                            params.push(type); }
  if (location)      { conditions.push(`location ILIKE $${idx++}`);                                   params.push(`%${location}%`); }
  if (search)        { conditions.push(`(serial_number ILIKE $${idx} OR location ILIKE $${idx} OR building ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
  if (expiring_days) { conditions.push(`expiry_date <= CURRENT_DATE + ($${idx++} || ' days')::INTERVAL`); params.push(expiring_days); }

  const wc    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = parseInt((await pool.query(`SELECT COUNT(*) FROM extinguishers ${wc}`, params)).rows[0].count);

  params.push(parseInt(limit), offset);
  const data  = await pool.query(
    `SELECT * FROM extinguishers ${wc} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  res.json({
    data: data.rows,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
});

/**
 * @swagger
 * /api/extinguishers/stats/summary:
 *   get:
 *     tags: [Extinguishers]
 *     summary: Inventory summary statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Summary stats }
 */
router.get('/stats/summary', authenticate, async (req, res) => {
  const [total, byStatus, byType, expired, exp30, exp90] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM extinguishers'),
    pool.query('SELECT status, COUNT(*) as count FROM extinguishers GROUP BY status'),
    pool.query('SELECT type, COUNT(*) as count FROM extinguishers GROUP BY type'),
    pool.query("SELECT COUNT(*) FROM extinguishers WHERE expiry_date < CURRENT_DATE"),
    pool.query("SELECT COUNT(*) FROM extinguishers WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'"),
    pool.query("SELECT COUNT(*) FROM extinguishers WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'"),
  ]);

  res.json({
    total:                parseInt(total.rows[0].count),
    by_status:            byStatus.rows,
    by_type:              byType.rows,
    expired:              parseInt(expired.rows[0].count),
    expiring_in_30_days:  parseInt(exp30.rows[0].count),
    expiring_in_90_days:  parseInt(exp90.rows[0].count),
  });
});

/**
 * @swagger
 * /api/extinguishers/{id}:
 *   get:
 *     tags: [Extinguishers]
 *     summary: Get extinguisher details by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Extinguisher with recent inspections and maintenance }
 *       404: { description: Not found }
 */
router.get('/:id', authenticate, async (req, res) => {
  const ext = await pool.query('SELECT * FROM extinguishers WHERE id=$1', [req.params.id]);
  if (!ext.rows.length) return res.status(404).json({ error: 'Extinguisher not found' });

  const [inspections, maintenance] = await Promise.all([
    pool.query('SELECT * FROM inspections WHERE extinguisher_id=$1 ORDER BY scheduled_date DESC LIMIT 10', [ext.rows[0].id]),
    pool.query('SELECT * FROM maintenance_logs WHERE extinguisher_id=$1 ORDER BY date_of_maintenance DESC LIMIT 10', [ext.rows[0].id]),
  ]);

  res.json({ data: ext.rows[0], recent_inspections: inspections.rows, recent_maintenance: maintenance.rows });
});

/**
 * @swagger
 * /api/extinguishers:
 *   post:
 *     tags: [Extinguishers]
 *     summary: Register a new fire extinguisher
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serial_number, location, type, size, installation_date, expiry_date]
 *             properties:
 *               serial_number:     { type: string, example: "FE-2024-001" }
 *               location:          { type: string, example: "Building A - Lobby" }
 *               building:          { type: string }
 *               floor:             { type: string }
 *               type:              { type: string, enum: [Water, CO2, Foam, "Dry Chemical", "Wet Chemical", "Clean Agent"] }
 *               size:              { type: string, enum: ["1.5 lb","2 lb","2.5 lb","5 lb","6 lb","9 lb","10 lb","12 lb","20 lb"] }
 *               installation_date: { type: string, format: date }
 *               expiry_date:       { type: string, format: date }
 *               next_inspection:   { type: string, format: date }
 *               status:            { type: string, enum: [active, inactive, expired, maintenance, decommissioned] }
 *               notes:             { type: string }
 *     responses:
 *       201: { description: Registered }
 *       409: { description: Serial number exists }
 */
router.post('/', authenticate, authorize('admin', 'inspector'),
  [
    body('serial_number').trim().notEmpty(),
    body('location').trim().notEmpty(),
    body('building').optional().trim(),
    body('floor').optional().trim(),
    body('type').isIn(VALID_TYPES),
    body('size').isIn(VALID_SIZES),
    body('installation_date').isDate(),
    body('expiry_date').isDate(),
    body('next_inspection').optional().isDate(),
    body('status').optional().isIn(VALID_STATUSES),
    body('notes').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { serial_number, location, building, floor, type, size,
            installation_date, expiry_date, next_inspection, status = 'active', notes } = req.body;

    try {
      const existing = await pool.query('SELECT id FROM extinguishers WHERE serial_number=$1', [serial_number]);
      if (existing.rows.length) return res.status(409).json({ error: 'Serial number already registered' });

      const result = await pool.query(`
        INSERT INTO extinguishers
          (serial_number,location,building,floor,type,size,installation_date,expiry_date,next_inspection,status,notes,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `, [serial_number, location, building||null, floor||null, type, size,
          installation_date, expiry_date, next_inspection||null, status, notes||null, req.user.id]);

      res.status(201).json({ message: 'Fire extinguisher registered', data: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to register extinguisher' });
    }
  }
);

/**
 * @swagger
 * /api/extinguishers/{id}:
 *   put:
 *     tags: [Extinguishers]
 *     summary: Update extinguisher information
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
 *               location:         { type: string }
 *               building:         { type: string }
 *               floor:            { type: string }
 *               type:             { type: string }
 *               size:             { type: string }
 *               expiry_date:      { type: string, format: date }
 *               next_inspection:  { type: string, format: date }
 *               status:           { type: string }
 *               notes:            { type: string }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticate, authorize('admin', 'inspector'),
  [
    body('location').optional().trim().notEmpty(),
    body('type').optional().isIn(VALID_TYPES),
    body('size').optional().isIn(VALID_SIZES),
    body('installation_date').optional().isDate(),
    body('expiry_date').optional().isDate(),
    body('next_inspection').optional().isDate(),
    body('status').optional().isIn(VALID_STATUSES),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const existing = await pool.query('SELECT * FROM extinguishers WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Extinguisher not found' });
    const e = existing.rows[0];

    const fields = ['location','building','floor','type','size','installation_date',
                    'expiry_date','next_inspection','status','notes'];
    const vals   = fields.map(f => req.body[f] !== undefined ? req.body[f] : e[f]);

    const result = await pool.query(`
      UPDATE extinguishers SET
        location=$1,building=$2,floor=$3,type=$4,size=$5,
        installation_date=$6,expiry_date=$7,next_inspection=$8,status=$9,notes=$10,
        updated_at=NOW()
      WHERE id=$11 RETURNING *
    `, [...vals, e.id]);

    res.json({ message: 'Extinguisher updated', data: result.rows[0] });
  }
);

/**
 * @swagger
 * /api/extinguishers/{id}:
 *   delete:
 *     tags: [Extinguishers]
 *     summary: Delete an extinguisher (admin only)
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
  const r = await pool.query('DELETE FROM extinguishers WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Extinguisher not found' });
  res.json({ message: 'Extinguisher deleted' });
});

module.exports = router;

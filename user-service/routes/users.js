const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { body, validationResult } = require('express-validator');
const { pool } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { sendMail } = require('../email');

const router = express.Router();

function sanitize(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

function generateTemporaryPassword() {
  return `FEMS-${crypto.randomBytes(4).toString('hex')}-A1`;
}

async function sendAccountInvite({ email, firstName, role, temporaryPassword }) {
  const loginUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
  const subject = 'TZW LTD FEMS — Account Invitation';
  const text = `Hello ${firstName},

You have been invited to the TZW LTD Fire Extinguisher Management System as a ${role}.

Login URL: ${loginUrl}
Username: ${email}
Temporary password: ${temporaryPassword}

After signing in, you can change this password from your profile.

TZW LTD Fire Safety Team`;

  await sendMail({ to: email, subject, text });
}

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: >
 *       Admin manages all users. Admin is the only one who can create Inspector and Admin accounts.
 *       Regular users self-register via POST /api/auth/register.
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users — Admin only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [admin, inspector, user] }
 *       - in: query
 *         name: search
 *         schema: { type: string, description: "Search by name or email" }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated user list }
 *       403: { description: Admin access required }
 */
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  const { role, search, is_active, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (role)      { conditions.push(`role = $${idx++}`);        params.push(role); }
  if (is_active !== undefined) {
    conditions.push(`is_active = $${idx++}`);
    params.push(is_active === 'true');
  }
  if (search) {
    conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const wc    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = parseInt((await pool.query(`SELECT COUNT(*) FROM users ${wc}`, params)).rows[0].count);

  params.push(parseInt(limit), offset);
  const data  = await pool.query(
    `SELECT * FROM users ${wc} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  res.json({
    data: data.rows.map(sanitize),
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
  });
});

/**
 * @swagger
 * /api/users/inspectors/list:
 *   get:
 *     tags: [Users]
 *     summary: List all active inspectors (for inspection scheduling dropdowns)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Inspector list }
 */
router.get('/inspectors/list', authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT id,first_name,last_name,email,department
     FROM users WHERE role='inspector' AND is_active=TRUE ORDER BY first_name`
  );
  res.json({ data: result.rows });
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID — Admin sees any user, others see only themselves
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: User details }
 *       403: { description: Access denied }
 *       404: { description: Not found }
 */
router.get('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ user: sanitize(result.rows[0]) });
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: >
 *       Admin invites an Inspector or Admin account. A temporary password is generated
 *       and emailed to the invited user. Regular users self-register via POST /api/auth/register.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, email, role]
 *             properties:
 *               first_name:  { type: string, example: "Alice" }
 *               last_name:   { type: string, example: "Inspector" }
 *               email:       { type: string, format: email, example: "alice@tzwltd.com" }
 *               role:        { type: string, enum: [admin, inspector], description: "admin or inspector only — for regular users use /api/auth/register" }
 *               phone:       { type: string }
 *               department:  { type: string }
 *     responses:
 *       201: { description: User invited and temporary credentials emailed }
 *       409: { description: Email already registered }
 *       422: { description: Validation errors }
 */
router.post('/', authenticate, authorize('admin'),
  [
    body('first_name').trim().notEmpty().withMessage('First name required'),
    body('last_name').trim().notEmpty().withMessage('Last name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('role')
      .isIn(['admin', 'inspector'])
      .withMessage('Admin can only create admin or inspector accounts here. Users self-register.'),
    body('phone').optional().trim(),
    body('department').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { first_name, last_name, email, role, phone, department } = req.body;

    try {
      const existing = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

      const temporaryPassword = generateTemporaryPassword();
      const hash   = await bcrypt.hash(temporaryPassword, 10);
      // Invited accounts are active and verified because the invitation is sent to the account email.
      const result = await pool.query(
        `INSERT INTO users (first_name,last_name,email,password_hash,role,is_active,email_verified,phone,department)
         VALUES ($1,$2,$3,$4,$5,TRUE,TRUE,$6,$7) RETURNING *`,
        [first_name, last_name, email, hash, role, phone || null, department || null]
      );

      try {
        await sendAccountInvite({ email, firstName: first_name, role, temporaryPassword });
      } catch (emailErr) {
        await pool.query('DELETE FROM users WHERE id=$1', [result.rows[0].id]);
        console.error('[user-service] Invite email error:', emailErr.message);
        return res.status(503).json({
          error: 'Could not send invitation email. Please configure SMTP settings and try again.',
        });
      }

      res.status(201).json({
        message: `${role.charAt(0).toUpperCase() + role.slice(1)} invitation sent successfully.`,
        user: sanitize(result.rows[0]),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update user profile — Admin updates anyone, others update themselves (limited fields)
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
 *               first_name:  { type: string }
 *               last_name:   { type: string }
 *               phone:       { type: string }
 *               department:  { type: string }
 *               role:        { type: string, enum: [admin, inspector, user], description: "Admin only" }
 *               is_active:   { type: boolean, description: "Admin only" }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/:id', authenticate,
  [
    body('first_name').optional().trim().notEmpty(),
    body('last_name').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    body('department').optional().trim(),
    body('role').optional().isIn(['admin', 'inspector', 'user']),
    body('is_active').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { id } = req.params;
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      const existing = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
      if (!existing.rows.length) return res.status(404).json({ error: 'User not found' });
      const u = existing.rows[0];

      const fn     = req.body.first_name  ?? u.first_name;
      const ln     = req.body.last_name   ?? u.last_name;
      const ph     = req.body.phone       ?? u.phone;
      const dept   = req.body.department  ?? u.department;
      const role   = (req.body.role      !== undefined && req.user.role === 'admin') ? req.body.role      : u.role;
      const active = (req.body.is_active  !== undefined && req.user.role === 'admin') ? req.body.is_active : u.is_active;

      const result = await pool.query(
        `UPDATE users SET first_name=$1,last_name=$2,phone=$3,department=$4,role=$5,is_active=$6,updated_at=NOW()
         WHERE id=$7 RETURNING *`,
        [fn, ln, ph, dept, role, active, id]
      );
      res.json({ message: 'User updated', user: sanitize(result.rows[0]) });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user — Admin only, cannot delete own account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 *       403: { description: Cannot delete own account }
 */
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  if (req.user.id === parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Cannot delete your own account' });
  }
  const r = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deleted successfully' });
});

/**
 * @swagger
 * /api/users/{id}/deactivate:
 *   patch:
 *     tags: [Users]
 *     summary: Deactivate a user account — Admin only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deactivated }
 */
router.patch('/:id/deactivate', authenticate, authorize('admin'), async (req, res) => {
  if (req.user.id === parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Cannot deactivate your own account' });
  }
  const r = await pool.query(
    'UPDATE users SET is_active=FALSE,updated_at=NOW() WHERE id=$1 RETURNING id',
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deactivated' });
});

/**
 * @swagger
 * /api/users/{id}/activate:
 *   patch:
 *     tags: [Users]
 *     summary: Activate a user account — Admin only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Activated }
 */
router.patch('/:id/activate', authenticate, authorize('admin'), async (req, res) => {
  const r = await pool.query(
    'UPDATE users SET is_active=TRUE,updated_at=NOW() WHERE id=$1 RETURNING id',
    [req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User activated' });
});

/**
 * @swagger
 * /api/users/me/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update own profile (any authenticated user)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name: { type: string }
 *               last_name:  { type: string }
 *               phone:      { type: string }
 *               department: { type: string }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put('/me/profile', authenticate,
  [
    body('first_name').optional().trim().notEmpty(),
    body('last_name').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    body('department').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const u = (await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
    const result = await pool.query(
      `UPDATE users SET first_name=$1,last_name=$2,phone=$3,department=$4,updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [
        req.body.first_name ?? u.first_name,
        req.body.last_name  ?? u.last_name,
        req.body.phone      ?? u.phone,
        req.body.department ?? u.department,
        req.user.id,
      ]
    );
    res.json({ message: 'Profile updated', user: sanitize(result.rows[0]) });
  }
);

module.exports = router;

require('dotenv').config({ path: '../../.env' });
const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { pool } = require('../database');

const router = express.Router();
const JWT_SECRET          = process.env.JWT_SECRET          || 'fallback_secret';
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function internalAuth(req, res, next) {
  const key = req.headers['x-service-key'];
  if (!INTERNAL_SERVICE_KEY || key === INTERNAL_SERVICE_KEY) return next();
  return res.status(403).json({ error: 'Internal service key required' });
}

let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_USER !== 'your_email@gmail.com') {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  console.log('[notification-service] Email transporter configured');
} else {
  console.log('[notification-service] Email not configured — notifications stored only');
}

async function sendEmail(to, subject, text) {
  if (!transporter || !to) return false;
  try {
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'TZW LTD'}" <${process.env.FROM_EMAIL}>`,
      to, subject, text,
    });
    return true;
  } catch (err) {
    console.error('[notification-service] Email error:', err.message);
    return false;
  }
}

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: In-app and email notification management
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notifications for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unread_only
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Notifications }
 */
router.get('/', authenticate, async (req, res) => {
  const { unread_only, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [`recipient_id = $1`];
  const params     = [req.user.id];
  let   idx        = 2;

  if (unread_only === 'true') { conditions.push(`is_read = FALSE`); }

  const wc    = `WHERE ${conditions.join(' AND ')}`;
  const total = parseInt((await pool.query(`SELECT COUNT(*) FROM notifications ${wc}`, params)).rows[0].count);

  params.push(parseInt(limit), offset);
  const data  = await pool.query(
    `SELECT * FROM notifications ${wc} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  res.json({ data: data.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
});

/**
 * @swagger
 * /api/notifications/all:
 *   get:
 *     tags: [Notifications]
 *     summary: Get all notifications (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: All notifications }
 */
router.get('/all', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total  = parseInt((await pool.query('SELECT COUNT(*) FROM notifications')).rows[0].count);
  const data   = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT $1 OFFSET $2', [parseInt(limit), offset]);
  res.json({ data: data.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
});

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notification count for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Unread count }
 */
router.get('/unread-count', authenticate, async (req, res) => {
  const result = await pool.query('SELECT COUNT(*) FROM notifications WHERE recipient_id=$1 AND is_read=FALSE', [req.user.id]);
  res.json({ unread_count: parseInt(result.rows[0].count) });
});

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read for current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: All marked as read }
 */
router.patch('/read-all', authenticate, async (req, res) => {
  const r = await pool.query('UPDATE notifications SET is_read=TRUE,read_at=NOW() WHERE recipient_id=$1 AND is_read=FALSE', [req.user.id]);
  res.json({ message: `${r.rowCount} notifications marked as read` });
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Marked as read }
 */
router.patch('/:id/read', authenticate, async (req, res) => {
  const notif = await pool.query('SELECT * FROM notifications WHERE id=$1', [req.params.id]);
  if (!notif.rows.length) return res.status(404).json({ error: 'Notification not found' });
  if (notif.rows[0].recipient_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  await pool.query('UPDATE notifications SET is_read=TRUE,read_at=NOW() WHERE id=$1', [req.params.id]);
  res.json({ message: 'Marked as read' });
});

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     tags: [Notifications]
 *     summary: Send a notification (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               recipient_id: { type: integer }
 *               type:         { type: string, default: "general" }
 *               title:        { type: string }
 *               message:      { type: string }
 *               email_to:     { type: string, format: email }
 *     responses:
 *       201: { description: Sent }
 */
router.post('/send', authenticate,
  [
    body('title').trim().notEmpty(),
    body('message').trim().notEmpty(),
    body('recipient_id').optional().isInt({ min: 1 }),
    body('type').optional().trim(),
    body('email_to').optional().isEmail(),
  ],
  async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { recipient_id, type = 'general', title, message, email_to } = req.body;
    const result = await pool.query(
      'INSERT INTO notifications (recipient_id,type,title,message) VALUES ($1,$2,$3,$4) RETURNING id',
      [recipient_id||null, type, title, message]
    );

    let emailSent = false;
    if (email_to) emailSent = await sendEmail(email_to, title, message);
    if (emailSent) await pool.query('UPDATE notifications SET email_sent=TRUE WHERE id=$1', [result.rows[0].id]);

    res.status(201).json({ message: 'Notification sent', id: result.rows[0].id, email_sent: emailSent });
  }
);

// Internal service-to-service endpoint (uses X-Service-Key, no JWT)
router.post('/internal', internalAuth,
  [
    body('title').trim().notEmpty(),
    body('message').trim().notEmpty(),
    body('type').optional().trim(),
    body('recipient_id').optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { recipient_id, type = 'system', title, message, metadata } = req.body;
    const result = await pool.query(
      'INSERT INTO notifications (recipient_id,type,title,message,metadata) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [recipient_id||null, type, title, message, metadata ? JSON.stringify(metadata) : null]
    );
    res.status(201).json({ id: result.rows[0].id });
  }
);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
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
router.delete('/:id', authenticate, async (req, res) => {
  const notif = await pool.query('SELECT * FROM notifications WHERE id=$1', [req.params.id]);
  if (!notif.rows.length) return res.status(404).json({ error: 'Notification not found' });
  if (notif.rows[0].recipient_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  await pool.query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
  res.json({ message: 'Notification deleted' });
});

module.exports = router;

require('dotenv').config({ path: '../../.env' });
const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const { body, validationResult } = require('express-validator');
const { pool }  = require('../database');
const { authenticate } = require('../middleware/auth');
const { sendMail } = require('../email');

const router         = express.Router();
const JWT_SECRET     = process.env.JWT_SECRET     || 'fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const OTP_MINUTES    = parseInt(process.env.OTP_EXPIRES_MINUTES || '10');

async function sendOTPEmail(email, firstName, otp) {
  const subject = 'TZW LTD FEMS — Your Email Verification Code';
  const text    = `Hello ${firstName},\n\nYour verification code is: ${otp}\n\nThis code expires in ${OTP_MINUTES} minutes.\n\nIf you did not register, ignore this email.\n\nTZW LTD Fire Safety Team`;

  await sendMail({ to: email, subject, text });
  console.log(`[user-service] OTP email sent to ${email}`);
  return true;
}

async function sendPasswordResetEmail(email, firstName, token) {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
  const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
  const subject = 'TZW LTD FEMS — Password Reset Request';
  const text = `Hello ${firstName},

We received a request to reset your FEMS password.

Reset your password here:
${resetUrl}

This link expires in 1 hour. If you did not request a password reset, ignore this email.

TZW LTD Fire Safety Team`;

  await sendMail({ to: email, subject, text });
  console.log(`[user-service] Password reset email sent to ${email}`);
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.first_name, lastName: user.last_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function sanitize(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: Self-registration (users only), OTP email verification, and login
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Self-register a new USER account (role fixed as "user")
 *     description: >
 *       Registers a new account with the role "user". Account is inactive until the
 *       OTP sent to the provided email is verified via /api/auth/verify-email.
 *       To create Inspector or Admin accounts, an Admin must use POST /api/users.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, email, password]
 *             properties:
 *               first_name:  { type: string, example: "Jane" }
 *               last_name:   { type: string, example: "Smith" }
 *               email:       { type: string, format: email, example: "jane.smith@company.com" }
 *               password:    { type: string, minLength: 8, example: "Secure@123" }
 *               phone:       { type: string }
 *               department:  { type: string }
 *     responses:
 *       201:
 *         description: Registered. OTP sent to email — verify to activate account.
 *       409:
 *         description: Email already registered
 *       422:
 *         description: Validation errors
 */
router.post('/register',
  [
    body('first_name').trim().notEmpty().withMessage('First name required').isLength({ max: 100 }),
    body('last_name').trim().notEmpty().withMessage('Last name required').isLength({ max: 100 }),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Minimum 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
      .matches(/[a-z]/).withMessage('Must contain a lowercase letter')
      .matches(/\d/).withMessage('Must contain a number'),
    body('phone').optional().trim(),
    body('department').optional().trim().isLength({ max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { first_name, last_name, email, password, phone, department } = req.body;

    try {
      const existing = await pool.query('SELECT id,email_verified FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      if (existing.rows.length) {
        if (!existing.rows[0].email_verified) {
          return res.status(409).json({
            error: 'Email registered but not verified.',
            hint: 'Use POST /api/auth/resend-otp to get a new code.',
          });
        }
        return res.status(409).json({ error: 'Email address is already registered' });
      }

      const hash   = await bcrypt.hash(password, 10);
      // Account starts inactive — activated after OTP verification
      const result = await pool.query(
        `INSERT INTO users (first_name,last_name,email,password_hash,role,is_active,email_verified,phone,department)
         VALUES ($1,$2,$3,$4,'user',FALSE,FALSE,$5,$6) RETURNING *`,
        [first_name, last_name, email, hash, phone || null, department || null]
      );
      const user = result.rows[0];

      const otp = generateOTP();
      const exp = new Date(Date.now() + OTP_MINUTES * 60 * 1000);
      await pool.query(
        'INSERT INTO email_verification_otps (user_id,otp,expires_at) VALUES ($1,$2,$3)',
        [user.id, otp, exp]
      );

      let emailSent = false;
      try {
        emailSent = await sendOTPEmail(email, first_name, otp);
      } catch (emailErr) {
        await pool.query('DELETE FROM users WHERE id=$1', [user.id]);
        console.error('[user-service] OTP email error:', emailErr.message);
        return res.status(503).json({
          error: 'Could not send OTP email. Please configure SMTP settings and try again.',
        });
      }

      const response = {
        message: `Registration successful. A 6-digit OTP has been sent to ${email}. Verify to activate your account.`,
        user_id: user.id,
        email_sent: emailSent,
      };

      res.status(201).json(response);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify email with OTP to activate account
 *     description: Submit the 6-digit OTP sent to your email. On success, account is activated and a JWT token is returned.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp:   { type: string, example: "483921" }
 *     responses:
 *       200:
 *         description: Email verified. Account activated. JWT returned.
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/verify-email',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').trim().notEmpty().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { email, otp } = req.body;

    try {
      const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
      const user = userResult.rows[0];

      if (user.email_verified) {
        return res.status(400).json({ error: 'Email already verified. Please login.' });
      }

      const otpResult = await pool.query(
        `SELECT * FROM email_verification_otps
         WHERE user_id=$1 AND otp=$2 AND verified=FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [user.id, otp]
      );

      if (!otpResult.rows.length) {
        return res.status(400).json({
          error: 'Invalid or expired OTP.',
          hint: 'Use POST /api/auth/resend-otp to get a new code.',
        });
      }

      // Mark OTP used and activate account
      await pool.query('UPDATE email_verification_otps SET verified=TRUE WHERE id=$1', [otpResult.rows[0].id]);
      await pool.query('UPDATE users SET is_active=TRUE,email_verified=TRUE,updated_at=NOW() WHERE id=$1', [user.id]);

      // Fetch refreshed user
      const fresh = (await pool.query('SELECT * FROM users WHERE id=$1', [user.id])).rows[0];
      const token = generateToken(fresh);

      res.json({
        message: 'Email verified successfully. Account activated.',
        token,
        user: sanitize(fresh),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Verification failed' });
    }
  }
);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Resend OTP verification code
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: New OTP sent
 *       400:
 *         description: Account already verified
 */
router.post('/resend-otp',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { email } = req.body;

    try {
      const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      if (!userResult.rows.length) {
        return res.json({ message: 'If that email exists and is unverified, a new OTP has been sent.' });
      }
      const user = userResult.rows[0];

      if (user.email_verified) {
        return res.status(400).json({ error: 'Email already verified. Please login.' });
      }

      const otp = generateOTP();
      const exp = new Date(Date.now() + OTP_MINUTES * 60 * 1000);
      let emailSent = false;

      try {
        emailSent = await sendOTPEmail(email, user.first_name, otp);
      } catch (emailErr) {
        console.error('[user-service] OTP resend email error:', emailErr.message);
        return res.status(503).json({
          error: 'Could not send OTP email. Please configure SMTP settings and try again.',
        });
      }

      // Invalidate previous OTPs only after the new email has been accepted.
      await pool.query('UPDATE email_verification_otps SET verified=TRUE WHERE user_id=$1 AND verified=FALSE', [user.id]);
      await pool.query(
        'INSERT INTO email_verification_otps (user_id,otp,expires_at) VALUES ($1,$2,$3)',
        [user.id, otp, exp]
      );

      const response = { message: `New OTP sent to ${email}.`, email_sent: emailSent };

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: 'Failed to resend OTP' });
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login and receive a JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: "kireziliva@gmail.com" }
 *               password: { type: string, example: "Admin@123456" }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 *       403: { description: Account not verified or deactivated }
 */
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const result = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      const user   = result.rows[0];

      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (!user.email_verified) {
        return res.status(403).json({
          error: 'Email not verified. Please check your inbox for the OTP.',
          hint: 'Use POST /api/auth/resend-otp if you need a new code.',
        });
      }
      if (!user.is_active) {
        return res.status(403).json({ error: 'Account deactivated. Contact your administrator.' });
      }

      const token = generateToken(user);
      res.json({ message: 'Login successful', token, user: sanitize(user) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get the current authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Profile }
 *       401: { description: Unauthorized }
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: sanitize(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request a password reset token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Reset token sent if email exists }
 */
router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    const { email } = req.body;
    try {
      const result = await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      if (!result.rows.length) {
        return res.json({ message: 'If that email is registered, a reset link has been sent.' });
      }
      const user  = result.rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const exp   = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        'INSERT INTO password_reset_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)',
        [user.id, token, exp]
      );

      try {
        await sendPasswordResetEmail(email, user.first_name, token);
      } catch (emailErr) {
        await pool.query('DELETE FROM password_reset_tokens WHERE token=$1', [token]);
        console.error('[user-service] Password reset email error:', emailErr.message);
        return res.status(503).json({
          error: 'Could not send password reset email. Please configure SMTP settings and try again.',
        });
      }

      const response = { message: 'If that email is registered, a reset link has been sent.' };

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: 'Failed to process request' });
    }
  }
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password using the reset token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, new_password]
 *             properties:
 *               token:        { type: string }
 *               new_password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password reset }
 *       400: { description: Invalid or expired token }
 */
router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('new_password')
      .isLength({ min: 8 })
      .matches(/[A-Z]/).withMessage('Must contain uppercase')
      .matches(/[a-z]/).withMessage('Must contain lowercase')
      .matches(/\d/).withMessage('Must contain a number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { token, new_password } = req.body;
    try {
      const record = await pool.query(
        'SELECT * FROM password_reset_tokens WHERE token=$1 AND used=FALSE AND expires_at > NOW()',
        [token]
      );
      if (!record.rows.length) return res.status(400).json({ error: 'Invalid or expired reset token' });

      const hash = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2', [hash, record.rows[0].user_id]);
      await pool.query('UPDATE password_reset_tokens SET used=TRUE WHERE id=$1', [record.rows[0].id]);

      res.json({ message: 'Password reset successfully. Please login.' });
    } catch (err) {
      res.status(500).json({ error: 'Reset failed' });
    }
  }
);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     tags: [Authentication]
 *     summary: Change password while authenticated
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string }
 *               new_password:     { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Changed }
 *       401: { description: Wrong current password }
 */
router.put('/change-password', authenticate,
  [
    body('current_password').notEmpty(),
    body('new_password')
      .isLength({ min: 8 })
      .matches(/[A-Z]/).withMessage('Uppercase required')
      .matches(/[a-z]/).withMessage('Lowercase required')
      .matches(/\d/).withMessage('Number required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const result = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
      const user   = result.rows[0];
      if (!(await bcrypt.compare(req.body.current_password, user.password_hash))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const hash = await bcrypt.hash(req.body.new_password, 10);
      await pool.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2', [hash, user.id]);
      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout — invalidates the token client-side
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post('/logout', authenticate, (req, res) => {
  // JWT is stateless; the client must discard the token.
  // For stronger invalidation, add the token to a Redis/DB blacklist here.
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;

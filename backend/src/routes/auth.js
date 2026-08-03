const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const { db, toUser } = require('../db');
const { signToken, requireAuth } = require('../auth');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed (png, jpg, gif, webp)'));
  },
});

router.post('/avatar', requireAuth, (req, res) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    const avatarUrl = '/uploads/avatars/' + req.file.filename;
    const userId = req.authUser.id;
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, userId);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.status(201).json({ user: toUser(user), url: avatarUrl });
  });
});

function upsertGoogleUser(payload) {
  const email = String(payload.email).trim().toLowerCase();
  const name = String(payload.name || payload.given_name || email.split('@')[0]).trim();
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  } else {
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name, email, 'GOOGLE_OAUTH_PLACEHOLDER');
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }
  return user;
}

router.post('/google', async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: 'Google credential is required' });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server' });
  }
  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ error: 'Google email is not verified' });
    }
    const user = upsertGoogleUser(payload);
    res.json({ token: signToken(user), user: toUser(user) });
  } catch (err) {
    console.error('[auth:google] verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid Google credential' });
  }
});

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    if (existing.password_hash === 'GOOGLE_OAUTH_PLACEHOLDER') {
      return res.status(409).json({
        error: 'An account already exists for this email via Google. Please sign in with Google instead.',
      });
    }
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const hash = bcrypt.hashSync(String(password), 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(String(name).trim(), normalizedEmail, hash);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: toUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.password_hash === 'GOOGLE_OAUTH_PLACEHOLDER') {
    return res.status(401).json({
      error: 'This account was created with Google sign-in. Please use "Sign in with Google".',
    });
  }
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: signToken(user), user: toUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});

router.put('/profile', requireAuth, (req, res) => {
  const { name, phone, address, dateOfBirth, avatarUrl } = req.body || {};
  const userId = req.authUser.id;

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(String(name).trim());
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    params.push(String(phone).trim());
  }
  if (address !== undefined) {
    updates.push('address = ?');
    params.push(String(address).trim());
  }
  if (dateOfBirth !== undefined) {
    updates.push('date_of_birth = ?');
    params.push(String(dateOfBirth).trim() || null);
  }
  if (avatarUrl !== undefined) {
    updates.push('avatar_url = ?');
    params.push(String(avatarUrl).trim());
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.json({ user: toUser(user) });
});

router.put('/privacy', requireAuth, (req, res) => {
  const { marketingEmails, dataProcessingConsent, newsletterSubscribed, smsNotifications } = req.body || {};
  const userId = req.authUser.id;

  const updates = [];
  const params = [];

  if (marketingEmails !== undefined) {
    updates.push('marketing_emails = ?');
    params.push(marketingEmails ? 1 : 0);
  }
  if (dataProcessingConsent !== undefined) {
    updates.push('data_processing_consent = ?');
    params.push(dataProcessingConsent ? 1 : 0);
  }
  if (newsletterSubscribed !== undefined) {
    updates.push('newsletter_subscribed = ?');
    params.push(newsletterSubscribed ? 1 : 0);
  }
  if (smsNotifications !== undefined) {
    updates.push('sms_notifications = ?');
    params.push(smsNotifications ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No privacy settings to update' });
  }

  params.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.json({ user: toUser(user) });
});

router.put('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.authUser.id);
  if (!user || user.password_hash === 'GOOGLE_OAUTH_PLACEHOLDER') {
    return res.status(400).json({ error: 'Cannot change password for Google sign-in accounts' });
  }

  if (!bcrypt.compareSync(String(currentPassword), user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(String(newPassword), 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

  res.json({ ok: true, message: 'Password updated successfully' });
});

module.exports = router;

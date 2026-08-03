const express = require('express');
const { db } = require('../db');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  const existing = db.prepare('SELECT id FROM newsletter_emails WHERE email = ?').get(email);
  if (existing) {
    return res.json({ ok: true, subscribed: true, message: 'You are already subscribed!' });
  }
  db.prepare('INSERT INTO newsletter_emails (email) VALUES (?)').run(email);
  res.status(201).json({ ok: true, subscribed: true, message: 'Thanks for subscribing!' });
});

module.exports = router;

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { db, toProduct } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { buildOrderObject } = require('./orders');

const router = express.Router();

router.use(requireAuth, requireAdmin);

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed (png, jpg, gif, webp)'));
  },
});

router.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    res.status(201).json({ url: '/uploads/' + req.file.filename });
  });
});

router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json({ products: rows.map(toProduct) });
});

router.post('/products', (req, res) => {
  const { name, description, price, imageUrl, category, stock, featured } = req.body || {};
  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  const priceCents = Math.round(Number(price) * 100);
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }
  const result = db
    .prepare(
      `INSERT INTO products (name, description, price_cents, image_url, category, stock, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(name).trim(),
      String(description || ''),
      priceCents,
      String(imageUrl || ''),
      String(category || 'general').trim(),
      Math.max(0, Math.floor(Number(stock) || 0)),
      featured ? 1 : 0
    );
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ product: toProduct(product) });
});

router.put('/products/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const { name, description, price, imageUrl, category, stock, featured } = req.body || {};
  const priceCents =
    price !== undefined && price !== null ? Math.round(Number(price) * 100) : existing.price_cents;
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  db.prepare(
    `UPDATE products SET
       name = ?, description = ?, price_cents = ?, image_url = ?, category = ?, stock = ?, featured = ?
     WHERE id = ?`
  ).run(
    name !== undefined ? String(name).trim() : existing.name,
    description !== undefined ? String(description) : existing.description,
    priceCents,
    imageUrl !== undefined ? String(imageUrl) : existing.image_url,
    category !== undefined ? String(category).trim() : existing.category,
    stock !== undefined ? Math.max(0, Math.floor(Number(stock) || 0)) : existing.stock,
    featured !== undefined ? (featured ? 1 : 0) : existing.featured,
    existing.id
  );

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
  res.json({ product: toProduct(product) });
});

router.delete('/products/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

router.get('/orders', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json({ orders: orders.map(buildOrderObject) });
});

router.patch('/orders/:id/status', (req, res) => {
  const { status } = req.body || {};
  const allowed = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
  }
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, existing.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(existing.id);
  res.json({ order: buildOrderObject(order) });
});

module.exports = router;

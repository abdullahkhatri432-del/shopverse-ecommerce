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

function validateCategory(category) {
  const clean = String(category).trim();
  if (!clean) return { error: 'Category is required' };
  const exists = db.prepare('SELECT id FROM categories WHERE name = ?').get(clean);
  if (!exists) return { error: `Category "${clean}" does not exist. Add it under Categories first.` };
  return { clean };
}

router.post('/products', (req, res) => {
  const { name, description, price, imageUrl, category, stock, featured, countryOfOrigin } = req.body || {};
  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  const priceCents = Math.round(Number(price) * 100);
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }
  const cat = validateCategory(category || 'general');
  if (cat.error) return res.status(400).json({ error: cat.error });
  const result = db
    .prepare(
      `INSERT INTO products (name, description, price_cents, image_url, category, stock, featured, country_of_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(name).trim(),
      String(description || ''),
      priceCents,
      String(imageUrl || ''),
      cat.clean,
      Math.max(0, Math.floor(Number(stock) || 0)),
      featured ? 1 : 0,
      String(countryOfOrigin || 'India').trim() || 'India'
    );
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ product: toProduct(product) });
});

router.put('/products/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const { name, description, price, imageUrl, category, stock, featured, countryOfOrigin } = req.body || {};
  const priceCents =
    price !== undefined && price !== null ? Math.round(Number(price) * 100) : existing.price_cents;
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return res.status(400).json({ error: 'Invalid price' });
  }
  const cat =
    category !== undefined && category !== ''
      ? validateCategory(category)
      : { clean: existing.category };
  if (cat.error) return res.status(400).json({ error: cat.error });

  db.prepare(
    `UPDATE products SET
       name = ?, description = ?, price_cents = ?, image_url = ?, category = ?, stock = ?, featured = ?, country_of_origin = ?
     WHERE id = ?`
  ).run(
    name !== undefined ? String(name).trim() : existing.name,
    description !== undefined ? String(description) : existing.description,
    priceCents,
    imageUrl !== undefined ? String(imageUrl) : existing.image_url,
    cat.clean,
    stock !== undefined ? Math.max(0, Math.floor(Number(stock) || 0)) : existing.stock,
    featured !== undefined ? (featured ? 1 : 0) : existing.featured,
    countryOfOrigin !== undefined
      ? String(countryOfOrigin).trim() || 'India'
      : existing.country_of_origin || 'India',
    existing.id
  );

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
  res.json({ product: toProduct(product) });
});

router.get('/categories', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category = c.name
       GROUP BY c.id
       ORDER BY c.name`
    )
    .all();
  res.json({
    categories: rows.map((r) => ({ id: r.id, name: r.name, productCount: r.product_count })),
  });
});

router.post('/categories', (req, res) => {
  const clean = String((req.body && req.body.name) || '').trim();
  if (!clean) return res.status(400).json({ error: 'Category name is required' });
  try {
    const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(clean);
    res.status(201).json({ category: { id: result.lastInsertRowid, name: clean, productCount: 0 } });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category already exists' });
    }
    throw err;
  }
});

router.delete('/categories/:id', (req, res) => {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const inUse = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category = ?').get(cat.name).n;
  if (inUse > 0) {
    return res
      .status(400)
      .json({ error: `Cannot delete "${cat.name}" — ${inUse} product(s) still use it` });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
  res.json({ ok: true });
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
  const allowed = [
    'pending',
    'paid',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'return_requested',
    'return_approved',
    'returned',
    'cancelled',
  ];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
  }
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  if (status === 'cancelled' || status === 'returned') {
    const prev = existing.status;
    const alreadyReversed = ['cancelled', 'returned'].includes(prev);
    if (!alreadyReversed) {
      const items = db
        .prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?')
        .all(existing.id);
      const restock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
      for (const i of items) {
        if (i.product_id) restock.run(i.quantity, i.product_id);
      }
    }
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, existing.id);
  if (status === 'paid' && !existing.invoice_number) {
    const { generateInvoiceNumber } = require('../gst');
    const invoiceNumber = generateInvoiceNumber(existing.id);
    db.prepare('UPDATE orders SET invoice_number = ? WHERE id = ?').run(invoiceNumber, existing.id);
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(existing.id);
  res.json({ order: buildOrderObject(order) });
});

module.exports = router;

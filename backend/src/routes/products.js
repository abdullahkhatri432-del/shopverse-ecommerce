const express = require('express');
const { db, toProduct } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function ratingSummary(productId) {
  const row = db
    .prepare('SELECT COUNT(*) AS n, COALESCE(AVG(rating), 0) AS avg FROM product_reviews WHERE product_id = ?')
    .get(productId);
  return {
    avgRating: Math.round(row.avg * 10) / 10,
    reviewCount: row.n,
  };
}

function hasPurchased(userId, productId) {
  const row = db
    .prepare(`
      SELECT COUNT(*) AS n
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = ? AND oi.product_id = ?
        AND o.status != 'cancelled'
        AND NOT (o.payment_method IN ('online', 'razorpay', 'mock') AND o.status = 'pending')
        AND NOT (o.payment_method = 'cod' AND o.status = 'pending')
    `)
    .get(userId, productId);
  return row.n > 0;
}

const SORTS = {
  newest: 'p.created_at DESC',
  price_asc: 'p.price_cents ASC',
  price_desc: 'p.price_cents DESC',
  name: 'p.name ASC',
};

router.get('/', (req, res) => {
  const { search, category, minPrice, maxPrice, sort, featured, inStock, limit, offset } = req.query;

  const where = [];
  const params = [];

  if (search) {
    where.push('(p.name LIKE ? OR p.description LIKE ?)');
    const like = `%${String(search)}%`;
    params.push(like, like);
  }
  if (category) {
    where.push('p.category = ?');
    params.push(String(category));
  }
  if (minPrice !== undefined && minPrice !== '') {
    where.push('p.price_cents >= ?');
    params.push(Math.round(Number(minPrice) * 100));
  }
  if (maxPrice !== undefined && maxPrice !== '') {
    where.push('p.price_cents <= ?');
    params.push(Math.round(Number(maxPrice) * 100));
  }
  if (inStock === 'true' || inStock === '1') {
    where.push('p.stock > 0');
  }
  if (featured === 'true' || featured === '1') {
    where.push('p.featured = 1');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORTS[sort] || SORTS.newest;

  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM products p ${whereSql}`)
    .get(...params).n;

  const pageLimit = Math.min(parseInt(limit, 10) || 48, 100);
  const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const rows = db
    .prepare(`SELECT p.* FROM products p ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
    .all(...params, pageLimit, pageOffset);

  res.json({
    products: rows.map(toProduct),
    total,
    limit: pageLimit,
    offset: pageOffset,
  });
});

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT name FROM categories ORDER BY name').all();
  res.json({ categories: rows.map((r) => r.name) });
});

router.get('/featured', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE featured = 1 ORDER BY created_at DESC LIMIT 8').all();
  res.json({ products: rows.map(toProduct) });
});

router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: { ...toProduct(product), ...ratingSummary(req.params.id) } });
});

router.get('/:id/reviews', (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const rows = db
    .prepare('SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.params.id);
  res.json({
    reviews: rows.map((r) => ({
      id: r.id,
      userName: r.user_name,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    })),
    ...ratingSummary(req.params.id),
  });
});

router.post('/:id/reviews', requireAuth, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const rating = Math.floor(Number(req.body?.rating));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5 stars' });
  }
  const comment = String(req.body?.comment || '').trim().slice(0, 500);

  const existing = db
    .prepare('SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'You have already reviewed this product' });
  }
  if (!hasPurchased(req.user.id, req.params.id)) {
    return res.status(403).json({
      error: 'Only customers who have purchased this product can review it',
    });
  }

  const result = db
    .prepare('INSERT INTO product_reviews (product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, req.user.id, req.user.name, rating, comment);
  const row = db.prepare('SELECT * FROM product_reviews WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    review: {
      id: row.id,
      userName: row.user_name,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
    },
    ...ratingSummary(req.params.id),
  });
});

module.exports = router;

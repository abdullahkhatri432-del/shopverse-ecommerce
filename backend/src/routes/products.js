const express = require('express');
const { db, toProduct } = require('../db');

const router = express.Router();

const SORTS = {
  newest: 'p.created_at DESC',
  price_asc: 'p.price_cents ASC',
  price_desc: 'p.price_cents DESC',
  name: 'p.name ASC',
};

router.get('/', (req, res) => {
  const { search, category, minPrice, maxPrice, sort, featured, limit, offset } = req.query;

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
  res.json({ product: toProduct(product) });
});

module.exports = router;

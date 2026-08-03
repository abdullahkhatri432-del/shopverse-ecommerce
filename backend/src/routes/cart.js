const express = require('express');
const crypto = require('node:crypto');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function newToken() {
  return crypto.randomUUID();
}

function resolveUserFromHeader(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../auth');
    const payload = jwt.verify(token, JWT_SECRET);
    return db.prepare('SELECT id FROM users WHERE id = ?').get(payload.id) || null;
  } catch {
    return null;
  }
}

function resolveCartId(req) {
  const authedUser = resolveUserFromHeader(req);
  if (authedUser) {
    const row = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(authedUser.id);
    if (row) return { cartId: row.id, token: null };
    const result = db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(authedUser.id);
    return { cartId: result.lastInsertRowid, token: null };
  }
  const token = String(req.body?.cartToken || req.query?.token || '').trim();
  if (!token) return { cartId: null, token: null };
  const row = db.prepare('SELECT id FROM carts WHERE cart_token = ?').get(token);
  if (row) return { cartId: row.id, token };
  const result = db.prepare('INSERT INTO carts (cart_token) VALUES (?)').run(token);
  return { cartId: result.lastInsertRowid, token };
}

function loadItems(cartId) {
  if (!cartId) return [];
  const rows = db
    .prepare(
      `SELECT ci.quantity, p.id AS product_id, p.name, p.price_cents, p.image_url, p.stock, p.category
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ?
       ORDER BY ci.id`
    )
    .all(cartId);
  return rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    priceCents: r.price_cents,
    imageUrl: r.image_url,
    stock: r.stock,
    category: r.category,
    quantity: r.quantity,
  }));
}

router.get('/', (req, res) => {
  const { cartId } = resolveCartId(req);
  const items = loadItems(cartId);
  const totalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  res.json({ items, totalCents });
});

router.put('/', (req, res) => {
  const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
  const { cartId, token } = resolveCartId(req);

  if (!cartId && !token) {
    return res.status(400).json({ error: 'cartToken is required for guest carts' });
  }

  const getProduct = db.prepare('SELECT id, stock FROM products WHERE id = ?');
  const valid = [];
  for (const it of incoming) {
    const productId = Number(it.productId);
    const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
    if (!Number.isFinite(productId)) continue;
    const product = getProduct.get(productId);
    if (!product) continue;
    valid.push({ productId, quantity: Math.min(quantity, product.stock) });
  }

  let id = cartId;
  if (!id) {
    id = db.prepare('INSERT INTO carts (cart_token) VALUES (?)').run(token).lastInsertRowid;
  }

  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(id);
  const insert = db.prepare(
    'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)'
  );
  for (const v of valid) insert.run(id, v.productId, v.quantity);
  db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(id);

  const items = loadItems(id);
  const totalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  res.json({ items, totalCents, cartToken: token || undefined });
});

router.post('/merge', requireAuth, (req, res) => {
  const token = String(req.body?.cartToken || '').trim();
  const userCart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(req.user.id);
  let userCartId = userCart ? userCart.id : null;

  if (token) {
    const guestCart = db.prepare('SELECT id FROM carts WHERE cart_token = ?').get(token);
    if (guestCart) {
      if (!userCartId) {
        db.prepare('UPDATE carts SET user_id = ?, cart_token = NULL WHERE id = ?').run(
          req.user.id,
          guestCart.id
        );
        userCartId = guestCart.id;
      } else if (userCartId !== guestCart.id) {
        const merge = db.prepare(
          `INSERT INTO cart_items (cart_id, product_id, quantity)
           SELECT ?, product_id, quantity FROM cart_items WHERE cart_id = ?`
        );
        merge.run(userCartId, guestCart.id);
        db.prepare('DELETE FROM carts WHERE id = ?').run(guestCart.id);
      }
    }
  }

  if (!userCartId) {
    userCartId = db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(req.user.id).lastInsertRowid;
  }

  const dedupe = db.prepare(
    `DELETE FROM cart_items
     WHERE cart_id = ?
       AND id NOT IN (
         SELECT MIN(id) FROM cart_items WHERE cart_id = ? GROUP BY product_id
       )`
  );
  dedupe.run(userCartId, userCartId);

  const items = loadItems(userCartId);
  const totalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  res.json({ items, totalCents });
});

module.exports = router;

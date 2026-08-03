const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function buildOrderObject(order) {
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .all(order.id)
    .map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      price: i.price_cents / 100,
      priceCents: i.price_cents,
      quantity: i.quantity,
    }));
  return {
    id: order.id,
    userId: order.user_id,
    total: order.total_cents / 100,
    totalCents: order.total_cents,
    status: order.status,
    paymentMethod: order.payment_method,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerAddress: order.customer_address,
    createdAt: order.created_at,
    items,
  };
}

function resolveUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../auth');
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.id);
    return user || null;
  } catch {
    return null;
  }
}

router.post('/', (req, res) => {
  const { items, customerName, customerEmail, customerAddress } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (!customerName || !customerEmail) {
    return res.status(400).json({ error: 'Customer name and email are required' });
  }

  const user = resolveUser(req);

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
  const checkStock = db.prepare('SELECT stock FROM products WHERE id = ?');
  const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

  const orderItems = [];
  const quantities = new Map();

  for (const it of items) {
    const productId = Number(it.productId);
    const quantity = Math.max(1, Math.floor(Number(it.quantity) || 1));
    const product = getProduct.get(productId);
    if (!product) {
      return res.status(400).json({ error: `Product #${productId} not found` });
    }
    if (product.stock < quantity) {
      return res.status(400).json({
        error: `Not enough stock for "${product.name}" (only ${product.stock} left)`,
      });
    }
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    orderItems.push({
      productId,
      name: product.name,
      priceCents: product.price_cents,
      quantity,
    });
  }

  const totalCents = orderItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  for (const [productId, qty] of quantities) {
    decStock.run(qty, productId);
  }

  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, total_cents, status, payment_method, customer_name, customer_email, customer_address)
    VALUES (?, ?, 'pending', 'checkout', ?, ?, ?)
  `);
  const orderResult = insertOrder.run(
    user ? user.id : null,
    totalCents,
    String(customerName).trim(),
    String(customerEmail).trim(),
    String(customerAddress || '').trim()
  );
  const orderId = orderResult.lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, price_cents, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const i of orderItems) {
    insertItem.run(orderId, i.productId, i.name, i.priceCents, i.quantity);
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.status(201).json({ order: buildOrderObject(order) });
});

router.post('/:id/confirm', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'paid') {
    db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
  }
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  res.json({ order: buildOrderObject(updated) });
});

router.get('/my', requireAuth, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ orders: orders.map(buildOrderObject) });
});

module.exports = router;
module.exports.buildOrderObject = buildOrderObject;

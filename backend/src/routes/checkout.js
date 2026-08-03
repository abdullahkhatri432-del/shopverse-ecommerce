const express = require('express');
const crypto = require('node:crypto');
const { db } = require('../db');

const router = express.Router();

const currency = process.env.CURRENCY || 'INR';

function razorpayEnabled() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function getRazorpay() {
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

router.get('/config', (req, res) => {
  res.json({
    paymentProvider: razorpayEnabled() ? 'razorpay' : 'mock',
    currency,
    razorpayEnabled: razorpayEnabled(),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  });
});

router.post('/', async (req, res) => {
  const { items, customerName, customerEmail, customerAddress } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (!customerName || !customerEmail) {
    return res.status(400).json({ error: 'Customer name and email are required' });
  }

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
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
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, productId);
  }

  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, total_cents, status, payment_method, customer_name, customer_email, customer_address)
    VALUES (NULL, ?, 'pending', ?, ?, ?, ?)
  `);
  const orderId = insertOrder.run(
    totalCents,
    razorpayEnabled() ? 'razorpay' : 'mock',
    String(customerName).trim(),
    String(customerEmail).trim(),
    String(customerAddress || '').trim()
  ).lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, price_cents, quantity)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const i of orderItems) {
    insertItem.run(orderId, i.productId, i.name, i.priceCents, i.quantity);
  }

  if (!razorpayEnabled()) {
    return res.status(201).json({
      orderId,
      paymentMethod: 'mock',
      amount: totalCents,
      currency,
    });
  }

  try {
    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: totalCents,
      currency,
      receipt: `shopverse_${orderId}`,
      notes: { order_id: String(orderId) },
    });
    res.status(201).json({
      orderId,
      paymentMethod: 'razorpay',
      razorpayOrderId: rzpOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: totalCents,
      currency,
    });
  } catch (err) {
    const detail =
      (err && err.error && err.error.description) ||
      (err && err.error && err.error.reason) ||
      (err && err.message) ||
      'unknown error';
    res.status(500).json({ error: 'Could not create Razorpay order: ' + detail });
  }
});

router.post('/verify', async (req, res) => {
  const { orderId, razorpayOrderId, paymentId, signature } = req.body || {};

  if (!orderId || !razorpayOrderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'orderId, razorpayOrderId, paymentId and signature are required' });
  }
  if (!razorpayEnabled()) {
    return res.status(400).json({ error: 'Razorpay is not configured' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest('hex');

  if (expected !== signature) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  db.prepare("UPDATE orders SET status = 'paid', payment_method = 'razorpay' WHERE id = ?").run(orderId);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.json({ ok: true, orderId: updated.id, status: updated.status });
});

module.exports = router;

const express = require('express');
const crypto = require('node:crypto');
const { db } = require('../db');
const { validateGstin, isValidState, generateInvoiceNumber } = require('../gst');
const { sendOrderConfirmation, sendAdminNewOrder } = require('../mailer');
const { razorpayEnabled, mockAllowed, onlineAvailable } = require('../payments');
const { applyPromo } = require('../promos');

const router = express.Router();

const currency = process.env.CURRENCY || 'INR';

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
    paymentMode: process.env.PAYMENT_MODE || (razorpayEnabled() ? 'test' : 'mock'),
    currency,
    razorpayEnabled: razorpayEnabled(),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    codEnabled: process.env.COD_ENABLED !== 'false',
  });
});

router.post('/promo', (req, res) => {
  const { code, subtotalCents } = req.body || {};
  const base = Number(subtotalCents);
  if (!Number.isFinite(base) || base <= 0) {
    return res.status(400).json({ error: 'A valid subtotal is required' });
  }
  const promo = applyPromo(code, base);
  if (!promo) {
    return res.status(400).json({ error: 'That promo code is not valid' });
  }
  res.json({ valid: true, ...promo, subtotalCents: base });
});
router.post('/', async (req, res) => {
  const {
    items,
    customerName,
    customerEmail,
    customerAddress,
    companyName,
    gstin,
    billingState,
    paymentMethod,
    expectedTotalCents,
    promoCode,
  } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (!customerName || !customerEmail) {
    return res.status(400).json({ error: 'Customer name and email are required' });
  }

  const gstinClean = String(gstin || '').trim().toUpperCase();
  if (gstinClean && !validateGstin(gstinClean)) {
    return res.status(400).json({ error: 'Invalid GSTIN format' });
  }
  const stateClean = String(billingState || '').trim().toUpperCase();
  if (stateClean && !isValidState(stateClean)) {
    return res.status(400).json({ error: 'Invalid billing state code' });
  }

  const method = paymentMethod === 'cod' ? 'cod' : 'online';
  if (method === 'online' && !onlineAvailable()) {
    return res.status(503).json({
      error:
        'Online payments are not available in this environment. Please use Cash on Delivery or contact support.',
    });
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
      category: product.category || 'general',
    });
  }

  const totalCents = orderItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  if (
    expectedTotalCents !== undefined &&
    expectedTotalCents !== null &&
    Number(expectedTotalCents) !== totalCents
  ) {
    return res.status(409).json({
      error: 'Some prices changed since you added items to your cart. Please review your cart.',
      priceChanged: true,
      newTotalCents: totalCents,
    });
  }

  const promo = applyPromo(promoCode, totalCents);
  const discountCents = promo ? promo.discountCents : 0;
  const payableCents = totalCents - discountCents;

  for (const [productId, qty] of quantities) {
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, productId);
  }

  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, total_cents, status, payment_method, customer_name, customer_email, customer_address, company_name, gstin, billing_state, discount_cents, promo_code)
    VALUES (NULL, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const orderId = insertOrder.run(
    payableCents,
    method === 'cod' ? 'cod' : razorpayEnabled() ? 'razorpay' : 'mock',
    String(customerName).trim(),
    String(customerEmail).trim(),
    String(customerAddress || '').trim(),
    String(companyName || '').trim(),
    gstinClean,
    stateClean,
    discountCents,
    promo ? promo.code : ''
  ).lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, price_cents, quantity, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const i of orderItems) {
    insertItem.run(orderId, i.productId, i.name, i.priceCents, i.quantity, i.category);
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  sendOrderConfirmation(order, orderItems);
  sendAdminNewOrder(order, orderItems);

  if (method === 'cod') {
    return res.status(201).json({
      orderId,
      paymentMethod: 'cod',
      amount: payableCents,
      currency,
      status: 'pending',
      discountCents,
      promoCode: promo ? promo.code : null,
    });
  }

  if (!razorpayEnabled()) {
    return res.status(201).json({
      orderId,
      paymentMethod: 'mock',
      amount: payableCents,
      currency,
      discountCents,
      promoCode: promo ? promo.code : null,
    });
  }

  try {
    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: payableCents,
      currency,
      receipt: `shopverse_${orderId}`,
      notes: { order_id: String(orderId) },
    });
    res.status(201).json({
      orderId,
      paymentMethod: 'razorpay',
      razorpayOrderId: rzpOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: payableCents,
      currency,
      discountCents,
      promoCode: promo ? promo.code : null,
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

  const invoiceNumber = order.invoice_number || generateInvoiceNumber(order.id);
  db.prepare(
    "UPDATE orders SET status = 'paid', payment_method = 'razorpay', invoice_number = COALESCE(invoice_number, ?) WHERE id = ?"
  ).run(invoiceNumber, order.id);
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  res.json({ ok: true, orderId: updated.id, status: updated.status });
});

module.exports = router;

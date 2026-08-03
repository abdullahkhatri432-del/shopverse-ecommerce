const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.post('/', (req, res) => {
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
    VALUES (NULL, ?, 'pending', 'checkout', ?, ?, ?)
  `);
  const orderId = insertOrder.run(
    totalCents,
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

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (stripeKey) {
    const stripe = require('stripe')(stripeKey);
    return stripe.checkout.sessions
      .create({
        mode: 'payment',
        success_url: `${frontendUrl}/checkout/success?order=${orderId}`,
        cancel_url: `${frontendUrl}/checkout?cancel=1`,
        line_items: orderItems.map((i) => ({
          price_data: {
            currency: 'usd',
            product_data: { name: i.name },
            unit_amount: i.priceCents,
          },
          quantity: i.quantity,
        })),
        customer_email: String(customerEmail).trim(),
        metadata: { order_id: String(orderId) },
      })
      .then((session) => {
        res.status(201).json({ orderId, paymentUrl: session.url, paymentMethod: 'stripe' });
      })
      .catch((err) => {
        res.status(500).json({ error: 'Could not create Stripe session: ' + err.message });
      });
  }

  res.status(201).json({
    orderId,
    paymentUrl: `${frontendUrl}/checkout/success?order=${orderId}&mock=1`,
    paymentMethod: 'mock',
  });
});

module.exports = router;

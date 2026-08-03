const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { gstRateFor, splitGst, stateName, generateInvoiceNumber, validateGstin, isValidState } = require('../gst');

const router = express.Router();

function storeInfo() {
  return {
    name: process.env.STORE_NAME || 'ShopVerse',
    legalName: process.env.STORE_LEGAL_NAME || 'Your Legal Business Name',
    proprietor: process.env.STORE_PROPRIETOR || 'Your Full Name',
    address: process.env.STORE_ADDRESS || 'Your Registered Address, City, State, PIN',
    email: process.env.STORE_EMAIL || 'support@yourstore.com',
    phone: process.env.STORE_PHONE || '+91 90000 00000',
    gstin: (process.env.STORE_GSTIN || '').toUpperCase(),
    stateCode: process.env.STORE_STATE || 'DL',
    stateName: process.env.STORE_STATE_NAME || 'Delhi',
  };
}

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
      category: i.category,
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
    companyName: order.company_name,
    gstin: order.gstin,
    billingState: order.billing_state,
    invoiceNumber: order.invoice_number,
    createdAt: order.created_at,
    items,
  };
}

function computeInvoice(order) {
  const seller = storeInfo();
  const buyerState = order.billing_state || seller.stateCode;
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .all(order.id)
    .map((i) => {
      const taxableCents = i.price_cents * i.quantity;
      const rate = gstRateFor(i.category);
      const tax = splitGst(taxableCents, rate, seller.stateCode, buyerState);
      return {
        productId: i.product_id,
        productName: i.product_name,
        category: i.category || 'general',
        price: i.price_cents / 100,
        priceCents: i.price_cents,
        quantity: i.quantity,
        taxableCents,
        rate,
        cgst: tax.cgst,
        sgst: tax.sgst,
        igst: tax.igst,
        gst: tax.gst,
      };
    });

  const subtotalCents = items.reduce((s, i) => s + i.taxableCents, 0);
  const cgstTotal = items.reduce((s, i) => s + i.cgst, 0);
  const sgstTotal = items.reduce((s, i) => s + i.sgst, 0);
  const igstTotal = items.reduce((s, i) => s + i.igst, 0);
  const gstTotal = cgstTotal + sgstTotal + igstTotal;
  const totalCents = subtotalCents + gstTotal;

  return {
    invoiceNumber: order.invoice_number || generateInvoiceNumber(order.id),
    issuedAt: order.created_at,
    seller,
    buyer: {
      name: order.customer_name,
      email: order.customer_email,
      address: order.customer_address,
      companyName: order.company_name,
      gstin: order.gstin || null,
      stateCode: buyerState,
      stateName: stateName(buyerState),
    },
    items,
    totals: {
      subtotalCents,
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: igstTotal,
      gst: gstTotal,
      totalCents,
    },
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
  const {
    items,
    customerName,
    customerEmail,
    customerAddress,
    companyName,
    gstin,
    billingState,
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
      category: product.category || 'general',
    });
  }

  const totalCents = orderItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  for (const [productId, qty] of quantities) {
    decStock.run(qty, productId);
  }

  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, total_cents, status, payment_method, customer_name, customer_email, customer_address, company_name, gstin, billing_state)
    VALUES (?, ?, 'pending', 'checkout', ?, ?, ?, ?, ?, ?)
  `);
  const orderResult = insertOrder.run(
    user ? user.id : null,
    totalCents,
    String(customerName).trim(),
    String(customerEmail).trim(),
    String(customerAddress || '').trim(),
    String(companyName || '').trim(),
    gstinClean,
    stateClean
  );
  const orderId = orderResult.lastInsertRowid;

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, price_cents, quantity, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const i of orderItems) {
    insertItem.run(orderId, i.productId, i.name, i.priceCents, i.quantity, i.category);
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.status(201).json({ order: buildOrderObject(order) });
});

router.post('/:id/confirm', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'paid') {
    const invoiceNumber = order.invoice_number || generateInvoiceNumber(order.id);
    db.prepare(
      "UPDATE orders SET status = 'paid', invoice_number = COALESCE(invoice_number, ?) WHERE id = ?"
    ).run(invoiceNumber, order.id);
  }
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  res.json({ order: buildOrderObject(updated) });
});

router.get('/:id/invoice', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'pending') {
    return res.status(400).json({ error: 'Invoice is available after payment is confirmed' });
  }
  res.json({ invoice: computeInvoice(order) });
});

router.get('/my', requireAuth, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ orders: orders.map(buildOrderObject) });
});

module.exports = router;
module.exports.buildOrderObject = buildOrderObject;

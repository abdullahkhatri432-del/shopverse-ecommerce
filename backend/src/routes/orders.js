const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { gstRateFor, splitGst, stateName, generateInvoiceNumber, validateGstin, isValidState } = require('../gst');
const { sendOrderConfirmation, sendAdminNewOrder } = require('../mailer');
const { razorpayEnabled, mockAllowed } = require('../payments');

const router = express.Router();

const RETURN_WINDOW_DAYS = 7;

function addBusinessDays(from, days) {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date;
}

function etaFor(order) {
  const created = new Date(order.created_at + 'Z');
  return {
    min: addBusinessDays(created, 3).toISOString().slice(0, 10),
    max: addBusinessDays(created, 7).toISOString().slice(0, 10),
  };
}

function isReturnEligible(order) {
  if (order.status !== 'delivered') return false;
  const created = new Date(order.created_at + 'Z');
  const now = new Date();
  const days = (now - created) / (1000 * 60 * 60 * 24);
  return days <= RETURN_WINDOW_DAYS;
}

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
  const subtotalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const discountCents = order.discount_cents || 0;
  return {
    id: order.id,
    userId: order.user_id,
    total: order.total_cents / 100,
    totalCents: order.total_cents,
    subtotalCents,
    discountCents,
    promoCode: order.promo_code || null,
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
    eta: etaFor(order),
    returnEligible: isReturnEligible(order),
    returnStatus: db.prepare('SELECT status FROM order_returns WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id)?.status || null,
    carrier: order.carrier || null,
    trackingNumber: order.tracking_number || null,
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
      const product = i.product_id
        ? db.prepare('SELECT country_of_origin FROM products WHERE id = ?').get(i.product_id)
        : null;
      return {
        productId: i.product_id,
        productName: i.product_name,
        category: i.category || 'general',
        countryOfOrigin: product?.country_of_origin || 'India',
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
  const discountCents = order.discount_cents || 0;
  const totalCents = subtotalCents + gstTotal - discountCents;

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
      discountCents,
      promoCode: order.promo_code || null,
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
    paymentMethod,
    expectedTotalCents,
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

  for (const [productId, qty] of quantities) {
    decStock.run(qty, productId);
  }

  const method = paymentMethod === 'cod' ? 'cod' : 'online';
  if (method === 'online' && !razorpayEnabled() && !mockAllowed()) {
    return res.status(503).json({
      error:
        'Online payments are not available in this environment. Please use Cash on Delivery or contact support.',
    });
  }
  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, total_cents, status, payment_method, customer_name, customer_email, customer_address, company_name, gstin, billing_state)
    VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
  `);
  const orderResult = insertOrder.run(
    user ? user.id : null,
    totalCents,
    method,
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
  sendOrderConfirmation(order, orderItems);
  sendAdminNewOrder(order, orderItems);

  res.status(201).json({ order: buildOrderObject(order) });
});

router.post('/:id/confirm', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.payment_method === 'razorpay') {
    if (order.status !== 'paid') {
      return res.status(400).json({ error: 'Payment for this order has not been verified' });
    }
    return res.json({ order: buildOrderObject(order) });
  }

  if (order.payment_method === 'cod') {
    return res.json({ order: buildOrderObject(order) });
  }

  if (!mockAllowed()) {
    return res.status(400).json({ error: 'Mock payments are disabled in this environment' });
  }

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

router.post('/:id/cancel', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!['pending', 'paid'].includes(order.status)) {
    return res.status(400).json({ error: 'This order can no longer be cancelled' });
  }
  db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(order.id);
  const restock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  for (const i of items) {
    if (i.product_id) restock.run(i.quantity, i.product_id);
  }
  res.json({ order: buildOrderObject(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) });
});

router.post('/:id/return', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!isReturnEligible(order)) {
    return res.status(400).json({
      error: `Return requests are accepted within ${RETURN_WINDOW_DAYS} days of delivery.`,
    });
  }
  const existing = db
    .prepare("SELECT id FROM order_returns WHERE order_id = ? AND status IN ('requested','approved')")
    .get(order.id);
  if (existing) {
    return res.status(400).json({ error: 'A return request for this order is already in progress' });
  }
  const reason = String(req.body?.reason || '').trim().slice(0, 500);
  db.prepare('INSERT INTO order_returns (order_id, reason) VALUES (?, ?)').run(order.id, reason);
  db.prepare("UPDATE orders SET status = 'return_requested' WHERE id = ?").run(order.id);
  res.status(201).json({
    order: buildOrderObject(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)),
  });
});

router.get('/:id/invoice.pdf', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'pending') {
    return res.status(400).json({ error: 'Invoice is available after payment is confirmed' });
  }
  const invoice = computeInvoice(order);
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const filename = `invoice-${invoice.invoiceNumber}.pdf`.replace(/[^\w.-]+/g, '-');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const rupee = (cents) => `Rs.${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const s = invoice.seller;
  const b = invoice.buyer;

  doc.font('Helvetica-Bold').fontSize(18).text(s.legalName || s.name, { continued: false });
  doc.font('Helvetica').fontSize(10).text(s.address);
  doc.text(`Phone: ${s.phone} | Email: ${s.email}`);
  if (s.gstin) doc.text(`GSTIN: ${s.gstin}`);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(16).text('Tax Invoice');
  doc.font('Helvetica').fontSize(10).text(`Invoice No: ${invoice.invoiceNumber}`);
  doc.text(`Date: ${invoice.issuedAt} UTC`);
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').text('Bill To:');
  doc.font('Helvetica').text(b.name);
  if (b.companyName) doc.text(b.companyName);
  if (b.address) doc.text(b.address);
  if (b.gstin) doc.text(`GSTIN: ${b.gstin}`);
  doc.text(`State: ${b.stateName} (${b.stateCode})`);
  doc.moveDown(0.5);

  const tableTop = doc.y;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Item', 48, tableTop);
  doc.text('Qty', 330, tableTop, { width: 40, align: 'right' });
  doc.text('Taxable', 400, tableTop, { width: 70, align: 'right' });
  doc.text('GST%', 475, tableTop, { width: 35, align: 'right' });
  doc.text('Total', 515, tableTop, { width: 55, align: 'right' });
  doc.moveTo(48, tableTop + 14).lineTo(570, tableTop + 14).stroke();
  doc.font('Helvetica').fontSize(9);
  let y = tableTop + 20;
  for (const it of invoice.items) {
    doc.text(it.productName, 48, y);
    doc.text(String(it.quantity), 330, y, { width: 40, align: 'right' });
    doc.text(rupee(it.taxableCents), 400, y, { width: 70, align: 'right' });
    doc.text(String(it.rate), 475, y, { width: 35, align: 'right' });
    doc.text(rupee(it.taxableCents + it.gst), 515, y, { width: 55, align: 'right' });
    y += 16;
  }
  doc.moveTo(48, y).lineTo(570, y).stroke();
  y += 14;
  doc.text(`Subtotal: ${rupee(invoice.totals.subtotalCents)}`, 380, y, { width: 190, align: 'right' });
  y += 14;
  if (invoice.totals.cgst > 0) {
    doc.text(`CGST: ${rupee(invoice.totals.cgst)}`, 380, y, { width: 190, align: 'right' });
    y += 14;
    doc.text(`SGST: ${rupee(invoice.totals.sgst)}`, 380, y, { width: 190, align: 'right' });
    y += 14;
  }
  if (invoice.totals.igst > 0) {
    doc.text(`IGST: ${rupee(invoice.totals.igst)}`, 380, y, { width: 190, align: 'right' });
    y += 14;
  }
  if (invoice.totals.discountCents > 0) {
    doc.text(`Promo discount (${invoice.totals.promoCode || ''}): -${rupee(invoice.totals.discountCents)}`, 380, y, { width: 190, align: 'right' });
    y += 14;
  }
  doc.font('Helvetica-Bold').text(`Grand Total: ${rupee(invoice.totals.totalCents)}`, 380, y, { width: 190, align: 'right' });
  y += 30;
  doc.font('Helvetica').fontSize(9);
  doc.text('Terms: Prices include GST. Goods once sold are not returnable except per our return policy.', 48, y);

  doc.end();
});

router.get('/my', requireAuth, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ orders: orders.map(buildOrderObject) });
});

module.exports = router;
module.exports.buildOrderObject = buildOrderObject;

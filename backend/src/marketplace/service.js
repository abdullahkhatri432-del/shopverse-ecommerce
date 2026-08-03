const bcrypt = require('bcryptjs');
const { openMarketplaceDb } = require('./db');
const { splitOrder, DEFAULTS } = require('./splits');
const rzp = require('./razorpayRoute');

const FEE_BORNE_BY = process.env.MARKETPLACE_FEE_BORNE_BY || DEFAULTS.feeBorneBy;
const DEFAULT_COMMISSION_BPS = Number(process.env.MARKETPLACE_COMMISSION_BPS || 1000);

const STATUS = {
  order: { pending: 'pending', paid: 'paid', cancelled: 'cancelled', refunded: 'refunded' },
  payment: { pending: 'pending', captured: 'captured', refunded: 'refunded', failed: 'failed' },
  transfer: { pending: 'pending', transferred: 'transferred', reversed: 'reversed', failed: 'failed' },
};

function createMarketplaceService({ db, razorpayClient } = {}) {
  const database = db || openMarketplaceDb();
  const client = razorpayClient !== undefined ? razorpayClient : rzp.getClient();
  const isMock = !client;

  function transaction(fn) {
    database.exec('BEGIN');
    try {
      const result = fn();
      database.exec('COMMIT');
      return result;
    } catch (err) {
      database.exec('ROLLBACK');
      throw err;
    }
  }

  const stmt = {
    userByEmail: database.prepare('SELECT * FROM users WHERE email = ?'),
    insertUser: database.prepare(
      "INSERT INTO users (role, name, email, password_hash, phone) VALUES ('vendor', ?, ?, ?, ?)"
    ),
    insertVendor: database.prepare(
      `INSERT INTO vendor_profiles
         (user_id, business_name, business_type, owner_name, gstin, pan, address, bank_account_no, ifsc, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    updateVendorRoute: database.prepare(
      'UPDATE vendor_profiles SET razo_account_id = ?, razo_fund_account_id = ?, status = ? WHERE id = ?'
    ),
    vendorById: database.prepare('SELECT * FROM vendor_profiles WHERE id = ?'),
    vendorByUser: database.prepare('SELECT * FROM vendor_profiles WHERE user_id = ?'),
    categoryById: database.prepare('SELECT * FROM categories WHERE id = ?'),
    productById: database.prepare('SELECT * FROM products WHERE id = ?'),
    insertProduct: database.prepare(
      `INSERT INTO products (vendor_id, category_id, name, description, price_cents, tax_rate_bps, stock, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
    ),
    decStock: database.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?'),
    insertOrder: database.prepare(
      `INSERT INTO orders (customer_id, status, subtotal_cents, tax_cents, total_cents, payment_method, payment_status, customer_name, customer_email, shipping_address)
       VALUES (?, 'pending', ?, ?, ?, 'razorpay', 'pending', ?, ?, ?)`
    ),
    updateOrderRzpId: database.prepare(
      "UPDATE orders SET razorpay_order_id = ? WHERE id = ?"
    ),
    insertOrderItem: database.prepare(
      `INSERT INTO order_items (order_id, product_id, vendor_id, product_name, price_cents, tax_cents, quantity, commission_bps, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    insertPayment: database.prepare(
      'INSERT INTO payments (order_id, amount_cents, status) VALUES (?, ?, ?)'
    ),
    insertTransfer: database.prepare(
      `INSERT INTO transfers (order_id, vendor_id, payment_id, amount_cents, fee_cents, platform_commission_cents, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ),
    orderById: database.prepare('SELECT * FROM orders WHERE id = ?'),
    orderByRzpOrderId: database.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?'),
    orderByPaymentId: database.prepare('SELECT * FROM orders WHERE razorpay_payment_id = ?'),
    paymentById: database.prepare('SELECT * FROM payments WHERE id = ?'),
    paymentByRzpId: database.prepare('SELECT * FROM payments WHERE razorpay_payment_id = ?'),
    updatePaymentCaptured: database.prepare(
      "UPDATE payments SET razorpay_payment_id = ?, status = 'captured', gateway_fee_cents = ?, gateway_fee_gst_cents = ?, captured_at = datetime('now') WHERE id = ?"
    ),
    updateOrderPaid: database.prepare(
      "UPDATE orders SET status = 'paid', payment_status = 'captured', razorpay_payment_id = ? WHERE id = ?"
    ),
    transferById: database.prepare('SELECT * FROM transfers WHERE id = ?'),
    pendingTransfersByOrder: database.prepare(
      "SELECT * FROM transfers WHERE order_id = ? AND status = 'pending'"
    ),
    updateTransfer: database.prepare(
      'UPDATE transfers SET razorpay_transfer_id = ?, status = ? WHERE id = ?'
    ),
    transferByRzpId: database.prepare('SELECT * FROM transfers WHERE razorpay_transfer_id = ?'),
    balanceByVendor: database.prepare(
      'INSERT INTO vendor_balances (vendor_id, available_cents, pending_cents, total_earned_cents) VALUES (?, 0, 0, 0) ON CONFLICT(vendor_id) DO NOTHING'
    ),
    getBalance: database.prepare('SELECT * FROM vendor_balances WHERE vendor_id = ?'),
    bumpBalance: database.prepare(
      'UPDATE vendor_balances SET available_cents = available_cents + ?, total_earned_cents = total_earned_cents + ? WHERE vendor_id = ?'
    ),
    reduceBalance: database.prepare(
      'UPDATE vendor_balances SET available_cents = available_cents - ?, total_earned_cents = total_earned_cents - ? WHERE vendor_id = ?'
    ),
    insertLedger: database.prepare(
      'INSERT INTO ledger_entries (order_id, vendor_id, account, direction, category, amount_cents, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ),
    ledger: database.prepare('SELECT * FROM ledger_entries ORDER BY id'),
    ordersForVendor: database.prepare(
      `SELECT o.id, o.status, o.payment_status, o.total_cents, o.created_at,
              oi.product_name, oi.price_cents, oi.quantity, oi.tax_cents
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.vendor_id = ?
       ORDER BY o.created_at DESC`
    ),
    insertWebhook: database.prepare(
      "INSERT INTO webhook_events (event_id, event_type, payload, status) VALUES (?, ?, ?, 'received')"
    ),
    webhookExists: database.prepare('SELECT id FROM webhook_events WHERE event_id = ?'),
    markWebhook: database.prepare(
      "UPDATE webhook_events SET status = 'processed', processed_at = datetime('now') WHERE event_id = ?"
    ),
  };

  function getCategoryCommission(categoryId) {
    const cat = stmt.categoryById.get(categoryId);
    return cat ? cat.commission_bps : DEFAULT_COMMISSION_BPS;
  }

  function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
  }

  async function registerVendor({ name, email, password, phone, business, bank, address }) {
    if (stmt.userByEmail.get(email)) throw Object.assign(new Error('Email already registered'), { status: 409 });
    const passwordHash = hashPassword(password);

    const userRes = stmt.insertUser.run(name, email, passwordHash, phone || '');
    const user = stmt.userByEmail.get(email);

    const account = await rzp.onboardVendor(client, {
      email,
      phone: phone || '9000000000',
      legalBusinessName: business.legalName,
      customerFacingName: business.customerFacingName || business.legalName,
      businessType: business.businessType || 'proprietorship',
      pan: business.pan,
      gstin: business.gstin,
      address,
    });

    const vendorRes = stmt.insertVendor.run(
      user.id,
      business.legalName,
      business.businessType || 'proprietorship',
      business.ownerName,
      business.gstin || '',
      business.pan || '',
      `${address.street1}, ${address.city}, ${address.state} ${address.postalCode}`,
      bank.accountNumber,
      bank.ifsc,
      account.kycRequired ? 'pending_kyc' : 'active'
    );
    const vendorId = Number(vendorRes.lastInsertRowid);

    const fundAccount = await rzp.addFundAccount(client, account.id, {
      name: bank.accountHolder,
      ifsc: bank.ifsc,
      accountNumber: bank.accountNumber,
      email,
      phone: phone || '9000000000',
    });

    stmt.updateVendorRoute.run(
      account.id,
      fundAccount.id,
      isMock ? 'active' : 'pending_kyc',
      vendorId
    );
    stmt.balanceByVendor.run(vendorId);

    return stmt.vendorById.get(vendorId);
  }

  function addProduct({ vendorId, categoryId, name, description, priceCents, taxRateBps = 1800, stock = 0 }) {
    const vendor = stmt.vendorById.get(vendorId);
    if (!vendor) throw Object.assign(new Error('Vendor not found'), { status: 404 });
    if (vendor.status !== 'active') throw Object.assign(new Error('Vendor is not active'), { status: 400 });
    if (!stmt.categoryById.get(categoryId)) throw Object.assign(new Error('Category not found'), { status: 400 });

    const res = stmt.insertProduct.run(
      vendorId,
      categoryId,
      name,
      description || '',
      priceCents,
      taxRateBps,
      stock
    );
    return stmt.productById.get(Number(res.lastInsertRowid));
  }

  function placeOrder({ customer, items, shipping }) {
    if (!Array.isArray(items) || items.length === 0) {
      throw Object.assign(new Error('Cart is empty'), { status: 400 });
    }

    // 1) Validate stock and snapshot prices + commission per line.
    const splitItems = items.map((it) => {
      const product = stmt.productById.get(Number(it.productId));
      if (!product || product.status !== 'active') {
        throw Object.assign(new Error(`Product #${it.productId} not found`), { status: 400 });
      }
      if (product.stock < it.quantity) {
        throw Object.assign(new Error(`Not enough stock for "${product.name}"`), { status: 400 });
      }
      const tax = Math.round((product.price_cents * product.tax_rate_bps) / 10000);
      return {
        vendorId: product.vendor_id,
        productId: product.id,
        productName: product.name,
        categoryId: product.category_id,
        priceCents: product.price_cents,
        taxCents: tax,
        quantity: it.quantity,
        commissionBps: getCategoryCommission(product.category_id),
      };
    });

    const split = splitOrder(splitItems, { feeBorneBy: FEE_BORNE_BY });

    // 2) Everything money-related happens in one transaction.
    const orderId = transaction(() => {
      const orderRes = stmt.insertOrder.run(
        customer && customer.id ? customer.id : null,
        split.subtotal,
        split.totalTax,
        split.totalPaid,
        (customer && customer.name) || '',
        (customer && customer.email) || '',
        shipping || ''
      );
      const orderId = Number(orderRes.lastInsertRowid);

      for (const it of splitItems) {
        stmt.insertOrderItem.run(
          orderId,
          it.productId,
          it.vendorId,
          it.productName,
          it.priceCents,
          it.taxCents,
          it.quantity,
          it.commissionBps,
          it.categoryId
        );
        stmt.decStock.run(it.quantity, it.productId, it.quantity);
      }

      const payRes = stmt.insertPayment.run(orderId, split.totalPaid, STATUS.payment.pending);
      const paymentId = Number(payRes.lastInsertRowid);

      for (const v of split.byVendor) {
        stmt.insertTransfer.run(
          orderId,
          v.vendorId,
          paymentId,
          v.payout, // net payout already excludes commission (+ fee if borne by seller)
          v.fee,
          v.commission
        );
      }

      stmt.insertLedger.run(orderId, null, 'platform', 'credit', 'order_sale', split.totalPaid, 'order', String(orderId));
      for (const v of split.byVendor) {
        stmt.insertLedger.run(orderId, v.vendorId, `vendor:${v.vendorId}`, 'credit', 'order_sale', v.payout + v.commission, 'order', String(orderId));
      }

      return orderId;
    });

    const order = stmt.orderById.get(orderId);

    // 3) Payment intent (no money moves here). Async-safe: creation can be retried.
    return rzp.createOrder(client, {
      amountCents: order.total_cents,
      receipt: `order_${order.id}`,
      notes: { order_id: String(order.id) },
    }).then((intent) => {
      stmt.updateOrderRzpId.run(intent.id, order.id);
      return { order, paymentIntent: intent };
    });
  }

  async function capturePayment({ paymentId: razorpayPaymentId, orderId, gatewayFeeCents = 0, gatewayFeeGstCents = 0 }) {
    let order = orderId ? stmt.orderById.get(orderId) : stmt.orderByPaymentId.get(razorpayPaymentId);
    if (!order) order = stmt.orderByRzpOrderId.get(razorpayPaymentId);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    if (order.payment_status === STATUS.payment.captured) return stmt.orderById.get(order.id);

    const payment = stmt.paymentByRzpId.get(razorpayPaymentId) || db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id);

    const doTx = transaction(() => {
      stmt.updatePaymentCaptured.run(
        razorpayPaymentId,
        gatewayFeeCents,
        gatewayFeeGstCents,
        payment.id
      );
      stmt.updateOrderPaid.run(razorpayPaymentId, order.id);
      if (FEE_BORNE_BY === 'platform' && gatewayFeeCents + gatewayFeeGstCents > 0) {
        stmt.insertLedger.run(order.id, null, 'platform', 'debit', 'gateway_fee', gatewayFeeCents + gatewayFeeGstCents, 'payment', razorpayPaymentId);
      }
      return order.id;
    });

    // 4) Split at the source: transfer each vendor's payout to their linked account.
    const pending = stmt.pendingTransfersByOrder.all(order.id);
    if (pending.length) {
      const transfers = await rzp.createPaymentTransfers(
        client,
        razorpayPaymentId,
        pending.map((t) => {
          const vendor = stmt.vendorById.get(t.vendor_id);
          return {
            account: vendor.razo_account_id,
            amount: t.amount_cents, // net payout (commission + seller-borne fee already deducted)
            fee: 0,
            notes: { order_id: String(order.id), vendor_id: String(t.vendor_id), transfer_id: String(t.id) },
          };
        })
      );

      const apply = transaction(() => {
        transfers.forEach((trf, i) => {
          const t = pending[i];
          stmt.updateTransfer.run(trf.id, STATUS.transfer.transferred, t.id);
          stmt.insertLedger.run(order.id, t.vendor_id, `vendor:${t.vendor_id}`, 'credit', 'transfer', t.amount_cents, 'transfer', trf.id);
          stmt.insertLedger.run(order.id, t.vendor_id, 'platform', 'credit', 'commission', t.platform_commission_cents, 'order', String(order.id));
          stmt.bumpBalance.run(t.amount_cents, t.amount_cents, t.vendor_id);
        });
      });

    }

    return stmt.orderById.get(order.id);
  }

  async function refundOrder({ orderId, reason = '', amountCents = null }) {
    const order = stmt.orderById.get(orderId);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    if (order.payment_status !== STATUS.payment.captured) {
      throw Object.assign(new Error('Order has no captured payment to refund'), { status: 400 });
    }
    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id);
    const refundAmount = amountCents || payment.amount_cents;

    const refund = await rzp.refundPayment(client, payment.razorpay_payment_id, {
      amountCents: amountCents,
      reverseAll: amountCents == null,
      notes: { order_id: String(order.id), reason },
    });

    const doTx = transaction(() => {
      stmt.insertLedger.run(order.id, null, 'platform', 'debit', 'refund', refundAmount, 'refund', refund.id);
      db.prepare(
        "INSERT INTO refunds (order_id, payment_id, razorpay_refund_id, amount_cents, status, reason) VALUES (?, ?, ?, ?, 'processed', ?)"
      ).run(order.id, payment.id, refund.id, refundAmount, reason);
      db.prepare("UPDATE payments SET status = 'refunded' WHERE id = ?").run(payment.id);
      db.prepare("UPDATE orders SET status = 'refunded', payment_status = 'refunded' WHERE id = ?").run(order.id);

      const transfers = db.prepare("SELECT * FROM transfers WHERE order_id = ? AND status = 'transferred'").all(order.id);
      for (const t of transfers) {
        db.prepare("UPDATE transfers SET status = 'reversed' WHERE id = ?").run(t.id);
        stmt.insertLedger.run(order.id, t.vendor_id, `vendor:${t.vendor_id}`, 'debit', 'refund', t.amount_cents, 'transfer', t.razorpay_transfer_id);
        stmt.reduceBalance.run(t.amount_cents, t.amount_cents, t.vendor_id);
      }
      return order.id;
    });

    return stmt.orderById.get(order.id);
  }

  function vendorBalance(vendorId) {
    const b = stmt.getBalance.get(vendorId);
    if (!b) return { vendorId, availableCents: 0, pendingCents: 0, totalEarnedCents: 0 };
    return {
      vendorId,
      availableCents: b.available_cents,
      pendingCents: b.pending_cents,
      totalEarnedCents: b.total_earned_cents,
    };
  }

  function getVendorByUser(userId) {
    return stmt.vendorByUser.get(userId);
  }

  function vendorOrders(vendorId) {
    return stmt.ordersForVendor.all(vendorId).map((r) => ({
      orderId: r.id,
      status: r.status,
      paymentStatus: r.payment_status,
      totalCents: r.total_cents,
      createdAt: r.created_at,
      product: r.product_name,
      quantity: r.quantity,
      lineTotalCents: (r.price_cents + r.tax_cents) * r.quantity,
    }));
  }

  function ledger() {
    return stmt.ledger.all();
  }

  function registerWebhook({ eventId, eventType, payload }) {
    if (stmt.webhookExists.get(eventId)) return false; // idempotent
    stmt.insertWebhook.run(eventId, eventType, JSON.stringify(payload));
    return true;
  }

  function markWebhookProcessed(eventId) {
    stmt.markWebhook.run(eventId);
  }

  return {
    db: database,
    isMock,
    registerVendor,
    addProduct,
    placeOrder,
    capturePayment,
    refundOrder,
    vendorBalance,
    getVendorByUser,
    vendorOrders,
    ledger,
    registerWebhook,
    markWebhookProcessed,
  };
}

module.exports = { createMarketplaceService, STATUS };

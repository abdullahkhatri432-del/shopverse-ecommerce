const express = require('express');
const crypto = require('node:crypto');
const { createMarketplaceService } = require('./service');

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

/**
 * RBAC middleware. `req.user` is populated by your auth middleware with
 * { id, role }. Scopes every vendor query by the JWT id.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
}

function verifyRazorpayWebhook(req, rawBody) {
  if (!WEBHOOK_SECRET) return false; // fail closed when secret not configured
  const signature = req.headers['x-razorpay-signature'] || '';
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

function createMarketplaceRouter(options = {}) {
  const service = createMarketplaceService(options);
  const router = express.Router();

  // Vendors must be approved before they can transact.
  router.post('/vendors/onboard', async (req, res) => {
    try {
      const vendor = await service.registerVendor(req.body || {});
      res.status(201).json({
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          status: vendor.status,
          razoAccountId: vendor.razo_account_id,
        },
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  router.get('/vendors/me', requireRole('vendor'), (req, res) => {
    try {
      const profile = service.db
        .prepare('SELECT * FROM vendor_profiles WHERE user_id = ?')
        .get(req.user.id);
      if (!profile) return res.status(404).json({ error: 'Vendor profile not found' });
      res.json({
        vendor: {
          id: profile.id,
          businessName: profile.business_name,
          status: profile.status,
          balance: service.vendorBalance(profile.id),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/vendors/:id/orders', requireRole('vendor', 'admin'), (req, res) => {
    try {
      if (req.user.role === 'vendor') {
        const vendor = service.getVendorByUser(req.user.id);
        if (!vendor || String(vendor.id) !== req.params.id) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
      res.json({ orders: service.vendorOrders(Number(req.params.id)) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/vendors/:id/balance', requireRole('vendor', 'admin'), (req, res) => {
    try {
      if (req.user.role === 'vendor') {
        const vendor = service.getVendorByUser(req.user.id);
        if (!vendor || String(vendor.id) !== req.params.id) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
      res.json({ balance: service.vendorBalance(Number(req.params.id)) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/products', requireRole('vendor', 'admin'), (req, res) => {
    try {
      const vendorId = req.user.role === 'admin' ? req.body.vendorId : service.getVendorByUser?.(req.user.id)?.id;
      if (!vendorId) return res.status(400).json({ error: 'Vendor id required' });
      const product = service.addProduct({ vendorId, ...req.body });
      res.status(201).json({ product });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  router.post('/checkout', requireRole('customer', 'admin'), async (req, res) => {
    try {
      const { items, shipping } = req.body || {};
      const result = await service.placeOrder({
        customer: { id: req.user?.id, name: req.body?.name || req.user?.name, email: req.body?.email || req.user?.email },
        items,
        shipping,
      });
      res.status(201).json({
        orderId: result.order.id,
        totalCents: result.order.total_cents,
        paymentIntent: result.paymentIntent,
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  router.post('/orders/:id/capture', requireRole('admin'), async (req, res) => {
    try {
      const { paymentId, gatewayFeeCents, gatewayFeeGstCents } = req.body || {};
      const order = await service.capturePayment({
        orderId: Number(req.params.id),
        paymentId,
        gatewayFeeCents,
        gatewayFeeGstCents,
      });
      res.json({ order });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  router.post('/orders/:id/refund', requireRole('admin'), async (req, res) => {
    try {
      const order = await service.refundOrder({
        orderId: Number(req.params.id),
        reason: req.body?.reason,
        amountCents: req.body?.amountCents,
      });
      res.json({ order });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  router.get('/admin/ledger', requireRole('admin'), (req, res) => {
    try {
      res.json({ ledger: service.ledger() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Razorpay webhook. Mount with express.raw for this path so the raw body
  // is available for signature verification: app.use('/marketplace/webhooks/razorpay', express.raw({ type: 'application/json' }), router)
  router.post('/webhooks/razorpay', (req, res) => {
    try {
      const event = req.body;
      const isRegistered = service.registerWebhook({
        eventId: String(event.id || ''),
        eventType: String(event.event || ''),
        payload: event,
      });
      if (!isRegistered) return res.json({ ok: true, processed: false }); // duplicate

      if (event.event === 'payment.captured' && event.payload?.payment?.entity?.id) {
        const p = event.payload.payment.entity;
        void service.capturePayment({
          paymentId: p.id,
          gatewayFeeCents: Math.round(Number(p.fee || 0)),
          gatewayFeeGstCents: Math.round(Number(p.tax || 0)),
        });
      }

      if (event.event === 'refund.processed' && event.payload?.refund?.entity?.id) {
        const r = event.payload.refund.entity;
        const orderRow = service.db
          .prepare('SELECT order_id FROM payments WHERE razorpay_payment_id = ?')
          .get(r.payment_id);
        if (orderRow) {
          void service.refundOrder({ orderId: orderRow.order_id, reason: 'webhook refund', amountCents: Math.round(Number(r.amount || 0)) });
        }
      }

      service.markWebhookProcessed(String(event.id));
      res.json({ ok: true, processed: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createMarketplaceRouter, requireRole };

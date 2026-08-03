# Marketplace reference module (Razorpay Route)

A self-contained reference implementation for turning ShopVerse into a
**multi-vendor marketplace** with automated commission + Razorpay Route
settlement. It does **not** touch the working store (`server.js`, existing
routes, or the store's database).

Design document: [`docs/MARKETPLACE.md`](../../docs/MARKETPLACE.md)

## Structure

```
marketplace/
├── db.js            # SQL schema (node:sqlite, portable to PostgreSQL)
├── splits.js        # commission / gateway fee / seller payout math (pure)
├── razorpayRoute.js # Razorpay Route API: linked accounts, transfers, refunds
├── service.js       # business logic: onboard, checkout, capture, refund, ledger
├── routes.js        # Express router + RBAC + webhook
└── demo.js          # runnable end-to-end demo (mock Razorpay)
```

## Quick start

```bash
cd backend
node src/marketplace/demo.js        # full flow with a mock Razorpay (no keys)
```

The demo walks through: two vendors onboard (linked + fund accounts created) →
they list products → a customer places a multi-vendor order → payment is captured
and each vendor's payout is "transferred at the source" → balances/ledger print →
full refund reverses the splits.

## Mounting in Express

```js
const express = require('express');
const { createMarketplaceRouter } = require('./src/marketplace/routes');

// (1) auth middleware that sets req.user = { id, role } from your JWT
app.use('/marketplace', (req, res, next) => {
  /* resolve req.user here, then next(); 401 if missing */
  next();
});

// (2) webhooks need the RAW body for signature verification
app.post('/marketplace/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  createMarketplaceRouter()  // serves the /webhooks/razorpay handler
);

// (3) JSON router for everything else
app.use('/api/marketplace', express.json(), createMarketplaceRouter());
```

## Configuration (`.env`)

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | *(empty)* | Enables real Razorpay + Route; without them the module runs in **mock mode** |
| `RAZORPAY_WEBHOOK_SECRET` | *(empty)* | Signature verification for webhooks (fail-closed if unset) |
| `MARKETPLACE_COMMISSION_BPS` | `1000` | Fallback commission (10%) when a category has none set |
| `MARKETPLACE_FEE_BORNE_BY` | `platform` | `platform` (seller gets full taxable minus commission) or `seller` (gateway fee + GST also deducted from payout) |
| `MARKETPLACE_DB` | `:memory:` | File path for the marketplace DB (dev/demo) |

Per-category commission lives in the `categories.commission_bps` column
(e.g. Electronics 12%, Fashion 10%, Home 8%).

## Real Razorpay Route workflow

1. **Onboard** — `POST /api/marketplace/vendors/onboard` calls `accounts.create`
   to make a Linked Account, then `fundAccounts.create` to attach the vendor's
   bank account. Vendor stays `pending_kyc` until Razorpay approves them.
2. **Checkout** — `POST /api/marketplace/checkout` creates the order, the
   per-vendor pending `transfers` rows and the payment intent in one DB
   transaction.
3. **Capture** — on the `payment.captured` webhook (or
   `POST /api/marketplace/orders/:id/capture`) the service calls
   `payments.transfer(paymentId, transfers)` which splits the money **at the
   source**: each vendor's payout goes to their linked account, the platform
   keeps commissions. Transfers + balances are committed in a transaction.
4. **Refund** — `POST /api/marketplace/orders/:id/refund` calls
   `payments.refund(paymentId, { reverse_all: 1 })` (or a partial amount);
   Razorpay reverses the transfers and the service reverses local balances and
   writes `refund` ledger entries.

## Notes

- **KYC**: Razorpay blocks payouts until linked-account KYC completes; the
  service refuses to transfer to vendors whose status isn't `active`.
- **Gateway fee**: when `feeBorneBy = seller`, the fee is already netted out of
  the transferred amount (net-payout model) and recorded in `transfers.fee_cents`
  for reporting.
- **Idempotency**: webhook events are deduplicated via `webhook_events.event_id`.
- **Postgres**: the DDL is SQLite-flavored; swap `INTEGER PRIMARY KEY
  AUTOINCREMENT` → `SERIAL PRIMARY KEY` and `datetime('now')` → `now()`. Use real
  DB transactions (`BEGIN/COMMIT`) in production.

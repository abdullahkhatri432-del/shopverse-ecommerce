# Multi-Vendor Marketplace — System Architecture & Database Design

> Reference design for extending ShopVerse into a multi-vendor marketplace. The
> companion code lives in [`backend/src/marketplace/`](../backend/src/marketplace/README.md)
> and is **self-contained** — it does not modify the working store.

**Stack:** Node.js/Express · SQL (PostgreSQL in prod, SQLite for dev/demo via built-in
`node:sqlite`) · Razorpay + **Razorpay Route** (Marketplace Settlement).

---

## 1. High-level architecture

```
                     ┌───────────────────────────┐
                     │   React Frontend (SPA)    │
                     │  customer shop + vendor   │
                     │  dashboard + admin panel  │
                     └─────────────┬─────────────┘
                                   │ HTTPS /api
                                   ▼
                     ┌───────────────────────────┐
                     │      Express API GW       │
                     │ JWT auth + RBAC middleware│
                     │ (admin | vendor | customer)│
                     └──────┬──────────┬─────────┘
              ┌─────────────┤          ├──────────────┐
              ▼             ▼          ▼              ▼
        [Catalog]     [Orders/Checkout]  [Settlement]  [Admin]
        products/     order + split      transfers/    users/vendors
        categories    capture + refund   ledger        configs
              └─────────────┬──────────┘
                            ▼
                     ┌───────────────────────────┐
                     │   SQL DB (node:sqlite /   │
                     │        PostgreSQL)        │
                     │ users, vendors, products, │
                     │ orders, payments,         │
                     │ transfers, ledger, refunds│
                     └─────────────┬─────────────┘
                                   │
              webhooks (payment.captured, refund.processed)
                                   ▼
                     ┌───────────────────────────┐
                     │   Razorpay + Route API    │
                     │  order/capture/transfers  │
                     │  refunds, vendor KYC      │
                     └─────────────┬─────────────┘
                                   ▼
                    Platform bank   │  Vendor linked bank accounts
                    (commissions,   │  (seller payouts, auto-settled)
                     gateway fees,  │
                     tax pass-through)
```

**Key design decisions**

| Decision | Rationale |
| -------- | --------- |
| SQL over MongoDB | Money (transfers, commissions, ledgers) needs ACID transactions; you cannot afford a partially-applied split. Use a relational DB. |
| Payments, Transfers, Refunds as first-class tables | Every rupee movement is auditable and reconcilable. |
| Denormalize `vendor_id`, price snapshots onto `order_items` | Products change after purchase; the order must reflect the deal at time of sale. |
| Ledger (double-entry log) | Reconcile Razorpay settlements against your records; the source of truth for vendor balances. |
| Amounts stored in paise (`INTEGER`) | Never use floats for money. |
| Webhooks + idempotency | Capture/refund events must be processed exactly once. |

---

## 2. Roles & access control (RBAC)

Single `users.role` column with route middleware — one table, three surfaces.

| Role | Can do | Cannot do |
| ---- | ------ | --------- |
| `admin` | Manage vendors (approve/reject/suspend), categories & commission rates, view all orders/transfers, view platform P&L, configure fees | Shop as a customer (separate concern, out of scope here) |
| `vendor` | Manage own products, own orders, own payouts/balance, own settlement reports | See other vendors' data; change commission; access admin APIs |
| `customer` | Browse, cart, checkout, view own orders | Vendor dashboard; admin APIs |

Middleware sketch (see reference `routes.js`):

```js
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
// vendor dashboard endpoints are scoped by req.user.id (owner) in every query.
```

**Multi-vendor data isolation rule:** every vendor-scoped query must include
`WHERE vendor_id = ?` from the JWT (`req.user.id`), not from request params.

---

## 3. Commission & payout model

### 3.1 The money flow (single item, worked example)

Settings (configurable, per-category commission supported):

| Setting | Value |
| ------- | ----- |
| Item price (taxable value) | ₹1,000.00 |
| GST rate | 18% (pass-through — remitted to government, not revenue) |
| Platform commission | **10%** of taxable value |
| Razorpay gateway fee | **2%** of the total charged |
| GST on gateway fee | **18%** of the gateway fee |
| Gateway fee borne by | `platform` (default) or `seller` |

```
Total charged to customer  = 1,000 + 180 (GST)                 = ₹1,180.00
Platform commission        = 10% × 1,000                       = ₹ 100.00
Gateway fee (2%)           = 2% × 1,180                        = ₹  23.60
GST on gateway fee         = 18% × 23.60                       = ₹   4.25
───────────────────────────────────────────────────────────────────────
Seller payout              = 1,000 − 100 − (fee if borne by seller)
                           = ₹900.00 (platform pays gateway fee)
                           = ₹872.15 (seller pays gateway fee)
Platform keeps             = commission 100 (+ GST pass-through to govt)
```

Razorpay Route settles `seller payout` into the vendor's linked account after capture;
the gateway fee is deducted from the **platform's** settlement by Razorpay.

### 3.2 Formulas

```
taxable        = Σ (unit_price_cents × qty)
tax            = Σ (unit_tax_cents × qty)
total_paid     = taxable + tax
commission     = round(taxable × commissionBps / 10000)
gateway_fee    = round(total_paid × gatewayFeeBps / 10000)
gateway_gst    = round(gateway_fee × gstOnFeeBps / 10000)
seller_payout  = taxable − commission − (feeBorneBy === 'seller' ? gateway_fee + gateway_gst : 0)
platform_rev   = commission + (feeBorneBy === 'platform' ? 0 : 0)   // fee always exits platform settlement
```

Commission is computed on the **taxable value** (GST is never part of a seller's income).
When `feeBorneBy = 'seller'`, pass `fee` on the Razorpay transfer so Razorpay deducts the
fee from the transfer itself.

### 3.3 Multi-vendor order

An order containing items from several vendors produces **one transfer per vendor**:

```
Order total ₹5,900 across 3 vendors
  ├─ transfer A  ₹1,080.00  → vendor A linked account
  ├─ transfer B  ₹  872.15  → vendor B linked account
  └─ transfer C  ₹  700.00  → vendor C linked account
Platform retains: commissions + tax pass-through (remits GST separately)
```

---

## 4. Database schema (SQL)

SQLite-flavored DDL (portable to PostgreSQL — swap `INTEGER PRIMARY KEY AUTOINCREMENT`
for `SERIAL PRIMARY KEY`, `datetime('now')` for `now()`). Implemented verbatim in
[`backend/src/marketplace/db.js`](../backend/src/marketplace/db.js).

```sql
-- ── Identity & RBAC ────────────────────────────────────────────────
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT NOT NULL DEFAULT 'customer',   -- admin | vendor | customer
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Vendor profiles + Razorpay Route identities ────────────────────
CREATE TABLE vendor_profiles (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id),
  business_name      TEXT NOT NULL,
  business_type      TEXT NOT NULL DEFAULT 'proprietorship',
  owner_name         TEXT NOT NULL,
  gstin              TEXT NOT NULL DEFAULT '',
  pan                TEXT NOT NULL DEFAULT '',
  address            TEXT NOT NULL DEFAULT '',
  bank_account_no    TEXT NOT NULL DEFAULT '',   -- store masked/encrypted in prod
  ifsc               TEXT NOT NULL DEFAULT '',
  razo_account_id    TEXT NOT NULL DEFAULT '',   -- Razorpay Route linked account
  razo_fund_account_id TEXT NOT NULL DEFAULT '', -- attached bank account
  status             TEXT NOT NULL DEFAULT 'pending_kyc', -- pending_kyc | active | suspended | rejected
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Catalog ────────────────────────────────────────────────────────
CREATE TABLE categories (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL UNIQUE,
  commission_bps     INTEGER NOT NULL DEFAULT 1000,  -- 1000 = 10%
  sort_order         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id     INTEGER NOT NULL REFERENCES vendor_profiles(id),
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_cents   INTEGER NOT NULL,      -- taxable value
  tax_rate_bps  INTEGER NOT NULL DEFAULT 1800, -- GST 18%
  stock         INTEGER NOT NULL DEFAULT 0,
  image_url     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | active | inactive
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Orders & payments ──────────────────────────────────────────────
CREATE TABLE orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id         INTEGER REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | paid | shipped | delivered | cancelled | refunded
  subtotal_cents      INTEGER NOT NULL DEFAULT 0,  -- taxable
  tax_cents           INTEGER NOT NULL DEFAULT 0,
  total_cents         INTEGER NOT NULL DEFAULT 0,
  payment_method      TEXT NOT NULL DEFAULT 'razorpay',
  payment_status      TEXT NOT NULL DEFAULT 'pending', -- pending | captured | refunded | failed
  razorpay_order_id   TEXT NOT NULL DEFAULT '',
  razorpay_payment_id TEXT NOT NULL DEFAULT '',
  customer_name       TEXT NOT NULL DEFAULT '',
  customer_email      TEXT NOT NULL DEFAULT '',
  shipping_address    TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_items (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id           INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id         INTEGER NOT NULL,
  vendor_id          INTEGER NOT NULL REFERENCES vendor_profiles(id), -- denormalized
  product_name       TEXT NOT NULL,          -- price snapshot
  price_cents        INTEGER NOT NULL,       -- unit price at time of sale
  tax_cents          INTEGER NOT NULL,       -- unit tax at time of sale
  quantity           INTEGER NOT NULL,
  commission_bps     INTEGER NOT NULL,       -- rate snapshot
  category_id        INTEGER NOT NULL
);

-- ── Settlement: payments, transfers, ledger, refunds ───────────────
CREATE TABLE payments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id            INTEGER NOT NULL REFERENCES orders(id),
  razorpay_payment_id TEXT NOT NULL DEFAULT '',
  amount_cents        INTEGER NOT NULL,
  gateway_fee_cents   INTEGER NOT NULL DEFAULT 0,
  gateway_fee_gst_cents INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | captured | refunded | failed
  captured_at         TEXT
);

CREATE TABLE transfers (          -- one row per vendor per order (Razorpay Route transfer)
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id              INTEGER NOT NULL REFERENCES orders(id),
  vendor_id             INTEGER NOT NULL REFERENCES vendor_profiles(id),
  payment_id            INTEGER NOT NULL REFERENCES payments(id),
  razorpay_transfer_id  TEXT NOT NULL DEFAULT '',
  amount_cents          INTEGER NOT NULL,      -- seller payout sent to vendor
  fee_cents             INTEGER NOT NULL DEFAULT 0, -- gateway fee if borne by seller
  platform_commission_cents INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'pending', -- pending | transferred | reversed | failed
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE refunds (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id            INTEGER NOT NULL REFERENCES orders(id),
  payment_id          INTEGER NOT NULL REFERENCES payments(id),
  razorpay_refund_id  TEXT NOT NULL DEFAULT '',
  amount_cents        INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'initiated', -- initiated | processed | failed
  reason              TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE vendor_balances (    -- running totals for the vendor dashboard
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id        INTEGER NOT NULL UNIQUE REFERENCES vendor_profiles(id),
  available_cents  INTEGER NOT NULL DEFAULT 0,  -- settled/transferable
  pending_cents    INTEGER NOT NULL DEFAULT 0,  -- captured but not yet settled
  total_earned_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE ledger_entries (     -- double-entry log; source of truth
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  order_id    INTEGER,
  vendor_id   INTEGER,
  account     TEXT NOT NULL,      -- 'platform' or 'vendor:<id>'
  direction   TEXT NOT NULL,      -- credit | debit
  category    TEXT NOT NULL,      -- order_sale | commission | gateway_fee | transfer | refund
  amount_cents INTEGER NOT NULL,
  ref_type    TEXT NOT NULL DEFAULT '',
  ref_id      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE webhook_events (     -- idempotency
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id         TEXT NOT NULL UNIQUE,
  event_type       TEXT NOT NULL,
  payload          TEXT NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'received', -- received | processed | failed
  processed_at     TEXT
);
```

**Referential integrity & money-safety rules**

1. Wrap *create-order → split → stock-decrement* in a DB **transaction**.
2. Wrap *capture → create transfers → update balances* in a transaction.
3. `order_items` price/tax/commission are **snapshots**; never read live product prices for money.
4. Never store floats; every money column is `INTEGER` paise.
5. Webhooks are processed idempotently via `webhook_events.event_id`.

---

## 5. Order lifecycle with splits

```
1. Vendor registers   → POST /marketplace/vendors/onboard
                          ├─ create user (role vendor) + vendor_profiles
                          ├─ Razorpay: create linked account (accounts.create)
                          └─ Razorpay: attach bank fund account (fundAccounts.create)
                             status = pending_kyc → active (once Razorpay KYC passes)

2. Customer buys      → POST /marketplace/checkout
                          ├─ [TX] validate stock → create order, order_items,
                          │       payments(pending), transfers(pending, per vendor),
                          │       ledger(order_sale), decrement stock
                          ├─ Razorpay: orders.create (payment intent)
                          └─ return { orderId, razorpayOrderId, key }

3. Customer pays      → Razorpay checkout modal → webhook payment.captured
                          ├─ [TX] mark order paid, payment captured
                          └─ record gateway_fee + its GST from webhook data

4. Split at source    → POST /api/marketplace/orders/:id/capture  (or in webhook)
                          ├─ Razorpay: payments.transfer(paymentId, [per-vendor transfers])
                          ├─ [TX] mark transfers transferred, credit vendor_balances,
                          └─ ledger(transfer) per vendor

5. Settlement         → Razorpay settles seller payouts to vendor bank accounts
                          (platform keeps commissions + tax pass-through)

6. Refund / cancel    → POST /api/marketplace/orders/:id/refund
                          ├─ Razorpay: payments.refund(paymentId, { reverse_all: 1 })
                          ├─ [TX] mark refunds + payment refunded, order cancelled,
                          │       transfers reversed, vendor_balances debited,
                          └─ ledger(refund)
```

> **Route transfers at source vs post-capture.** You can attach `transfers` when creating
> the Razorpay order, or (as shown) create transfers after `payment.captured` via
> `payments.transfer()`. Post-capture gives you the real payment id and amount, which is
> the safer pattern when amounts are computed from the actual charge.

---

## 6. API surface (reference)

| Method | Endpoint | Purpose | Auth |
| ------ | -------- | ------- | ---- |
| POST | `/marketplace/vendors/onboard` | Register vendor + create Razorpay linked/fund accounts | – |
| GET | `/marketplace/vendors/me` | Vendor dashboard summary (orders, balance) | vendor |
| POST | `/marketplace/checkout` | Create order + payment intent + pending split | customer |
| POST | `/marketplace/orders/:id/capture` | Mark paid, execute per-vendor transfers | admin/webhook |
| POST | `/marketplace/orders/:id/refund` | Refund + reverse splits | customer/admin |
| GET | `/marketplace/vendors/:id/balance` | Vendor available/pending/total | vendor |
| GET | `/marketplace/vendors/:id/orders` | Vendor's own orders | vendor |
| GET | `/marketplace/admin/ledger` | Full ledger / platform P&L | admin |
| POST | `/marketplace/webhooks/razorpay` | `payment.captured`, `refund.processed` | webhook |
| POST | `/marketplace/webhooks/verify` | Signature verification helper (see code) | – |

---

## 7. Security & compliance notes (India)

- **KYC before payout:** Razorpay Route requires linked-account KYC; block payouts until
  vendor `status = active`.
- **TDS:** Withhold 1% TDS (or 2% without PAN) on seller payouts > thresholds and report
  quarterly; keep ledger rows per payout for Form 26Q reporting.
- **GST:** `tax_cents` is pass-through — the marketplace remits it. Seller commission
  invoices are platform revenue.
- **Webhook security:** verify Razorpay `X-Razorpay-Signature` (HMAC-SHA256 with the webhook
  secret) and make handlers idempotent.
- **Data isolation:** all vendor queries scoped by JWT id; admin-only routes enforced by RBAC.
- **Money storage:** masked bank numbers at rest; consider encryption at rest in production.

---

## 8. Files in the reference implementation

| File | Purpose |
| ---- | ------- |
| `backend/src/marketplace/README.md` | How to run / mount / configure |
| `backend/src/marketplace/db.js` | Schema DDL (this document, verbatim) via `node:sqlite` |
| `backend/src/marketplace/splits.js` | Pure commission/fee/payout math |
| `backend/src/marketplace/razorpayRoute.js` | Razorpay Route API (linked account, fund account, transfers, refunds) with mock fallback |
| `backend/src/marketplace/service.js` | Business logic (onboard, placeOrder, capture, refund, balance, ledger) |
| `backend/src/marketplace/routes.js` | Express router wiring the service + RBAC |
| `backend/src/marketplace/demo.js` | Runnable end-to-end demo (mock Razorpay, in-memory DB) |

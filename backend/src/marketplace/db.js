const { DatabaseSync } = require('node:sqlite');

const DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    role          TEXT NOT NULL DEFAULT 'customer',
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendor_profiles (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id),
    business_name      TEXT NOT NULL,
    business_type      TEXT NOT NULL DEFAULT 'proprietorship',
    owner_name         TEXT NOT NULL,
    gstin              TEXT NOT NULL DEFAULT '',
    pan                TEXT NOT NULL DEFAULT '',
    address            TEXT NOT NULL DEFAULT '',
    bank_account_no    TEXT NOT NULL DEFAULT '',
    ifsc               TEXT NOT NULL DEFAULT '',
    razo_account_id    TEXT NOT NULL DEFAULT '',
    razo_fund_account_id TEXT NOT NULL DEFAULT '',
    status             TEXT NOT NULL DEFAULT 'pending_kyc',
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT NOT NULL UNIQUE,
    commission_bps     INTEGER NOT NULL DEFAULT 1000,
    sort_order         INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id     INTEGER NOT NULL REFERENCES vendor_profiles(id),
    category_id   INTEGER NOT NULL REFERENCES categories(id),
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    price_cents   INTEGER NOT NULL,
    tax_rate_bps  INTEGER NOT NULL DEFAULT 1800,
    stock         INTEGER NOT NULL DEFAULT 0,
    image_url     TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'draft',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id         INTEGER REFERENCES users(id),
    status              TEXT NOT NULL DEFAULT 'pending',
    subtotal_cents      INTEGER NOT NULL DEFAULT 0,
    tax_cents           INTEGER NOT NULL DEFAULT 0,
    total_cents         INTEGER NOT NULL DEFAULT 0,
    payment_method      TEXT NOT NULL DEFAULT 'razorpay',
    payment_status      TEXT NOT NULL DEFAULT 'pending',
    razorpay_order_id   TEXT NOT NULL DEFAULT '',
    razorpay_payment_id TEXT NOT NULL DEFAULT '',
    customer_name       TEXT NOT NULL DEFAULT '',
    customer_email      TEXT NOT NULL DEFAULT '',
    shipping_address    TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id           INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id         INTEGER NOT NULL,
    vendor_id          INTEGER NOT NULL REFERENCES vendor_profiles(id),
    product_name       TEXT NOT NULL,
    price_cents        INTEGER NOT NULL,
    tax_cents          INTEGER NOT NULL,
    quantity           INTEGER NOT NULL,
    commission_bps     INTEGER NOT NULL,
    category_id        INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id            INTEGER NOT NULL REFERENCES orders(id),
    razorpay_payment_id TEXT NOT NULL DEFAULT '',
    amount_cents        INTEGER NOT NULL,
    gateway_fee_cents   INTEGER NOT NULL DEFAULT 0,
    gateway_fee_gst_cents INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'pending',
    captured_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS transfers (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id              INTEGER NOT NULL REFERENCES orders(id),
    vendor_id             INTEGER NOT NULL REFERENCES vendor_profiles(id),
    payment_id            INTEGER NOT NULL REFERENCES payments(id),
    razorpay_transfer_id  TEXT NOT NULL DEFAULT '',
    amount_cents          INTEGER NOT NULL,
    fee_cents             INTEGER NOT NULL DEFAULT 0,
    platform_commission_cents INTEGER NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'pending',
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refunds (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id            INTEGER NOT NULL REFERENCES orders(id),
    payment_id          INTEGER NOT NULL REFERENCES payments(id),
    razorpay_refund_id  TEXT NOT NULL DEFAULT '',
    amount_cents        INTEGER NOT NULL,
    status              TEXT NOT NULL DEFAULT 'initiated',
    reason              TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendor_balances (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id          INTEGER NOT NULL UNIQUE REFERENCES vendor_profiles(id),
    available_cents    INTEGER NOT NULL DEFAULT 0,
    pending_cents      INTEGER NOT NULL DEFAULT 0,
    total_earned_cents INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    order_id    INTEGER,
    vendor_id   INTEGER,
    account     TEXT NOT NULL,
    direction   TEXT NOT NULL,
    category    TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    ref_type    TEXT NOT NULL DEFAULT '',
    ref_id      TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id         TEXT NOT NULL UNIQUE,
    event_type       TEXT NOT NULL,
    payload          TEXT NOT NULL DEFAULT '{}',
    status           TEXT NOT NULL DEFAULT 'received',
    processed_at     TEXT
  );

  INSERT OR IGNORE INTO categories (name, commission_bps, sort_order) VALUES
    ('Electronics', 1200, 1),
    ('Fashion', 1000, 2),
    ('Home', 800, 3),
    ('General', 1000, 4);
`;

function openMarketplaceDb({ file = process.env.MARKETPLACE_DB || ':memory:' } = {}) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(DDL);
  return db;
}

function toUser(row) {
  if (!row) return null;
  return { id: row.id, role: row.role, name: row.name, email: row.email };
}

module.exports = { openMarketplaceDb, DDL, toUser };

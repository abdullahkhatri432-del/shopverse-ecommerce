require('dotenv').config();
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    stock INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    country_of_origin TEXT NOT NULL DEFAULT 'India',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    cart_token TEXT UNIQUE,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS order_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'requested',
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'mock',
    customer_name TEXT NOT NULL DEFAULT '',
    customer_email TEXT NOT NULL DEFAULT '',
    customer_address TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    gstin TEXT NOT NULL DEFAULT '',
    billing_state TEXT NOT NULL DEFAULT '',
    invoice_number TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS product_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (product_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS newsletter_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Backfill the categories table from any existing products (and a default).
db.exec(`
  INSERT OR IGNORE INTO categories (name)
  SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '';
  INSERT OR IGNORE INTO categories (name) VALUES ('general');
`);

// Migrations for databases created before columns were added.
const orderColumns = db
  .prepare('PRAGMA table_info(orders)')
  .all()
  .map((c) => c.name);
const orderMigrations = {
  company_name: "ALTER TABLE orders ADD COLUMN company_name TEXT NOT NULL DEFAULT ''",
  gstin: "ALTER TABLE orders ADD COLUMN gstin TEXT NOT NULL DEFAULT ''",
  billing_state: "ALTER TABLE orders ADD COLUMN billing_state TEXT NOT NULL DEFAULT ''",
  invoice_number: 'ALTER TABLE orders ADD COLUMN invoice_number TEXT',
  discount_cents: 'ALTER TABLE orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0',
  promo_code: "ALTER TABLE orders ADD COLUMN promo_code TEXT NOT NULL DEFAULT ''",
};
for (const [col, sql] of Object.entries(orderMigrations)) {
  if (!orderColumns.includes(col)) db.exec(sql);
}

const itemColumns = db
  .prepare('PRAGMA table_info(order_items)')
  .all()
  .map((c) => c.name);
if (!itemColumns.includes('category')) {
  db.exec("ALTER TABLE order_items ADD COLUMN category TEXT NOT NULL DEFAULT 'general'");
}

const productColumns = db
  .prepare('PRAGMA table_info(products)')
  .all()
  .map((c) => c.name);
if (!productColumns.includes('country_of_origin')) {
  db.exec("ALTER TABLE products ADD COLUMN country_of_origin TEXT NOT NULL DEFAULT 'India'");
}
if (!productColumns.includes('mrp_cents')) {
  db.exec('ALTER TABLE products ADD COLUMN mrp_cents INTEGER');
  db.exec('UPDATE products SET mrp_cents = ROUND(price_cents * 1.25, -2) WHERE mrp_cents IS NULL');
}

function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price_cents / 100,
    priceCents: row.price_cents,
    mrp: row.mrp_cents ? row.mrp_cents / 100 : null,
    mrpCents: row.mrp_cents || null,
    discountPercent: row.mrp_cents && row.mrp_cents > row.price_cents
      ? Math.round(((row.mrp_cents - row.price_cents) / row.mrp_cents) * 100)
      : 0,
    imageUrl: row.image_url,
    category: row.category,
    stock: row.stock,
    featured: !!row.featured,
    countryOfOrigin: row.country_of_origin || 'India',
    createdAt: row.created_at,
  };
}

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

module.exports = { db, toProduct, toUser };

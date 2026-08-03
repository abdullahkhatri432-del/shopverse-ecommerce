const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

function seed() {
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
      'Store Admin',
      adminEmail,
      hash,
      'admin'
    );
    console.log('Created admin user:', adminEmail, 'with password:', adminPassword);
  }

  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count > 0) {
    console.log('Products already seeded (' + count + '). Skipping.');
    return;
  }

  const products = [
    {
      name: 'Wireless Over-Ear Headphones',
      description:
        'Premium noise-cancelling wireless headphones with 40-hour battery life, plush memory-foam ear cushions and crystal-clear sound. Perfect for music, calls and travel.',
      price_cents: 19900,
      category: 'Electronics',
      stock: 24,
      featured: 1,
      image_url:
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Minimalist Analog Watch',
      description:
        'A timeless minimalist analog watch with a genuine leather strap, sapphire-coated glass and water resistance up to 50m. A refined accessory for every outfit.',
      price_cents: 24900,
      category: 'Accessories',
      stock: 15,
      featured: 1,
      image_url:
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Classic Running Sneakers',
      description:
        'Lightweight running sneakers engineered for comfort and speed. Breathable mesh upper, responsive cushioning and a durable outsole for everyday miles.',
      price_cents: 12900,
      category: 'Footwear',
      stock: 40,
      featured: 1,
      image_url:
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Mirrorless Digital Camera',
      description:
        'Capture stunning photos and 4K video with this compact mirrorless camera. 24.2MP sensor, fast autofocus and a fold-out touchscreen for creators.',
      price_cents: 89900,
      category: 'Electronics',
      stock: 8,
      featured: 1,
      image_url:
        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Eau de Parfum 100ml',
      description:
        'A sophisticated unisex fragrance with notes of bergamot, cedarwood and amber. Long-lasting scent housed in an elegant glass bottle.',
      price_cents: 8990,
      category: 'Beauty',
      stock: 32,
      featured: 0,
      image_url:
        'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Scandinavian Lounge Chair',
      description:
        'A stylish mid-century lounge chair with a solid beechwood frame and soft boucle upholstery. Modern comfort that anchors any living space.',
      price_cents: 45900,
      category: 'Home',
      stock: 6,
      featured: 0,
      image_url:
        'https://images.unsplash.com/photo-1503602642458-232111445657?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Ultrabook Laptop 16GB',
      description:
        'A powerful ultraportable laptop with a 13-inch retina display, 16GB RAM, 512GB SSD and all-day battery. Built for work, study and creativity.',
      price_cents: 129900,
      category: 'Electronics',
      stock: 12,
      featured: 0,
      image_url:
        'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Polarized Aviator Sunglasses',
      description:
        'Classic aviator sunglasses with polarized UV400 lenses and a lightweight metal frame. Timeless style with glare-free clarity.',
      price_cents: 7490,
      category: 'Accessories',
      stock: 27,
      featured: 0,
      image_url:
        'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Smart Fitness Watch',
      description:
        'Track your workouts, heart rate and sleep with this smart fitness watch. GPS built in, 14-day battery and a bright AMOLED display.',
      price_cents: 15900,
      category: 'Electronics',
      stock: 19,
      featured: 0,
      image_url:
        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Handmade Ceramic Mug Set',
      description:
        'A set of four handmade stoneware mugs in earthy tones. Dishwasher and microwave safe, each piece is unique.',
      price_cents: 3490,
      category: 'Home',
      stock: 50,
      featured: 0,
      image_url:
        'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Gaming Mechanical Keyboard',
      description:
        'RGB backlit mechanical keyboard with hot-swappable switches, aluminum frame and low-latency wireless connection. Built for gaming and typing.',
      price_cents: 11900,
      category: 'Electronics',
      stock: 21,
      featured: 0,
      image_url:
        'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    },
    {
      name: 'Leather Weekender Duffle Bag',
      description:
        'A spacious full-grain leather duffle bag with brass hardware, a detachable shoulder strap and a padded laptop sleeve. Travel in style.',
      price_cents: 18900,
      category: 'Accessories',
      stock: 14,
      featured: 0,
      image_url:
        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
    },
  ];

  const insert = db.prepare(
    'INSERT INTO products (name, description, price_cents, image_url, category, stock, featured) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const p of products) {
    insert.run(p.name, p.description, p.price_cents, p.image_url, p.category, p.stock, p.featured);
  }
  console.log('Seeded', products.length, 'products.');

  const catCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (catCount === 0) {
    const rows = db.prepare('SELECT DISTINCT category FROM products').all();
    const insCat = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
    for (const r of rows) insCat.run(r.category);
    console.log('Seeded', rows.length, 'categories.');
  }
}

seed();

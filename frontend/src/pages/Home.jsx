import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import ProductCard from '../components/ProductCard';
import Skeleton from '../components/Skeleton';
import Seo from '../components/Seo';
import { getRecentlyViewed } from '../lib/recentlyViewed';

const TRUST = [
  { title: 'Free delivery', sub: 'On every order' },
  { title: 'Cash on delivery', sub: 'Pay at your door' },
  { title: '7-day returns', sub: 'Easy returns & refunds' },
  { title: 'GST invoices', sub: 'On every paid order' },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    Promise.all([api.get('/products/featured'), api.get('/products/categories')])
      .then(([f, c]) => {
        setFeatured(f.products);
        setCategories(c.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setRecent(getRecentlyViewed().slice(0, 8));
  }, []);

  return (
    <div>
      <Seo
        title="ShopVerse - Your Online Store"
        description="Shop the latest electronics, fashion and home goods at ShopVerse."
      />
      <section className="hero">
        <div className="hero-inner">
          <h1>Everything you love, delivered.</h1>
          <p>
            Discover curated electronics, accessories, home goods and more — all in one place.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary btn-lg">
              Shop now
            </Link>
            <Link to="/products" className="btn btn-outline btn-lg">
              Browse categories
            </Link>
          </div>
        </div>
      </section>

      <section className="container section trust-strip" aria-label="Store highlights">
        {TRUST.map((t) => (
          <div className="trust-item" key={t.title}>
            <strong>{t.title}</strong>
            <span>{t.sub}</span>
          </div>
        ))}
      </section>

      <section className="container section">
        <h2 className="section-title">Shop by category</h2>
        <div className="category-grid">
          {categories.map((cat) => (
            <Link key={cat} to={`/products?category=${encodeURIComponent(cat)}`} className="category-card">
              <span>{cat}</span>
              <span className="category-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2 className="section-title">Featured products</h2>
          <Link to="/products" className="link">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="product-grid" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="product-card" key={i}>
                <Skeleton style={{ aspectRatio: '4 / 3' }} />
                <div className="product-body">
                  <Skeleton style={{ width: '40%', height: 12 }} />
                  <Skeleton style={{ width: '80%', height: 16 }} />
                  <Skeleton style={{ width: '60%', height: 16 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="product-grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2 className="section-title">Recently viewed</h2>
            <Link to="/products" className="link">
              Shop more
            </Link>
          </div>
          <div className="product-grid">
            {recent.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

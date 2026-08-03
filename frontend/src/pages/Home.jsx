import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import ProductCard from '../components/ProductCard';
import Seo from '../components/Seo';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/products/featured'), api.get('/products/categories')])
      .then(([f, c]) => {
        setFeatured(f.products);
        setCategories(c.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
          <div className="page-loading">Loading products...</div>
        ) : (
          <div className="product-grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import BannerSlider from '../components/BannerSlider';
import OfferBanner from '../components/OfferBanner';
import ProductSlider from '../components/ProductSlider';
import Skeleton from '../components/Skeleton';
import Seo from '../components/Seo';
import { getRecentlyViewed } from '../lib/recentlyViewed';

const TRUST = [
  { title: 'Free delivery', sub: 'On every order' },
  { title: 'Cash on delivery', sub: 'Pay at your door' },
  { title: '7-day returns', sub: 'Easy returns & refunds' },
  { title: 'GST invoices', sub: 'On every paid order' },
];

function SliderSkeleton() {
  return (
    <div className="slider" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div className="product-card" key={i} style={{ width: 280, flexShrink: 0 }}>
          <Skeleton style={{ aspectRatio: '4 / 3' }} />
          <div className="product-body">
            <Skeleton style={{ width: '40%', height: 12 }} />
            <Skeleton style={{ width: '80%', height: 16 }} />
            <Skeleton style={{ width: '60%', height: 16 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [topPicks, setTopPicks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/products/featured'),
      api.get('/products?sort=price_desc&limit=10'),
      api.get('/products/categories'),
    ])
      .then(([f, t, c]) => {
        setFeatured(f.products);
        setTopPicks(t.products);
        setCategories(c.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setRecent(getRecentlyViewed().slice(0, 10));
  }, []);

  return (
    <div>
      <Seo
        title="ShopVerse - Your Online Store"
        description="Shop the latest electronics, fashion and home goods at ShopVerse."
      />
      <BannerSlider />

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

      {loading ? (
        <div className="container section">
          <Skeleton style={{ width: 200, height: 24, marginBottom: 20 }} />
          <SliderSkeleton />
        </div>
      ) : (
        <ProductSlider title="Featured products" viewAll="/products" products={featured} />
      )}

      <div className="container section">
        <OfferBanner />
      </div>

      {loading ? (
        <div className="container section">
          <Skeleton style={{ width: 200, height: 24, marginBottom: 20 }} />
          <SliderSkeleton />
        </div>
      ) : (
        <ProductSlider title="Top picks" viewAll="/products?sort=price_desc" products={topPicks} />
      )}

      {recent.length > 0 && (
        <ProductSlider title="Recently viewed" viewAll="/products" products={recent} />
      )}
    </div>
  );
}

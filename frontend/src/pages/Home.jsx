import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import BannerSlider from '../components/BannerSlider';
import OfferBanner from '../components/OfferBanner';
import ProductSlider from '../components/ProductSlider';
import Skeleton from '../components/Skeleton';
import Seo from '../components/Seo';
import StarRating from '../components/StarRating';
import ProductCard from '../components/ProductCard';
import { getRecentlyViewed } from '../lib/recentlyViewed';

const TRUST = [
  { title: 'Free delivery', sub: 'On every order' },
  { title: 'Cash on delivery', sub: 'Pay at your door' },
  { title: '7-day returns', sub: 'Easy returns & refunds' },
  { title: 'GST invoices', sub: 'On every paid order' },
];

const TESTIMONIALS = [
  {
    text: "ShopVerse has become my go-to for electronics. The prices are great, delivery is fast, and the customer support actually responds!",
    author: "Priya Sharma",
    role: "Verified buyer",
    avatar: "PS",
  },
  {
    text: "I love the COD option - it makes ordering stress-free. Got my order in 2 days with proper GST invoice. Will order again.",
    author: "Rahul Mehta",
    role: "Verified buyer",
    avatar: "RM",
  },
  {
    text: "The return process was surprisingly smooth. Had to exchange a size, picked up next day and refund was instant. 5 stars!",
    author: "Anita Desai",
    role: "Verified buyer",
    avatar: "AD",
  },
];

const BRANDS = [
  "Samsung", "Apple", "Sony", "LG", "OnePlus", "Boat", "Noise", "JBL"
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

function GridSkeleton() {
  return (
    <div className="bundle-grid" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
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
  );
}

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [topPicks, setTopPicks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);
  const [activeTab, setActiveTab] = useState('bestsellers');

  useEffect(() => {
    Promise.all([
      api.get('/products/featured'),
      api.get('/products?sort=price_desc&limit=10'),
      api.get('/products/categories'),
      api.get('/products?limit=8'),
      api.get('/products?limit=8&sort=price_asc'),
      api.get('/products?limit=8&sort=price_desc'),
    ])
      .then(([f, t, c, b, n, tr]) => {
        setFeatured(f.products);
        setTopPicks(t.products);
        setCategories(c.categories);
        setBestSellers(b.products);
        setNewArrivals(n.products);
        setTrending(tr.products);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setRecent(getRecentlyViewed().slice(0, 10));
  }, []);

  const tabProducts = {
    bestsellers: bestSellers,
    new: newArrivals,
    trending: trending,
  }[activeTab] || [];

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

      {/* Testimonials */}
      <section className="container section" aria-label="Customer testimonials">
        <div className="section-head">
          <h2 className="section-title">What our customers say</h2>
        </div>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div className="testimonial-card" key={i}>
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <span className="testimonial-avatar">{t.avatar}</span>
                <div>
                  <strong>{t.author}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
              <div className="testimonial-rating">
                <StarRating value={5} size="sm" readonly />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="container section">
        <NewsletterCTA />
      </section>

      {/* Promo Banners */}
      <section className="container section" aria-label="Promotional offers">
        <div className="promo-banners-grid">
          <div className="promo-banner">
            <h3>Electronics Sale</h3>
            <p>Up to 40% off on smartphones, laptops & accessories</p>
            <Link to="/products?category=electronics" className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.2)', borderColor: '#fff', color: '#fff' }}>
              Shop now
            </Link>
          </div>
          <div className="promo-banner green">
            <h3>First Order Offer</h3>
            <p>Use code <strong>FIRST10</strong> for 10% off (up to ₹500)</p>
            <Link to="/products" className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.2)', borderColor: '#fff', color: '#fff' }}>
              Explore
            </Link>
          </div>
          <div className="promo-banner amber">
            <h3>Flash Deal - Ends Tonight</h3>
            <p>Select home appliances at flat 25% off. Limited stock!</p>
            <Link to="/products?category=home" className="btn btn-outline" style={{ background: 'rgba(255,255,255,0.2)', borderColor: '#fff', color: '#fff' }}>
              View deals
            </Link>
          </div>
        </div>
      </section>

      {/* Brand Bar */}
      <section className="container section">
        <div className="brand-bar" aria-label="Brands we carry">
          <span>Brands we carry:</span>
          {BRANDS.map((b, i) => (
            <span key={i}>{b}{i < BRANDS.length - 1 && ','}</span>
          ))}
        </div>
      </section>

      {/* Tabbed Product Grid */}
      <section className="container section" aria-label="Product collections">
        <div className="section-head">
          <h2 className="section-title">Shop collections</h2>
          <div className="tab-tabs" role="tablist" aria-label="Product collections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'bestsellers'}
              className={`tab-btn ${activeTab === 'bestsellers' ? 'active' : ''}`}
              onClick={() => setActiveTab('bestsellers')}
            >
              Best Sellers
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'new'}
              className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
              onClick={() => setActiveTab('new')}
            >
              New Arrivals
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'trending'}
              className={`tab-btn ${activeTab === 'trending' ? 'active' : ''}`}
              onClick={() => setActiveTab('trending')}
            >
              Trending
            </button>
          </div>
        </div>
        {loading ? (
          <GridSkeleton />
        ) : (
          <div className="bundle-grid">
            {tabProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <ProductSlider title="Recently viewed" viewAll="/products" products={recent} />
      )}
    </div>
  );
}

function NewsletterCTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post('/newsletter', { email: email.trim() });
      setStatus({ type: 'success', text: data.message });
      setEmail('');
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="newsletter-cta" aria-label="Newsletter signup">
      <h2>Stay updated with offers</h2>
      <p>Get exclusive deals, new arrivals, and early access to sales. No spam, unsubscribe anytime.</p>
      <form onSubmit={handleSubmit} className="newsletter-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          aria-label="Email address"
          disabled={submitting}
        />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '...' : 'Subscribe'}
        </button>
      </form>
      {status && (
        <p className={`newsletter-note ${status.type === 'success' ? 'success' : ''}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
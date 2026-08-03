import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrefersReducedMotion } from '../lib/hooks';

const BANNERS = [
  {
    id: 1,
    tag: 'Mid-season sale',
    title: 'Up to 40% off electronics',
    subtitle: 'Headphones, wearables and accessories at their best prices.',
    cta: 'Shop the sale',
    to: '/products',
    theme: 'indigo',
  },
  {
    id: 2,
    tag: 'New arrivals',
    title: 'Fresh drops every week',
    subtitle: 'Be the first to see our newest products across categories.',
    cta: 'Explore new arrivals',
    to: '/products?sort=newest',
    theme: 'violet',
  },
  {
    id: 3,
    tag: 'Free delivery + COD',
    title: 'Pay when it arrives',
    subtitle: 'Free shipping on every order, and pay at your door with COD.',
    cta: 'Start shopping',
    to: '/products',
    theme: 'emerald',
  },
  {
    id: 4,
    tag: '7-day returns',
    title: 'Shop with confidence',
    subtitle: 'Easy returns and refunds, plus a GST invoice on every paid order.',
    cta: 'See how it works',
    to: '/refunds',
    theme: 'amber',
  },
];

export default function BannerSlider() {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reduced) return undefined;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % BANNERS.length);
    }, 5000);
    return () => clearInterval(t);
  }, [paused, reduced]);

  const go = (i) => setIndex((i + BANNERS.length) % BANNERS.length);

  return (
    <section
      className="banner-slider"
      aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="banner-viewport">
        <div
          className="banner-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {BANNERS.map((b) => (
            <div className={`banner-slide theme-${b.theme}`} key={b.id}>
              <div className="banner-content">
                <span className="banner-tag">{b.tag}</span>
                <h2 className="banner-title">{b.title}</h2>
                <p className="banner-subtitle">{b.subtitle}</p>
                <Link to={b.to} className="btn btn-primary btn-lg banner-cta">
                  {b.cta}
                </Link>
              </div>
              <div className="banner-art" aria-hidden="true">
                <svg viewBox="0 0 600 360" role="presentation">
                  <circle cx="480" cy="90" r="150" fill="currentColor" opacity="0.14" />
                  <circle cx="560" cy="280" r="90" fill="currentColor" opacity="0.1" />
                  <circle cx="120" cy="320" r="180" fill="currentColor" opacity="0.08" />
                  <circle cx="90" cy="70" r="60" fill="currentColor" opacity="0.12" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="slider-btn banner-arrow banner-prev"
        onClick={() => go(index - 1)}
        aria-label="Previous offer"
      >
        ‹
      </button>
      <button
        type="button"
        className="slider-btn banner-arrow banner-next"
        onClick={() => go(index + 1)}
        aria-label="Next offer"
      >
        ›
      </button>

      <div className="banner-dots" role="tablist" aria-label="Choose offer">
        {BANNERS.map((b, i) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show offer ${i + 1}`}
            className={`banner-dot ${i === index ? 'active' : ''}`}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </section>
  );
}

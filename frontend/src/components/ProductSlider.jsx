import { useRef } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';

export default function ProductSlider({ title, viewAll, products }) {
  const track = useRef(null);

  const scrollByCard = (dir) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector('.product-card');
    const w = card ? card.getBoundingClientRect().width + 24 : 300;
    el.scrollBy({ left: dir * w, behavior: 'smooth' });
  };

  return (
    <section className="container section" aria-label={title}>
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        {viewAll && (
          <Link to={viewAll} className="link">
            View all
          </Link>
        )}
      </div>
      <div className="slider">
        <button
          type="button"
          className="slider-btn slider-prev"
          onClick={() => scrollByCard(-1)}
          aria-label={`Scroll ${title} left`}
        >
          ‹
        </button>
        <div className="slider-track" ref={track}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <button
          type="button"
          className="slider-btn slider-next"
          onClick={() => scrollByCard(1)}
          aria-label={`Scroll ${title} right`}
        >
          ›
        </button>
      </div>
    </section>
  );
}

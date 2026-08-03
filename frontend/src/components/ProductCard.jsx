import { Link } from 'react-router-dom';
import { formatPrice } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import StarRating from './StarRating';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const { has, toggle } = useWishlist();
  const out = product.stock <= 0;
  const wished = has(product.id);

  return (
    <div className={`product-card ${wished ? 'wished' : ''}`}>
      <button
        type="button"
        className={`wish-btn ${wished ? 'active' : ''}`}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wished}
        onClick={(e) => {
          e.preventDefault();
          toggle(product);
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={wished ? 'currentColor' : 'none'} aria-hidden="true">
          <path
            d="M12 20.5s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.2a5.4 5.4 0 0 1 9.3 5.3c-2.3 4.4-9.3 9-9.3 9Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <Link to={`/product/${product.id}`} className="product-image-link">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src =
              'data:image/svg+xml;utf8,' +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#eef2f7"/><text x="50%" y="50%" font-family="sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">${product.name}</text></svg>`
              );
          }}
        />
      </Link>
      <div className="product-body">
        <span className="product-category">{product.category}</span>
        <Link to={`/product/${product.id}`} className="product-name">
          {product.name}
        </Link>
        {typeof product.avgRating === 'number' && product.reviewCount > 0 && (
          <span className="product-rating">
            <StarRating value={product.avgRating} size="sm" />
            <span className="rating-count">({product.reviewCount})</span>
          </span>
        )}
        <div className="product-foot">
          <span className="product-price">{formatPrice(product.priceCents)}</span>
          <button
            className="btn btn-sm btn-primary"
            disabled={out}
            onClick={(e) => {
              e.preventDefault();
              add(product);
            }}
          >
            {out ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
        <p className="product-tax-note">Inclusive of all taxes (GST)</p>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { formatPrice } from '../lib/api';
import { useCart } from '../context/CartContext';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const out = product.stock <= 0;

  return (
    <div className="product-card">
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

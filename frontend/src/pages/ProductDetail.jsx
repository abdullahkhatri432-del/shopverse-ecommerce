import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Seo from '../components/Seo';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const { push } = useToast();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api
      .get(`/products/${id}`)
      .then((d) => {
        setProduct(d.product);
        setQty(1);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAdd = () => {
    if (!product) return;
    add(product, qty);
    push(`${product.name} added to cart`);
    navigate('/cart');
  };

  if (loading) return <div className="page-loading">Loading...</div>;
  if (notFound || !product)
    return (
      <div className="container section empty-state">
        <p>Product not found.</p>
        <Link to="/products" className="btn btn-primary">
          Back to shop
        </Link>
      </div>
    );

  const out = product.stock <= 0;

  return (
    <div className="container section">
      <Seo
        title={`${product.name} - ShopVerse`}
        description={product.description?.slice(0, 160) || `${product.name} at ShopVerse.`}
        type="product"
      />
      <Link to="/products" className="link back-link">
        ← Back to shop
      </Link>
      <div className="detail-layout">
        <div className="detail-image">
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src =
                'data:image/svg+xml;utf8,' +
                encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="100%" height="100%" fill="#eef2f7"/><text x="50%" y="50%" font-family="sans-serif" font-size="22" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">${product.name}</text></svg>`
                );
            }}
          />
        </div>
        <div className="detail-info">
          <span className="product-category">{product.category}</span>
          <h1 className="detail-title">{product.name}</h1>
          <p className="detail-price">{formatPrice(product.priceCents)}</p>
          <p className="detail-tax-note">Inclusive of all taxes (GST)</p>
          <p className="detail-desc">{product.description}</p>
          <p className="detail-meta">
            <span>
              <strong>Country of origin:</strong> {product.countryOfOrigin || 'India'}
            </span>
          </p>
          <p className={`stock-badge ${out ? 'out' : ''}`}>
            {out ? 'Out of stock' : `${product.stock} in stock`}
          </p>
          <div className="detail-actions">
            <div className="qty-selector">
              <button
                disabled={qty <= 1}
                onClick={() => setQty((q) => q - 1)}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span>{qty}</span>
              <button
                disabled={qty >= product.stock}
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button className="btn btn-primary btn-lg" disabled={out} onClick={handleAdd}>
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

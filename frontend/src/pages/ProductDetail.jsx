import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { addRecentlyViewed } from '../lib/recentlyViewed';
import Skeleton from '../components/Skeleton';
import ProductSlider from '../components/ProductSlider';
import Seo from '../components/Seo';
import StarRating from '../components/StarRating';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const { push } = useToast();
  const { user } = useAuth();
  const { has, toggle } = useWishlist();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState({ avgRating: 0, reviewCount: 0 });
  const [related, setRelated] = useState([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState(null);

  const loadReviews = useCallback(() => {
    setReviewsLoading(true);
    api
      .get(`/products/${id}/reviews`)
      .then((d) => {
        setReviews(d.reviews);
        setRating({ avgRating: d.avgRating, reviewCount: d.reviewCount });
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api
      .get(`/products/${id}`)
      .then((d) => {
        setProduct(d.product);
        setQty(1);
        setRating({ avgRating: d.product.avgRating || 0, reviewCount: d.product.reviewCount || 0 });
        addRecentlyViewed(d.product);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    loadReviews();
  }, [id, loadReviews]);

  useEffect(() => {
    api
      .get(`/products/related/${id}`)
      .then((d) => setRelated(d.products))
      .catch(() => {});
  }, [id]);

  const handleAdd = () => {
    if (!product) return;
    add(product, qty);
    push(`${product.name} added to cart`);
    navigate('/cart');
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!myRating) {
      setReviewMsg({ type: 'error', text: 'Please select a star rating.' });
      return;
    }
    setSubmitting(true);
    setReviewMsg(null);
    try {
      const d = await api.post(
        `/products/${id}/reviews`,
        { rating: myRating, comment: myComment },
        { auth: true }
      );
      setReviews((prev) => [d.review, ...prev]);
      setRating({ avgRating: d.avgRating, reviewCount: d.reviewCount });
      setMyRating(0);
      setMyComment('');
      setReviewMsg({ type: 'success', text: 'Thanks! Your review has been published.' });
    } catch (err) {
      setReviewMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container section">
        <div className="detail-layout">
          <Skeleton style={{ aspectRatio: '4 / 3' }} />
          <div className="detail-info">
            <Skeleton style={{ width: '30%', height: 14 }} />
            <Skeleton style={{ width: '70%', height: 30 }} />
            <Skeleton style={{ width: '40%', height: 26 }} />
            <Skeleton style={{ width: '100%', height: 60 }} />
            <Skeleton style={{ width: '60%', height: 44 }} />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="container section empty-state">
        <h2 className="empty-state-title">Product not found</h2>
        <p className="empty-state-sub">It may have been removed or is no longer available.</p>
        <Link to="/products" className="btn btn-primary">
          Back to shop
        </Link>
      </div>
    );
  }

  const out = product.stock <= 0;
  const wished = has(product.id);

  return (
    <div className="container section">
      <Seo
        title={`${product.name} - ShopVerse`}
        description={product.description?.slice(0, 160) || `${product.name} at ShopVerse.`}
        type="product"
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/products">Shop</Link>
        <span aria-hidden="true">/</span>
        <span className="breadcrumbs-current">{product.name}</span>
      </nav>
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
          {rating.reviewCount > 0 && (
            <span className="detail-rating">
              <StarRating value={rating.avgRating} size="sm" />
              <span className="rating-count">
                {rating.reviewCount} review{rating.reviewCount === 1 ? '' : 's'}
              </span>
            </span>
          )}
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
            <button
              type="button"
              className={`wish-btn wish-btn-lg ${wished ? 'active' : ''}`}
              aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={wished}
              onClick={() => toggle(product)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={wished ? 'currentColor' : 'none'} aria-hidden="true">
                <path
                  d="M12 20.5s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.2a5.4 5.4 0 0 1 9.3 5.3c-2.3 4.4-9.3 9-9.3 9Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <section className="reviews" aria-label="Product reviews">
        <div className="section-head">
          <h2 className="section-title">
            Reviews {rating.reviewCount > 0 && `(${rating.reviewCount})`}
          </h2>
        </div>

        {user && (
          <form className="review-form" onSubmit={submitReview}>
            <h3>Write a review</h3>
            {reviewMsg && (
              <p className={`notice ${reviewMsg.type === 'error' ? 'notice-error' : 'notice-success'}`}>
                {reviewMsg.text}
              </p>
            )}
            <StarRating value={myRating} onChange={setMyRating} />
            <textarea
              rows={3}
              maxLength={500}
              placeholder="What did you like or dislike? (optional)"
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
            />
            <button className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit review'}
            </button>
          </form>
        )}

        {!user && (
          <p className="review-login-hint">
            <Link to="/login">Sign in</Link> to review this product.
          </p>
        )}

        {reviewsLoading ? (
          <div className="reviews-list" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <div className="review-card" key={i}>
                <Skeleton style={{ width: '30%', height: 14 }} />
                <Skeleton style={{ width: '90%', height: 14 }} />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="reviews-empty">No reviews yet. Be the first to share your experience.</p>
        ) : (
          <div className="reviews-list">
            {reviews.map((r) => (
              <div className="review-card" key={r.id}>
                <div className="review-head">
                  <StarRating value={r.rating} size="sm" />
                  <span className="review-author">{r.userName}</span>
                  <span className="review-date">{r.createdAt}</span>
                </div>
                {r.comment && <p className="review-comment">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {related.length > 0 && (
        <ProductSlider
          title="You might also like"
          viewAll={`/products?category=${encodeURIComponent(product.category)}`}
          products={related}
        />
      )}
    </div>
  );
}

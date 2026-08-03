import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { api, formatPrice } from '../lib/api';
import ProductSlider from '../components/ProductSlider';
import EmptyState from '../components/EmptyState';
import Seo from '../components/Seo';

export default function Cart() {
  const { items, count, subtotal, setQuantity, remove, clear } = useCart();
  const { items: wishItems } = useWishlist();
  const [pincode, setPincode] = useState('');
  const [checking, setChecking] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const [deliveryError, setDeliveryError] = useState('');
  const [recommended, setRecommended] = useState([]);

  const excludeIds = items.map((i) => i.productId).join(',');

  useEffect(() => {
    api
      .get(`/products/recommend?limit=8&exclude=${excludeIds}`)
      .then((d) => setRecommended(d.products))
      .catch(() => {});
  }, [excludeIds]);

  if (items.length === 0) {
    return (
      <div className="container section">
        <Seo title="Your cart - ShopVerse" description="Your cart is empty." />
        <EmptyState
          title="Your cart is empty"
          subtitle={
            wishItems.length > 0
              ? 'You saved some items for later — move them to your cart.'
              : 'Looks like you have not added anything yet.'
          }
        >
          <div className="empty-actions">
            <Link to={wishItems.length > 0 ? '/wishlist' : '/products'} className="btn btn-primary btn-lg">
              {wishItems.length > 0 ? 'Go to wishlist' : 'Start shopping'}
            </Link>
            {wishItems.length > 0 && (
              <Link to="/products" className="btn btn-outline btn-lg">
                Browse products
              </Link>
            )}
          </div>
        </EmptyState>
      </div>
    );
  }

  const checkDelivery = async () => {
    if (!/^[1-9][0-9]{5}$/.test(pincode.trim())) {
      setDeliveryError('Enter a valid 6-digit Indian pincode.');
      setDelivery(null);
      return;
    }
    setChecking(true);
    setDeliveryError('');
    try {
      const data = await api.post('/shipping/check', { pincode: pincode.trim() });
      setDelivery(data);
    } catch (err) {
      setDeliveryError(err.message);
      setDelivery(null);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="container section">
      <Seo title="Your cart - ShopVerse" description="Review your cart and proceed to checkout." />
      <div className="section-head">
        <h1 className="page-title">Your cart ({count} item{count === 1 ? '' : 's'})</h1>
        <button className="link" onClick={clear}>
          Clear cart
        </button>
      </div>
      <div className="cart-layout">
        <div className="cart-items">
          {items.map((i) => (
            <div className="cart-item" key={i.productId}>
              <Link to={`/product/${i.productId}`} className="cart-item-img">
                <img
                  src={i.imageUrl}
                  alt={i.name}
                  onError={(e) => {
                    e.currentTarget.src =
                      'data:image/svg+xml;utf8,' +
                      encodeURIComponent(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#eef2f7"/></svg>`
                      );
                  }}
                />
              </Link>
              <div className="cart-item-info">
                <Link to={`/product/${i.productId}`} className="cart-item-name">
                  {i.name}
                </Link>
                <span className="cart-item-price">{formatPrice(i.priceCents)} each</span>
                <div className="qty-selector">
                  <button onClick={() => setQuantity(i.productId, i.quantity - 1)} aria-label="Decrease">
                    −
                  </button>
                  <span>{i.quantity}</span>
                  <button onClick={() => setQuantity(i.productId, i.quantity + 1)} aria-label="Increase">
                    +
                  </button>
                </div>
              </div>
              <div className="cart-item-right">
                <span className="cart-item-total">{formatPrice(i.priceCents * i.quantity)}</span>
                <button className="link link-danger" onClick={() => remove(i.productId)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          <p className="product-tax-note">All prices are inclusive of all taxes (GST).</p>
        </div>
        <div className="cart-summary">
          <h3>Order summary</h3>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>Free</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          <div className="pincode-check">
            <label className="field">
              <span>Check delivery pincode</span>
              <div className="pincode-row">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder="110001"
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={checkDelivery}
                  disabled={checking}
                >
                  {checking ? '...' : 'Check'}
                </button>
              </div>
            </label>
            {deliveryError && <p className="notice notice-error">{deliveryError}</p>}
            {delivery && delivery.serviceable && (
              <p className="notice notice-success">
                Deliverable to {pincode} in {delivery.etaDays.min}–{delivery.etaDays.max} business
                days.
              </p>
            )}
            {delivery && !delivery.serviceable && (
              <p className="notice notice-warning">{delivery.error}</p>
            )}
          </div>

          <Link to="/checkout" className="btn btn-primary btn-lg btn-full">
            Proceed to checkout
          </Link>
        </div>
      </div>

      {recommended.length > 0 && (
        <ProductSlider title="Frequently bought together" viewAll="/products" products={recommended} />
      )}
    </div>
  );
}

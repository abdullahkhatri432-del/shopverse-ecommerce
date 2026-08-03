import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { api, formatPrice, getConfig } from '../lib/api';

export default function CartDrawer() {
  const { items, count, subtotal, drawerOpen, closeCart, setQuantity, remove } = useCart();
  const { push } = useToast();
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [checking, setChecking] = useState(false);
  const drawerRef = useRef(null);

  const threshold = getConfig().freeShippingThresholdCents || 99900;
  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.min(100, Math.round((subtotal / threshold) * 100));
  const discountCents = promo ? promo.discountCents : 0;
  const payable = Math.max(0, subtotal - discountCents);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, closeCart]);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.focus();
  }, [drawerOpen]);

  useEffect(() => {
    setPromoInput('');
    setPromo(null);
    setPromoError('');
  }, [drawerOpen]);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setChecking(true);
    setPromoError('');
    try {
      const data = await api.post('/checkout/promo', { code, subtotalCents: subtotal });
      setPromo(data);
      setPromoInput('');
      push(`Promo applied: ${data.label}`);
    } catch (err) {
      setPromoError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const go = (path) => {
    closeCart();
    navigate(path);
  };

  return (
    <div
      className={`cart-drawer-overlay ${drawerOpen ? 'open' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeCart();
      }}
    >
      <aside
        className={`cart-drawer ${drawerOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        tabIndex={-1}
        ref={drawerRef}
      >
        <div className="cart-drawer-head">
          <h2>
            Your cart {count > 0 && <span className="cart-drawer-count">({count})</span>}
          </h2>
          <button className="icon-btn" onClick={closeCart} aria-label="Close cart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cart-drawer-empty">
            <p>Your cart is empty.</p>
            <button className="btn btn-primary" onClick={() => go('/products')}>
              Start shopping
            </button>
          </div>
        ) : (
          <>
            <div className="cart-drawer-shipping">
              {remaining > 0 ? (
                <p>
                  Add <strong>{formatPrice(remaining)}</strong> more for FREE shipping
                </p>
              ) : (
                <p className="cart-drawer-shipping-done">
                  You unlocked FREE shipping!
                </p>
              )}
              <div className="shipping-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="shipping-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ul className="cart-drawer-items">
              {items.map((i) => (
                <li className="cart-drawer-item" key={i.productId}>
                  <Link to={`/product/${i.productId}`} onClick={closeCart} className="cart-drawer-img">
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
                  <div className="cart-drawer-info">
                    <Link to={`/product/${i.productId}`} onClick={closeCart} className="cart-drawer-name">
                      {i.name}
                    </Link>
                    <span className="cart-drawer-price">{formatPrice(i.priceCents)}</span>
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
                  <div className="cart-drawer-right">
                    <span className="cart-drawer-line-total">{formatPrice(i.priceCents * i.quantity)}</span>
                    <button className="link link-danger" onClick={() => remove(i.productId)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="cart-drawer-promo">
              {promo ? (
                <div className="promo-applied">
                  <span>
                    {promo.label} applied
                    <small>−{formatPrice(promo.discountCents)}</small>
                  </span>
                  <button className="link" onClick={() => setPromo(null)}>
                    Remove
                  </button>
                </div>
              ) : (
                <div className="promo-input-row">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                    placeholder="Promo code (e.g. FIRST10)"
                    aria-label="Promo code"
                  />
                  <button className="btn btn-outline" onClick={applyPromo} disabled={checking || !promoInput.trim()}>
                    {checking ? '...' : 'Apply'}
                  </button>
                </div>
              )}
              {promoError && <p className="notice notice-error">{promoError}</p>}
            </div>

            <div className="cart-drawer-summary">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discountCents > 0 && (
                <div className="summary-row summary-discount">
                  <span>Promo discount</span>
                  <span>−{formatPrice(discountCents)}</span>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>Total</span>
                <span>{formatPrice(payable)}</span>
              </div>
            </div>

            <div className="cart-drawer-actions">
              <Link to="/cart" className="btn btn-outline btn-full" onClick={closeCart}>
                View cart
              </Link>
              <button className="btn btn-primary btn-full" onClick={() => go('/checkout')}>
                Checkout
              </button>
              <p className="product-tax-note">Shipping and taxes calculated at checkout</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

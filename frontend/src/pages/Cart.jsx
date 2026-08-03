import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/api';

export default function Cart() {
  const { items, count, subtotal, setQuantity, remove, clear } = useCart();

  if (items.length === 0) {
    return (
      <div className="container section empty-state">
        <h1>Your cart is empty</h1>
        <p>Looks like you haven't added anything yet.</p>
        <Link to="/products" className="btn btn-primary btn-lg">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container section">
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
          <Link to="/checkout" className="btn btn-primary btn-lg btn-full">
            Proceed to checkout
          </Link>
        </div>
      </div>
    </div>
  );
}

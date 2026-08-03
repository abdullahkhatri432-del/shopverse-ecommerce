import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatPrice } from '../lib/api';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');
  const mock = searchParams.get('mock') === '1';
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    api
      .post(`/orders/${orderId}/confirm`)
      .then((d) => setOrder(d.order))
      .catch(() => {});
  }, [orderId]);

  return (
    <div className="container section empty-state success-page">
      <div className="success-icon">✓</div>
      <h1>Order confirmed!</h1>
      <p>
        Thank you for your purchase{order ? ` — order #${order.id}` : ''} has been placed.
        {mock && ' (Demo checkout: no real payment was made.)'}
      </p>
      {order && (
        <div className="success-summary">
          {order.items.map((i) => (
            <div className="summary-line" key={i.id}>
              <span>
                {i.productName} × {i.quantity}
              </span>
              <span>{formatPrice(i.priceCents * i.quantity)}</span>
            </div>
          ))}
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{formatPrice(order.totalCents)}</span>
          </div>
        </div>
      )}
      <div className="hero-actions">
        <Link to="/products" className="btn btn-primary">
          Continue shopping
        </Link>
        <Link to="/account" className="btn btn-outline">
          View your orders
        </Link>
      </div>
    </div>
  );
}

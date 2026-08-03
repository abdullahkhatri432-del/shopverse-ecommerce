import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatPrice } from '../lib/api';
import Seo from '../components/Seo';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');
  const mock = searchParams.get('mock') === '1';
  const cod = searchParams.get('cod') === '1';
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
      <Seo title="Order confirmed - ShopVerse" description="Thank you for your purchase." />
      <div className="success-icon">✓</div>
      <h1>Order confirmed!</h1>
      <p>
        Thank you for your purchase{order ? ` — order #${order.id}` : ''} has been placed.
        {mock && ' (Demo checkout: no real payment was made.)'}
        {cod && ' (Cash on Delivery: pay when your order arrives.)'}
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
          {order.eta && (
            <p className="success-eta">
              Estimated delivery: <strong>{order.eta.min}</strong> –{' '}
              <strong>{order.eta.max}</strong>
            </p>
          )}
        </div>
      )}
      <div className="hero-actions">
        <Link to="/products" className="btn btn-primary">
          Continue shopping
        </Link>
        {order && order.status === 'paid' && (
          <>
            <Link to={`/invoice/${order.id}`} className="btn btn-outline">
              View GST invoice
            </Link>
            <a
              href={`/api/orders/${order.id}/invoice.pdf`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
            >
              Download PDF
            </a>
          </>
        )}
        <Link to="/account" className="btn btn-outline">
          View your orders
        </Link>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, formatPrice } from '../lib/api';
import Seo from '../components/Seo';

const NEXT_STEPS = [
  { title: 'We got your order', text: "You'll get a confirmation email with the details." },
  { title: 'We pack & ship it', text: 'Usually within 1–2 business days.' },
  { title: 'Track it to your door', text: 'Follow the status in your account, anytime.' },
];

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');
  const mock = searchParams.get('mock') === '1';
  const cod = searchParams.get('cod') === '1';
  const [order, setOrder] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    api
      .post(`/orders/${orderId}/confirm`)
      .then((d) => setOrder(d.order))
      .catch(() => setFailed(true));
  }, [orderId]);

  const status = failed ? 'error' : mock || cod ? 'cod' : order?.status === 'paid' ? 'paid' : 'processing';

  return (
    <div className="container section empty-state success-page">
      <Seo title="Order confirmed - ShopVerse" description="Thank you for your purchase." />
      <div className={`success-icon ${status === 'error' ? 'error' : ''}`}>✓</div>
      <h1>{status === 'error' ? 'Order placed' : 'Order confirmed!'}</h1>

      {status === 'paid' && (
        <p className="success-headline">
          Thank you for your purchase{order ? ` — order #${order.id}` : ''}. Your payment was received
          and your GST invoice is ready.
        </p>
      )}
      {status === 'cod' && (
        <p className="success-headline">
          Your order {order ? `#${order.id} ` : ''}has been placed.
          {cod && (
            <>
              <br />
              <strong>Please keep {order ? formatPrice(order.totalCents) : ''} cash ready</strong> when
              your order is delivered.
            </>
          )}
          {mock && ' (Demo checkout — no real payment was taken.)'}
        </p>
      )}
      {status === 'processing' && !mock && !cod && !order && (
        <p className="success-headline">Your order has been placed. We're confirming the payment now.</p>
      )}

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
              Estimated delivery: <strong>{order.eta.min}</strong> – <strong>{order.eta.max}</strong>
            </p>
          )}
        </div>
      )}

      <div className="next-steps">
        {NEXT_STEPS.map((s, i) => (
          <div className="next-step" key={s.title}>
            <span className="next-step-num">{i + 1}</span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="hero-actions">
        <Link to="/account" className="btn btn-primary">
          Track your order
        </Link>
        <Link to="/products" className="btn btn-outline">
          Continue shopping
        </Link>
        {order && (order.status === 'paid' || status === 'paid') && (
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
      </div>
      {!order && <p className="hint">Tip: sign in with the same email to see this order in your account.</p>}
    </div>
  );
}

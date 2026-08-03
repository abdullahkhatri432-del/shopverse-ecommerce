import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../lib/api';

const STATUS_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function Account() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/orders/my', { auth: true })
      .then((d) => setOrders(d.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container section">
      <h1 className="page-title">Your orders</h1>
      {loading ? (
        <div className="page-loading">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <p>You haven't placed any orders yet.</p>
          <Link to="/products" className="btn btn-primary">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((o) => (
            <div className="order-card" key={o.id}>
              <div className="order-head">
                <div>
                  <strong>Order #{o.id}</strong>
                  <span className="order-date">{o.createdAt}</span>
                </div>
                <div className="order-head-right">
                  <span className={`status-badge status-${o.status}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                  <span className="order-total">{formatPrice(o.totalCents)}</span>
                </div>
              </div>
              <div className="order-items">
                {o.items.map((i) => (
                  <div className="summary-line" key={i.id}>
                    <span>
                      {i.productName} × {i.quantity}
                    </span>
                    <span>{formatPrice(i.priceCents * i.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

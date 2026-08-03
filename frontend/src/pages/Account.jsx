import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../lib/api';
import OrderTracking from '../components/OrderTracking';
import Seo from '../components/Seo';

const STATUS_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  return_approved: 'Return approved',
  returned: 'Returned',
};

export default function Account() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = () => {
    api
      .get('/orders/my', { auth: true })
      .then((d) => setOrders(d.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const requestReturn = async (order, reason) => {
    if (!reason) return;
    if (!confirm(`Request a return for order #${order.id}? Reason: ${reason}`)) return;
    setBusy(order.id);
    try {
      await api.post(`/orders/${order.id}/return`, { reason }, { auth: true });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const cancelOrder = async (order) => {
    if (!confirm(`Cancel order #${order.id}?`)) return;
    setBusy(order.id);
    try {
      await api.post(`/orders/${order.id}/cancel`, {}, { auth: true });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container section">
      <Seo title="Your orders - ShopVerse" description="Track your ShopVerse orders and invoices." />
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

              {o.status !== 'cancelled' && <OrderTracking status={o.status} />}

              {o.eta && ['pending', 'paid', 'packed', 'shipped', 'out_for_delivery'].includes(o.status) && (
                <p className="order-eta">
                  Estimated delivery: {o.eta.min} – {o.eta.max}
                </p>
              )}

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

              <div className="order-actions">
                {o.status === 'paid' && o.invoiceNumber && (
                  <>
                    <Link to={`/invoice/${o.id}`} className="btn btn-sm btn-outline">
                      View GST invoice
                    </Link>
                    <a
                      href={`/api/orders/${o.id}/invoice.pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-outline"
                    >
                      Download PDF
                    </a>
                  </>
                )}
                {['pending', 'paid'].includes(o.status) && (
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={busy === o.id}
                    onClick={() => cancelOrder(o)}
                  >
                    Cancel order
                  </button>
                )}
                {o.returnEligible && (
                  <button
                    className="btn btn-sm btn-outline"
                    disabled={busy === o.id}
                    onClick={() => {
                      const reason = prompt('Why are you returning this order?');
                      requestReturn(o, reason);
                    }}
                  >
                    Request return
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

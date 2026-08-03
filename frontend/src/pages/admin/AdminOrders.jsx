import { useEffect, useState } from 'react';
import { api, formatPrice } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  const load = () => {
    setLoading(true);
    api
      .get('/admin/orders', { auth: true })
      .then((d) => setOrders(d.orders))
      .catch((err) => push(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateStatus = async (orderId, status) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status }, { auth: true });
      push(`Order #${orderId} marked as ${STATUS_LABELS[status]}`);
      load();
    } catch (err) {
      push(err.message, 'error');
    }
  };

  return (
    <div className="admin-content">
      <h2>Orders ({orders.length})</h2>
      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <p>No orders yet.</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((o) => (
            <div className="order-card" key={o.id}>
              <div className="order-head">
                <div>
                  <strong>Order #{o.id}</strong>
                  <span className="order-date">{o.createdAt}</span>
                  {o.customerName && <span className="order-date">· {o.customerName}</span>}
                  {o.customerEmail && <span className="order-date">· {o.customerEmail}</span>}
                </div>
                <div className="order-head-right">
                  <span className="order-total">{formatPrice(o.totalCents)}</span>
                  <select
                    value={o.status}
                    className="select-inline"
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
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
              {o.customerAddress && (
                <p className="order-address">Ship to: {o.customerAddress}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

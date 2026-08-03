import { useEffect, useState } from 'react';
import { api, formatPrice } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

const STATUSES = [
  'pending',
  'paid',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'return_requested',
  'return_approved',
  'returned',
  'cancelled',
];
const STATUS_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  return_requested: 'Return requested',
  return_approved: 'Return approved',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingInput, setTrackingInput] = useState({});
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

  const updateStatus = async (orderId, status, carrier, trackingNumber) => {
    try {
      const payload = { status };
      if (status === 'shipped') {
        payload.carrier = carrier;
        payload.tracking_number = trackingNumber;
      }
      await api.patch(`/admin/orders/${orderId}/status`, payload, { auth: true });
      push(`Order #${orderId} marked as ${STATUS_LABELS[status]}`);
      load();
    } catch (err) {
      push(err.message, 'error');
    }
  };

  const handleStatusChange = (order, newStatus) => {
    if (newStatus === 'shipped' && (!order.carrier || !order.trackingNumber)) {
      // Open tracking input modal
      setTrackingInput({ orderId: order.id, carrier: '', trackingNumber: '' });
      return;
    }
    updateStatus(order.id, newStatus);
  };

  const confirmShipped = (data) => {
    updateStatus(data.orderId, 'shipped', data.carrier, data.trackingNumber);
    setTrackingInput({});
  };

  const renderStatusSelect = (order) => {
    if (trackingInput.orderId === order.id) {
      return (
        <div className="tracking-input-modal">
          <div className="tracking-input-content">
            <h4>Enter tracking details for Order #{order.id}</h4>
            <label className="field">
              <span>Carrier (e.g., Delhivery, BlueDart)</span>
              <input
                type="text"
                value={trackingInput.carrier}
                onChange={(e) => setTrackingInput({ ...trackingInput, carrier: e.target.value })}
                placeholder="Delhivery"
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span>Tracking / AWB Number</span>
              <input
                type="text"
                value={trackingInput.trackingNumber}
                onChange={(e) => setTrackingInput({ ...trackingInput, trackingNumber: e.target.value })}
                placeholder="AWB123456789"
                required
              />
            </label>
            <div className="row-actions">
              <button className="btn btn-primary" onClick={() => confirmShipped(trackingInput)}>
                Confirm Shipped
              </button>
              <button className="btn btn-ghost" onClick={() => setTrackingInput({})}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <select
        value={order.status}
        className="select-inline"
        onChange={(e) => handleStatusChange(order, e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    );
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
                  {renderStatusSelect(o)}
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
              {(o.carrier || o.trackingNumber) && (
                <div className="order-tracking-info">
                  <strong>Tracking:</strong>
                  <span>{o.carrier} - {o.trackingNumber}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {trackingInput.orderId && (
        <div className="modal-overlay" onClick={() => setTrackingInput({})}>
          {renderStatusSelect(orders.find((o) => o.id === trackingInput.orderId))}
        </div>
      )}
    </div>
  );
}

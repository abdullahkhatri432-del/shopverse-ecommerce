import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api, formatPrice } from '../lib/api';
import { useToast } from '../context/ToastContext';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the payment gateway. Please try again.'));
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    address: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (items.length === 0) {
    return (
      <div className="container section empty-state">
        <h1>Nothing to check out</h1>
        <p>Your cart is empty. Add some products first.</p>
      </div>
    );
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const startRazorpay = async (data) => {
    try {
      await loadRazorpayScript();
    } catch (err) {
      setSubmitting(false);
      setError(err.message);
      return;
    }

    const options = {
      key: data.razorpayKeyId,
      amount: data.amount,
      currency: data.currency,
      name: 'ShopVerse',
      description: `Order #${data.orderId}`,
      order_id: data.razorpayOrderId,
      prefill: { name: form.name, email: form.email },
      theme: { color: '#4f46e5' },
      handler: async (response) => {
        try {
          await api.post('/checkout/verify', {
            orderId: data.orderId,
            razorpayOrderId: data.razorpayOrderId,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          clear();
          navigate(`/checkout/success?order=${data.orderId}`);
        } catch (err) {
          setSubmitting(false);
          setError('Payment could not be verified: ' + err.message);
        }
      },
      modal: {
        ondismiss: () => setSubmitting(false),
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setSubmitting(false);
      setError('Could not open the payment window: ' + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError('Please fill in your name and email.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await api.post('/checkout', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        customerName: form.name.trim(),
        customerEmail: form.email.trim(),
        customerAddress: form.address.trim(),
      });
      if (data.paymentMethod === 'razorpay') {
        startRazorpay(data);
      } else {
        clear();
        navigate(`/checkout/success?order=${data.orderId}&mock=1`);
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="container section">
      {searchParams.get('cancel') && (
        <div className="notice notice-warning">Payment was cancelled. You can try again.</div>
      )}
      <h1 className="page-title">Checkout</h1>
      <form onSubmit={handleSubmit} className="checkout-layout">
        <div className="checkout-form">
          <h3>Contact & shipping</h3>
          <label className="field">
            <span>Full name</span>
            <input value={form.name} onChange={set('name')} placeholder="Jane Doe" required />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="jane@example.com"
              required
            />
          </label>
          <label className="field">
            <span>Shipping address</span>
            <textarea
              value={form.address}
              onChange={set('address')}
              placeholder="123 Main Street, Springfield"
              rows={3}
            />
          </label>
          {error && <div className="notice notice-error">{error}</div>}
          <button className="btn btn-primary btn-lg btn-full" disabled={submitting}>
            {submitting ? 'Redirecting to payment...' : `Pay ${formatPrice(subtotal)}`}
          </button>
          <p className="hint">Secure checkout. Your payment is processed by Razorpay.</p>
        </div>
        <div className="cart-summary">
          <h3>Order summary</h3>
          {items.map((i) => (
            <div className="summary-line" key={i.productId}>
              <span>
                {i.name} × {i.quantity}
              </span>
              <span>{formatPrice(i.priceCents * i.quantity)}</span>
            </div>
          ))}
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
        </div>
      </form>
    </div>
  );
}

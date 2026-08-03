import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api, formatPrice, getConfig, getStore } from '../lib/api';
import { INDIA_STATES } from '../lib/india-states';
import { useToast } from '../context/ToastContext';
import Seo from '../components/Seo';

const STEPS = ['Details', 'Payment', 'Review'];
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M2 10h20M6 15h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CodIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 7h13v10H2V7Zm13 3h4l3 3v4h-7v-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

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

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    address: '',
    companyName: '',
    gstin: '',
    billingState: '',
  });
  const [errors, setErrors] = useState({});
  const [method, setMethod] = useState('online');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [priceChanged, setPriceChanged] = useState(false);
  const store = getStore();
  const config = getConfig();
  const codEnabled = config.codEnabled !== false;

  if (items.length === 0) {
    return (
      <div className="container section empty-state">
        <Seo title="Checkout - ShopVerse" description="Nothing to check out." />
        <h1>Nothing to check out</h1>
        <p>Your cart is empty. Add some products first.</p>
        <a href="/products" className="btn btn-primary btn-lg">
          Continue shopping
        </a>
      </div>
    );
  }

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Please enter your full name.';
    if (!form.email.trim()) e.email = 'Please enter your email address.';
    else if (!EMAIL_REGEX.test(form.email.trim())) e.email = 'That email address does not look valid.';
    if (!form.address.trim()) e.address = 'Please enter your delivery address.';
    if (form.gstin.trim() && !GSTIN_REGEX.test(form.gstin.trim().toUpperCase())) {
      e.gstin = 'That GSTIN does not look valid — check the 15-character format.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 1 && !validateStep1()) return;
    setError('');
    setStep((s) => Math.min(s + 1, 3));
  };

  const back = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1));
  };

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
      name: store.name || 'ShopVerse',
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
        ondismiss: () => {
          setSubmitting(false);
          setError(
            'The payment window was closed. Your order has been saved as pending — press the button again to retry.'
          );
        },
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
    if (step < 3) {
      next();
      return;
    }
    setSubmitting(true);
    setError('');
    setPriceChanged(false);
    try {
      const data = await api.post('/checkout', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        customerName: form.name.trim(),
        customerEmail: form.email.trim(),
        customerAddress: form.address.trim(),
        companyName: form.companyName.trim(),
        gstin: form.gstin.trim(),
        billingState: form.billingState,
        paymentMethod: method,
        expectedTotalCents: subtotal,
      });
      if (data.paymentMethod === 'razorpay') {
        startRazorpay(data);
      } else if (data.paymentMethod === 'cod') {
        clear();
        navigate(`/checkout/success?order=${data.orderId}&cod=1`);
      } else {
        clear();
        navigate(`/checkout/success?order=${data.orderId}&mock=1`);
      }
    } catch (err) {
      if (err.status === 409 && err.message) {
        setPriceChanged(true);
        setError(err.message);
      } else {
        setError(err.message);
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="container section">
      <Seo title="Checkout - ShopVerse" description="Secure checkout with UPI, cards, net banking or cash on delivery." />
      {searchParams.get('cancel') && (
        <div className="notice notice-warning">Payment was cancelled. You can try again.</div>
      )}
      <h1 className="page-title">Checkout</h1>

      <ol className="checkout-steps" aria-label="Checkout progress">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const current = step === n;
          return (
            <li key={label} className={`checkout-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
              <span className="checkout-step-dot" aria-hidden="true">
                {done ? '✓' : n}
              </span>
              <span className="checkout-step-label">{label}</span>
            </li>
          );
        })}
      </ol>

      <form onSubmit={handleSubmit} className="checkout-layout" noValidate>
        <div className="checkout-form">
          {step === 1 && (
            <div>
              <h3>Delivery details</h3>
              <label className="field">
                <span>Full name</span>
                <input
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Jane Doe"
                  aria-invalid={!!errors.name}
                  autoComplete="name"
                />
                {errors.name && <p className="field-error">{errors.name}</p>}
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="jane@example.com"
                  aria-invalid={!!errors.email}
                  autoComplete="email"
                />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </label>
              <label className="field">
                <span>Shipping address</span>
                <textarea
                  value={form.address}
                  onChange={set('address')}
                  placeholder="123 Main Street, Springfield"
                  rows={3}
                  aria-invalid={!!errors.address}
                  autoComplete="street-address"
                />
                {errors.address && <p className="field-error">{errors.address}</p>}
              </label>

              <div className="checkout-billing">
                <h3>
                  Billing details <em>(optional, for GST invoices)</em>
                </h3>
                <div className="field-row">
                  <label className="field">
                    <span>Company / business name</span>
                    <input
                      value={form.companyName}
                      onChange={set('companyName')}
                      placeholder="Acme Pvt Ltd"
                    />
                  </label>
                  <label className="field">
                    <span>Billing state</span>
                    <select value={form.billingState} onChange={set('billingState')}>
                      <option value="">Select state</option>
                      {INDIA_STATES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>GSTIN</span>
                  <input
                    value={form.gstin}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }));
                      setErrors((prev) => ({ ...prev, gstin: undefined }));
                    }}
                    placeholder="29ABCDE1234F1Z5"
                    maxLength={15}
                    aria-invalid={!!errors.gstin}
                  />
                  <p className="hint hint-left">Optional — provide your GSTIN to get a GST invoice.</p>
                  {errors.gstin && <p className="field-error">{errors.gstin}</p>}
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3>How would you like to pay?</h3>
              <div className="payment-methods">
                <label className={`payment-card ${method === 'online' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="method"
                    value="online"
                    checked={method === 'online'}
                    onChange={() => setMethod('online')}
                  />
                  <span className="payment-card-icon">
                    <CardIcon />
                  </span>
                  <span className="payment-card-body">
                    <strong>Pay online</strong>
                    <span>UPI, credit/debit cards, net banking &amp; wallets — secure and instant.</span>
                  </span>
                  <span className="payment-card-note">Processed by Razorpay</span>
                </label>

                {codEnabled && (
                  <label className={`payment-card ${method === 'cod' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="method"
                      value="cod"
                      checked={method === 'cod'}
                      onChange={() => setMethod('cod')}
                    />
                    <span className="payment-card-icon">
                      <CodIcon />
                    </span>
                    <span className="payment-card-body">
                      <strong>Cash on delivery</strong>
                      <span>
                        No prepayment needed — pay {formatPrice(subtotal)} in cash when your order
                        arrives.
                      </span>
                    </span>
                    <span className="payment-card-note">Pay on arrival</span>
                  </label>
                )}
              </div>

              <div className="payment-trust" aria-label="Security">
                <span>
                  <LockIcon /> Secure 256-bit encryption
                </span>
                <span>PCI-DSS compliant gateway</span>
                <span>Verified payments only</span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3>Review your order</h3>
              <div className="review-block">
                <span className="review-label">Deliver to</span>
                <strong>{form.name}</strong>
                <p>{form.address}</p>
                <p className="hint hint-left">{form.email}</p>
              </div>
              <div className="review-block">
                <span className="review-label">Payment method</span>
                <strong>{method === 'cod' ? 'Cash on Delivery' : 'Pay online (Razorpay)'}</strong>
                <p className="hint hint-left">
                  {method === 'cod'
                    ? `Pay ${formatPrice(subtotal)} in cash when your order is delivered.`
                    : 'You will be redirected to our secure payment page to complete the order.'}
                </p>
              </div>
              {priceChanged && (
                <div className="notice notice-warning">
                  Some prices in your cart changed. Please review your cart before continuing.
                </div>
              )}
              {error && <div className="notice notice-error">{error}</div>}
            </div>
          )}

          <div className="checkout-actions">
            {step > 1 && (
              <button type="button" className="btn btn-outline" onClick={back}>
                ← Back
              </button>
            )}
            {step < 3 ? (
              <button type="submit" className="btn btn-primary btn-lg">
                {step === 1 ? 'Continue to payment' : 'Review order'} →
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" disabled={submitting}>
                {submitting
                  ? 'Placing order...'
                  : method === 'cod'
                  ? `Place order · Pay ${formatPrice(subtotal)} on delivery`
                  : `Pay ${formatPrice(subtotal)} securely`}
              </button>
            )}
          </div>
        </div>

        <aside className="cart-summary">
          <h3>Order summary</h3>
          {items.map((i) => (
            <div className="summary-item" key={i.productId}>
              <img src={i.imageUrl} alt="" className="summary-thumb" loading="lazy" />
              <span className="summary-item-name">
                {i.name} <em>× {i.quantity}</em>
              </span>
              <span className="summary-item-price">{formatPrice(i.priceCents * i.quantity)}</span>
            </div>
          ))}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>Free</span>
          </div>
          <div className="summary-row summary-total">
            <span>Amount payable</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <p className="product-tax-note">Inclusive of all taxes (GST).</p>
          <p className="summary-secure">
            <LockIcon /> Secured by Razorpay
          </p>
        </aside>
      </form>
    </div>
  );
}

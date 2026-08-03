import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import OrderTracking from '../components/OrderTracking';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import Seo from '../components/Seo';
import { useToast } from '../context/ToastContext';

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

const TABS = [
  { key: 'orders', label: 'My Orders', icon: '📦' },
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'privacy', label: 'Privacy', icon: '🔒' },
  { key: 'security', label: 'Security', icon: '🛡️' },
];

export default function Account() {
  const { user, updateProfile, updatePrivacy, changePassword, uploadAvatar, logout } = useAuth();
  const { push } = useToast();
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    address: '',
    dateOfBirth: '',
  });
  const [privacyForm, setPrivacyForm] = useState({
    marketingEmails: true,
    dataProcessingConsent: true,
    newsletterSubscribed: true,
    smsNotifications: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const loadOrders = useCallback(() => {
    api
      .get('/orders/my', { auth: true })
      .then((d) => setOrders(d.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOrders();
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
        dateOfBirth: user.dateOfBirth || '',
      });
      setPrivacyForm({
        marketingEmails: user.marketingEmails ?? true,
        dataProcessingConsent: user.dataProcessingConsent ?? true,
        newsletterSubscribed: user.newsletterSubscribed ?? true,
        smsNotifications: user.smsNotifications ?? false,
      });
      if (user.avatarUrl) setAvatarPreview(user.avatarUrl);
    }
  }, [user, loadOrders]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try {
      await updateProfile(profileForm);
      push('Profile updated successfully');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePrivacySubmit = async (e) => {
    e.preventDefault();
    setBusy('privacy');
    try {
      await updatePrivacy(privacyForm);
      push('Privacy settings updated');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      push('New passwords do not match', 'error');
      return;
    }
    setBusy('password');
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      push('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      push('Please select an image file', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      push('Image must be less than 2MB', 'error');
      return;
    }
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
    try {
      await uploadAvatar(file);
      push('Avatar updated');
    } catch (err) {
      push(err.message, 'error');
      setAvatarPreview(user?.avatarUrl || null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const requestReturn = async (order, reason) => {
    if (!reason) return;
    if (!confirm(`Request a return for order #${order.id}? Reason: ${reason}`)) return;
    setBusy(order.id);
    try {
      await api.post(`/orders/${order.id}/return`, { reason }, { auth: true });
      loadOrders();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const cancelOrder = async (order) => {
    if (!confirm(`Cancel order #${order.id}?`)) return;
    setBusy(order.id);
    try {
      await api.post(`/orders/${order.id}/cancel`, {}, { auth: true });
      loadOrders();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to sign out?')) {
      logout();
    }
  };

  const renderOrdersTab = () => (
    <>
      {loading ? (
        <div className="orders-list" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <div className="order-card" key={i}>
              <Skeleton style={{ width: '40%', height: 18 }} />
              <Skeleton style={{ width: '100%', height: 60, marginTop: 14 }} />
              <Skeleton style={{ width: '70%', height: 14, marginTop: 14 }} />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="You have not placed any orders yet"
          subtitle="When you place an order, you can track it, download its GST invoice and request returns here."
        >
          <Link to="/products" className="btn btn-primary btn-lg">
            Start shopping
          </Link>
        </EmptyState>
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

              {o.status !== 'cancelled' && <OrderTracking status={o.status} carrier={o.carrier} trackingNumber={o.trackingNumber} />}

              {o.eta && ['pending', 'paid', 'packed', 'shipped', 'out_for_delivery'].includes(o.status) && (
                <p className="order-eta">
                  Estimated delivery: {o.eta.min} – {o.eta.max}
                </p>
              )}

              {(o.carrier || o.trackingNumber) && (
                <div className="order-tracking-info customer">
                  <strong>Tracking:</strong>
                  <span>{o.carrier} — {o.trackingNumber}</span>
                </div>
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
    </>
  );

  const renderProfileTab = () => (
    <form onSubmit={handleProfileSubmit} className="settings-form">
      <div className="profile-avatar-section">
        <div className="avatar-wrapper">
          <div
            className={`avatar-display ${avatarUploading ? 'uploading' : ''}`}
            style={{ backgroundImage: avatarPreview ? `url(${avatarPreview})` : 'none' }}
          >
            {avatarUploading && <div className="avatar-spinner">⟳</div>}
            {!avatarPreview && !avatarUploading && <span className="avatar-placeholder">{user?.name?.[0]?.toUpperCase() || 'U'}</span>}
          </div>
          <label className="avatar-upload-btn">
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleAvatarChange} hidden />
            <span className="btn btn-outline">Change avatar</span>
          </label>
          {user?.avatarUrl && !avatarUploading && (
            <button type="button" className="btn btn-sm btn-ghost avatar-remove" onClick={() => { setAvatarPreview(null); updateProfile({ avatarUrl: '' }); }}>
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="form-section">
        <h3>Personal Information</h3>
        <div className="field-row">
          <label className="field">
            <span>Full Name</span>
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="disabled-input"
            />
            <small className="hint">Email cannot be changed. Contact support if needed.</small>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Phone Number</span>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </label>
          <label className="field">
            <span>Date of Birth</span>
            <input
              type="date"
              value={profileForm.dateOfBirth}
              onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
            />
          </label>
        </div>
        <label className="field full-width">
          <span>Address</span>
          <textarea
            value={profileForm.address}
            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
            rows={3}
            placeholder="Full address for faster checkout"
          />
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy === 'profile'}>
          {busy === 'profile' ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );

  const renderPrivacyTab = () => (
    <form onSubmit={handlePrivacySubmit} className="settings-form">
      <div className="form-section">
        <h3>Communication Preferences</h3>
        <p className="section-desc">Control how we communicate with you.</p>

        <div className="privacy-toggle">
          <div className="toggle-info">
            <strong>Marketing Emails</strong>
            <span>Receive promotional offers, new arrivals, and sale notifications</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={privacyForm.marketingEmails}
              onChange={(e) => setPrivacyForm({ ...privacyForm, marketingEmails: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="privacy-toggle">
          <div className="toggle-info">
            <strong>Newsletter</strong>
            <span>Weekly updates with curated products and tips</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={privacyForm.newsletterSubscribed}
              onChange={(e) => setPrivacyForm({ ...privacyForm, newsletterSubscribed: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="privacy-toggle">
          <div className="toggle-info">
            <strong>SMS Notifications</strong>
            <span>Order updates and delivery alerts via SMS</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={privacyForm.smsNotifications}
              onChange={(e) => setPrivacyForm({ ...privacyForm, smsNotifications: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div className="form-section">
        <h3>Data & Privacy</h3>
        <p className="section-desc">Manage your data processing preferences.</p>

        <div className="privacy-toggle">
          <div className="toggle-info">
            <strong>Data Processing Consent</strong>
            <span>Allow processing of personal data for order fulfillment and service improvement (required)</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={privacyForm.dataProcessingConsent}
              onChange={(e) => setPrivacyForm({ ...privacyForm, dataProcessingConsent: e.target.checked })}
              disabled
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy === 'privacy'}>
          {busy === 'privacy' ? 'Saving...' : 'Save Privacy Settings'}
        </button>
      </div>
    </form>
  );

  const renderSecurityTab = () => (
    <form onSubmit={handlePasswordSubmit} className="settings-form">
      <div className="form-section">
        <h3>Change Password</h3>
        <p className="section-desc">Your password must be at least 6 characters.</p>

        <label className="field">
          <span>Current Password</span>
          <input
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span>New Password</span>
          <input
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>Confirm New Password</span>
          <input
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            required
            autoComplete="new-password"
          />
        </label>
      </div>

      <div className="form-section security-actions">
        <h3>Account Actions</h3>
        <p className="section-desc">Dangerous actions that cannot be undone.</p>
        <button type="button" className="btn btn-danger" onClick={handleLogout}>
          Sign Out Everywhere
        </button>
        <small className="hint">This will log you out of all devices and revoke all active sessions.</small>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy === 'password'}>
          {busy === 'password' ? 'Updating...' : 'Change Password'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="container section account-page">
      <Seo title="Your Account - ShopVerse" description="Manage your profile, orders, privacy and security settings." />

      <div className="account-header">
        <div className="account-avatar">
          <div
            className="avatar-large"
            style={{ backgroundImage: avatarPreview ? `url(${avatarPreview})` : 'none' }}
          >
            {!avatarPreview && <span>{user?.name?.[0]?.toUpperCase() || 'U'}</span>}
          </div>
        </div>
        <div className="account-info">
          <h1 className="page-title">My Account</h1>
          <p className="account-email">{user?.email}</p>
          {user?.role === 'admin' && <span className="role-badge">Admin</span>}
        </div>
      </div>

      <div className="account-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`account-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="account-content" role="tabpanel">
        {activeTab === 'orders' && renderOrdersTab()}
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'privacy' && renderPrivacyTab()}
        {activeTab === 'security' && renderSecurityTab()}
      </div>
    </div>
  );
}
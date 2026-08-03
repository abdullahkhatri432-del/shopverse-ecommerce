import { useEffect, useState, useCallback, useRef } from 'react';
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

const STATUS_COLORS = {
  pending: '#f59e0b',
  paid: '#3b82f6',
  packed: '#8b5cf6',
  shipped: '#06b6d4',
  out_for_delivery: '#f97316',
  delivered: '#10b981',
  cancelled: '#ef4444',
  return_requested: '#f59e0b',
  return_approved: '#3b82f6',
  returned: '#10b981',
};

const TABS = [
  { key: 'orders', label: 'Orders', icon: '📦' },
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'privacy', label: 'Privacy', icon: '🔒' },
  { key: 'security', label: 'Security', icon: '🛡️' },
];

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#10b981'];
  return { score, label: labels[score - 1] || '', color: colors[score - 1] || 'transparent' };
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

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
  const [avatarDragActive, setAvatarDragActive] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const tabsRef = useRef(null);

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
    if (!profileForm.name.trim()) {
      push('Name is required', 'error');
      return;
    }
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
    const strength = getPasswordStrength(passwordForm.newPassword);
    if (strength.score < 3) {
      push('Please choose a stronger password (mix of upper, lower, numbers, symbols)', 'error');
      return;
    }
    setBusy('password');
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      push('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPassword(false);
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleAvatarChange = async (file) => {
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

  const handleDragOver = (e) => {
    e.preventDefault();
    setAvatarDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setAvatarDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setAvatarDragActive(false);
    const file = e.dataTransfer.files[0];
    handleAvatarChange(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    handleAvatarChange(file);
  };

  const requestReturn = async (order, reason) => {
    if (!reason) return;
    if (!confirm(`Request a return for order #${order.id}? Reason: ${reason}`)) return;
    setBusy(order.id);
    try {
      await api.post(`/orders/${order.id}/return`, { reason }, { auth: true });
      loadOrders();
      push('Return requested');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const cancelOrder = async (order) => {
    if (!confirm(`Cancel order #${order.id}? This cannot be undone.`)) return;
    setBusy(order.id);
    try {
      await api.post(`/orders/${order.id}/cancel`, {}, { auth: true });
      loadOrders();
      push('Order cancelled');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = () => {
    if (confirm('Sign out from all devices? You will need to log in again.')) {
      logout();
    }
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const renderOrdersTab = () => (
    <>
      {loading ? (
        <div className="orders-list" aria-hidden="true" role="list">
          {Array.from({ length: 2 }).map((_, i) => (
            <div className="order-card skeleton" key={i} role="listitem">
              <Skeleton style={{ width: '40%', height: 18 }} />
              <Skeleton style={{ width: '100%', height: 60, marginTop: 14 }} />
              <Skeleton style={{ width: '70%', height: 14, marginTop: 14 }} />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          subtitle="When you place an order, you'll see it here with tracking, invoices, and return options."
          icon="📦"
        >
          <Link to="/products" className="btn btn-primary btn-lg">
            Start shopping
          </Link>
        </EmptyState>
      ) : (
        <div className="orders-list" role="list">
          {orders.map((o) => {
            const isExpanded = expandedOrders.has(o.id);
            const statusColor = STATUS_COLORS[o.status] || '#64748b';
            return (
              <div className="order-card" key={o.id} role="listitem">
                <div className="order-head">
                  <div className="order-main">
                    <div className="order-id-row">
                      <strong>Order #{o.id}</strong>
                      <span className="order-date">{formatDate(o.createdAt)}</span>
                    </div>
                    <div className="order-status-row">
                      <span
                        className="status-badge"
                        style={{
                          background: `${statusColor}15`,
                          color: statusColor,
                          borderColor: `${statusColor}40`,
                        }}
                      >
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                      <span className="order-total">{formatPrice(o.totalCents)}</span>
                    </div>
                  </div>
                  <button
                    className="expand-btn"
                    onClick={() => toggleOrderExpand(o.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse order details' : 'Expand order details'}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>

                <div className={`order-details ${isExpanded ? 'expanded' : 'collapsed'}`}>
                  {o.status !== 'cancelled' && <OrderTracking status={o.status} carrier={o.carrier} trackingNumber={o.trackingNumber} />}

                  {o.eta && ['pending', 'paid', 'packed', 'shipped', 'out_for_delivery'].includes(o.status) && (
                    <p className="order-eta">
                      <span className="eta-icon">📅</span>
                      Estimated delivery: <strong>{o.eta.min} – {o.eta.max}</strong>
                    </p>
                  )}

                  {(o.carrier || o.trackingNumber) && (
                    <div className="order-tracking-info customer">
                      <span className="tracking-label">Tracking:</span>
                      <span className="tracking-value">{o.carrier} — {o.trackingNumber}</span>
                      {o.trackingNumber && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost copy-tracking"
                          onClick={() => {
                            navigator.clipboard.writeText(o.trackingNumber);
                            push('Tracking number copied');
                          }}
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  )}

                  <div className="order-items">
                    {o.items.map((i) => (
                      <div className="summary-line" key={i.id}>
                        <span className="item-name">{i.productName} × {i.quantity}</span>
                        <span className="item-price">{formatPrice(i.priceCents * i.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-actions">
                    {o.status === 'paid' && o.invoiceNumber && (
                      <>
                        <Link to={`/invoice/${o.id}`} className="btn btn-sm btn-outline">
                          📄 View GST Invoice
                        </Link>
                        <a
                          href={`/api/orders/${o.id}/invoice.pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline"
                        >
                          ⬇️ Download PDF
                        </a>
                      </>
                    )}
                    {['pending', 'paid'].includes(o.status) && (
                      <button
                        className="btn btn-sm btn-ghost"
                        disabled={busy === o.id}
                        onClick={() => cancelOrder(o)}
                      >
                        {busy === o.id ? '⏳ Cancelling...' : '✕ Cancel Order'}
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
                        {busy === o.id ? '⏳ Processing...' : '↩ Request Return'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const renderProfileTab = () => (
    <form onSubmit={handleProfileSubmit} className="settings-form" noValidate>
      <div className="profile-avatar-section">
        <div className="avatar-wrapper">
          <div
            className={`avatar-dropzone ${avatarDragActive ? 'drag-active' : ''} ${avatarUploading ? 'uploading' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="avatar-input"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileInputChange}
              hidden
            />
            <div
              className={`avatar-display ${avatarUploading ? 'uploading' : ''}`}
              style={{ backgroundImage: avatarPreview ? `url(${avatarPreview})` : 'none' }}
            >
              {avatarUploading && <div className="avatar-spinner" aria-label="Uploading avatar">⟳</div>}
              {!avatarPreview && !avatarUploading && <span className="avatar-placeholder">{user?.name?.[0]?.toUpperCase() || 'U'}</span>}
            </div>
            <label htmlFor="avatar-input" className="avatar-upload-btn">
              <span className="btn btn-outline">
                {avatarPreview ? 'Change avatar' : 'Upload avatar'}
              </span>
              <span className="upload-hint">Drag & drop or click • Max 2MB</span>
            </label>
            {avatarPreview && !avatarUploading && (
              <button
                type="button"
                className="btn btn-sm btn-ghost avatar-remove"
                onClick={() => { setAvatarPreview(null); updateProfile({ avatarUrl: '' }); }}
              >
                Remove avatar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Personal Information</h3>
          <p className="section-desc">This information is used for order processing and delivery.</p>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Full Name <span className="required">*</span></span>
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              required
              autoComplete="name"
              placeholder="Enter your full name"
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="disabled-input"
              autoComplete="email"
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
              autoComplete="tel"
            />
          </label>
          <label className="field">
            <span>Date of Birth</span>
            <input
              type="date"
              value={profileForm.dateOfBirth}
              onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              autoComplete="bday"
            />
          </label>
        </div>
        <label className="field full-width">
          <span>Delivery Address</span>
          <textarea
            value={profileForm.address}
            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
            rows={3}
            placeholder="Full address for faster checkout (street, city, state, PIN)"
            autoComplete="street-address"
          />
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy === 'profile'}>
          {busy === 'profile' ? <span className="btn-spinner">⟳</span> : null} {busy === 'profile' ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );

  const renderPrivacyTab = () => (
    <form onSubmit={handlePrivacySubmit} className="settings-form" noValidate>
      <div className="form-section">
        <div className="section-header">
          <h3>Communication Preferences</h3>
          <p className="section-desc">Control how we communicate with you. You can change these anytime.</p>
        </div>

        <div className="privacy-toggle">
          <div className="toggle-info">
            <strong>Marketing Emails</strong>
            <span>Promotional offers, new arrivals, and sale notifications</span>
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
        <div className="section-header">
          <h3>Data & Privacy</h3>
          <p className="section-desc">Manage how your personal data is processed.</p>
        </div>

        <div className="privacy-toggle required-setting">
          <div className="toggle-info">
            <strong>Data Processing Consent <span className="required-badge">Required</span></strong>
            <span>Allow processing of personal data for order fulfillment and service improvement</span>
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

      <div className="form-section">
        <div className="section-header">
          <h3>Your Rights</h3>
          <p className="section-desc">Under applicable data protection laws, you have the right to:</p>
        </div>
        <ul className="rights-list">
          <li>Access your personal data</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data (where legally permissible)</li>
          <li>Restrict or object to processing</li>
          <li>Data portability</li>
          <li>Withdraw consent at any time</li>
        </ul>
        <p className="rights-note">
          To exercise these rights, <a href="/contact" className="link">contact our support team</a>.
        </p>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy === 'privacy'}>
          {busy === 'privacy' ? <span className="btn-spinner">⟳</span> : null} {busy === 'privacy' ? 'Saving...' : 'Save Privacy Settings'}
        </button>
      </div>
    </form>
  );

  const renderSecurityTab = () => (
    <form onSubmit={handlePasswordSubmit} className="settings-form" noValidate>
      <div className="form-section">
        <div className="section-header">
          <h3>Change Password</h3>
          <p className="section-desc">Use a strong, unique password. Minimum 8 characters recommended.</p>
        </div>

        <label className="field">
          <span>Current Password <span className="required">*</span></span>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              required
              autoComplete="current-password"
              placeholder="Enter current password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </label>

        <label className="field">
          <span>New Password <span className="required">*</span></span>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Enter new password"
            />
          </div>
          {passwordForm.newPassword && (
            <div className="password-strength">
              <div className="strength-bar">
                <div
                  className="strength-fill"
                  style={{
                    width: `${(getPasswordStrength(passwordForm.newPassword).score / 5) * 100}%`,
                    backgroundColor: getPasswordStrength(passwordForm.newPassword).color,
                  }}
                />
              </div>
              <span className="strength-label" style={{ color: getPasswordStrength(passwordForm.newPassword).color }}>
                {getPasswordStrength(passwordForm.newPassword).label}
              </span>
            </div>
          )}
        </label>

        <label className="field">
          <span>Confirm New Password <span className="required">*</span></span>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              required
              autoComplete="new-password"
              placeholder="Confirm new password"
            />
          </div>
          {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
            <small className="hint error">Passwords do not match</small>
          )}
        </label>
      </div>

      <div className="form-section security-actions">
        <div className="section-header">
          <h3>Account Actions</h3>
          <p className="section-desc">Dangerous actions that cannot be undone.</p>
        </div>
        <button type="button" className="btn btn-danger btn-lg" onClick={handleLogout}>
          🚪 Sign Out Everywhere
        </button>
        <small className="hint">This will log you out of all devices and revoke all active sessions.</small>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy === 'password' || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword || getPasswordStrength(passwordForm.newPassword).score < 3}>
          {busy === 'password' ? <span className="btn-spinner">⟳</span> : null} {busy === 'password' ? 'Updating...' : 'Change Password'}
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

      <div className="account-tabs-wrapper">
        <div className="account-tabs" role="tablist" ref={tabsRef}>
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
        <div className="tab-indicator" style={{ transform: `translateX(${activeTabIndex() * 100}%)` }} />
      </div>

      <div className="account-content" role="tabpanel">
        {activeTab === 'orders' && renderOrdersTab()}
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'privacy' && renderPrivacyTab()}
        {activeTab === 'security' && renderSecurityTab()}
      </div>
    </div>
  );

  function activeTabIndex() {
    return TABS.findIndex((t) => t.key === activeTab);
  }
}
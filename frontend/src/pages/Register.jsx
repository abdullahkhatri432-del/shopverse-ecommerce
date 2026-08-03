import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GoogleButton from '../components/GoogleButton';
import Seo from '../components/Seo';
import { getConfig } from '../lib/api';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export default function Register() {
  const { googleLogin, register } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const googleEnabled = !!getConfig().googleClientId;

  const onGoogleSuccess = async (credential) => {
    setGLoading(true);
    setError('');
    try {
      const user = await googleLogin(credential);
      push(`Welcome to ShopVerse, ${user.name}!`);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setGLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!EMAIL_REGEX.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const user = await register(form.name.trim(), form.email.trim(), form.password);
      push(`Welcome to ShopVerse, ${user.name}!`);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Seo title="Create account - ShopVerse" description="Create your account with email/password or Google." />
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="auth-sub">
          One duplicate-free account — sign up with email/password or Google. Your verified email
          keeps every account unique.
        </p>

        {googleEnabled && (
          <>
            {gLoading && <div className="page-loading">Creating your account...</div>}
            {!gLoading && <GoogleButton onSuccess={onGoogleSuccess} onError={(m) => setError(m)} />}
            <div className="auth-divider">or</div>
          </>
        )}

        <form onSubmit={handleRegister} className="auth-form" noValidate>
          <label className="field">
            <span>Full name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Jane Doe"
              autoComplete="name"
              required
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
            />
          </label>
          {error && <div className="notice notice-error">{error}</div>}
          <button className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

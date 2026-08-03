import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GoogleButton from '../components/GoogleButton';
import Seo from '../components/Seo';
import { getConfig } from '../lib/api';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export default function Login() {
  const { googleLogin, login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const googleEnabled = !!getConfig().googleClientId;

  const afterAuth = (user) => navigate(user.role === 'admin' ? '/admin' : '/');

  const onGoogleSuccess = async (credential) => {
    setGLoading(true);
    setError('');
    try {
      const user = await googleLogin(credential);
      push(`Welcome back, ${user.name}`);
      afterAuth(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setGLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_REGEX.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!form.password) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      push(`Welcome back, ${user.name}`);
      afterAuth(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Seo title="Sign in - ShopVerse" description="Sign in with email/password or Google." />
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="auth-sub">Welcome back to ShopVerse.</p>

        {googleEnabled && (
          <>
            {gLoading && <div className="page-loading">Signing in with Google...</div>}
            {!gLoading && <GoogleButton onSuccess={onGoogleSuccess} onError={(m) => setError(m)} />}
            <div className="auth-divider">or</div>
          </>
        )}

        <form onSubmit={handlePasswordSubmit} className="auth-form" noValidate>
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
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="notice notice-error">{error}</div>}
          <button className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in with email'}
          </button>
        </form>
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

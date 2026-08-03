import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GoogleButton from '../components/GoogleButton';
import Seo from '../components/Seo';

export default function Register() {
  const { googleLogin } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onGoogleSuccess = async (credential) => {
    setLoading(true);
    setError('');
    try {
      const user = await googleLogin(credential);
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
      <Seo title="Create account - ShopVerse" description="Create your ShopVerse account securely with Google." />
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="auth-sub">
          Sign up securely with your Google account. We use your verified Google email to create a
          single, duplicate-free account.
        </p>
        {loading && <div className="page-loading">Creating your account...</div>}
        {!loading && <GoogleButton onSuccess={onGoogleSuccess} onError={(m) => setError(m)} />}
        {error && <div className="notice notice-error">{error}</div>}
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

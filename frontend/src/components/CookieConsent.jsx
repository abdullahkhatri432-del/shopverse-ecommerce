import { useEffect, useState } from 'react';

const STORAGE_KEY = 'sv_cookie_consent';

export function getCookieConsent() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setCookieConsent(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) setVisible(true);
  }, []);

  const choose = (value) => {
    setCookieConsent({ accepted: value, at: new Date().toISOString() });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
      <div className="cookie-banner-inner">
        <p>
          We use essential cookies and local storage to keep your cart and login working, and the
          Razorpay payment gateway uses its own cookies to process payments. If you would like more
          details, please read our{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
        <div className="cookie-banner-actions">
          <button className="btn btn-sm btn-primary" onClick={() => choose(true)}>
            Accept all
          </button>
          <button className="btn btn-sm btn-outline" onClick={() => choose(false)}>
            Essential only
          </button>
        </div>
      </div>
    </div>
  );
}

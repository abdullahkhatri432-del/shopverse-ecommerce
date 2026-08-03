import { useEffect, useRef } from 'react';
import { getConfig } from '../lib/api';

export default function GoogleButton({ onSuccess, onError }) {
  const ref = useRef(null);

  useEffect(() => {
    const clientId = getConfig().googleClientId;
    if (!clientId) return;
    let cancelled = false;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: (resp) => {
          if (resp && resp.credential) onSuccess(resp.credential);
          else onError('Google sign-in did not return a credential.');
        },
      });
      if (ref.current) {
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 320,
        });
      }
    };
    script.onerror = () => onError('Could not load Google sign-in. Please try again.');
    document.body.appendChild(script);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="google-button" />;
}

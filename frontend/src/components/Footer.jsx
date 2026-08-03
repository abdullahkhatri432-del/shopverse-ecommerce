import { Link } from 'react-router-dom';
import { getStore } from '../lib/api';

export default function Footer() {
  const store = getStore();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>© {new Date().getFullYear()} {store.name || 'ShopVerse'}. All rights reserved.</p>
        <nav className="footer-links" aria-label="Legal">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refunds">Refunds</Link>
          <Link to="/shipping">Shipping</Link>
          <Link to="/cancellation">Cancellation</Link>
          <Link to="/grievance">Grievance Officer</Link>
          <Link to="/seller">Seller Info</Link>
        </nav>
        <p className="footer-sub">Sole proprietorship · Express + React + SQLite</p>
      </div>
    </footer>
  );
}

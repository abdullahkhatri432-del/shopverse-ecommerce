import { Link } from 'react-router-dom';
import { getStore, getGrievanceOfficer } from '../lib/api';

export default function Footer() {
  const store = getStore();
  const officer = getGrievanceOfficer();
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
          <Link to="/contact">Contact Us</Link>
        </nav>
        <div className="footer-grievance">
          <strong>Grievance Officer:</strong> {officer.name || store.name}
          <span> · </span>
          <a href={`mailto:${officer.email || 'grievance@yourstore.com'}`}>
            {officer.email || 'grievance@yourstore.com'}
          </a>
          <span> · </span>
          <a href={`tel:${(officer.phone || '+919000000000').replace(/\s/g, '')}`}>
            {officer.phone || '+91 90000 00000'}
          </a>
        </div>
        <p className="footer-sub">Sole proprietorship · Express + React + SQLite</p>
      </div>
    </footer>
  );
}

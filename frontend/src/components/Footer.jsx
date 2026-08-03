import { Link } from 'react-router-dom';
import { getStore, getGrievanceOfficer } from '../lib/api';

export default function Footer() {
  const store = getStore();
  const officer = getGrievanceOfficer();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <span className="brand-mark">S</span>
              {store.name || 'ShopVerse'}
            </Link>
            <p className="footer-desc">
              Your trusted destination for quality products at great prices.
              Free shipping on orders over ₹999. COD available.
            </p>
            <div className="footer-contact">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                <span>{store.address || '123 Commerce St, Business City, State 110001'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                <a href={`tel:${(officer.phone || '+919000000000').replace(/\s/g, '')}`}>{officer.phone || '+91 90000 00000'}</a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" stroke="currentColor" strokeWidth="1.7" />
                  <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                <a href={`mailto:${officer.email || 'support@yourstore.com'}`}>{officer.email || 'support@yourstore.com'}</a>
              </div>
            </div>
            <div className="footer-social" aria-label="Social links">
              <a href="#" aria-label="Twitter"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
              <a href="#" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></a>
              <a href="#" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="1.8"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" stroke="currentColor" strokeWidth="1.8"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="currentColor" strokeWidth="1.8"/></svg></a>
              <a href="#" aria-label="LinkedIn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6Z" stroke="currentColor" strokeWidth="1.8"/><rect x="2" y="9" width="4" height="12" stroke="currentColor" strokeWidth="1.8"/><circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.8"/></svg></a>
            </div>
          </div>

          <nav className="footer-col" aria-label="Quick links">
            <h3 className="footer-title">Quick links</h3>
            <ul className="footer-links">
              <li><Link to="/products">Shop all</Link></li>
              <li><Link to="/products?category=electronics">Electronics</Link></li>
              <li><Link to="/products?category=fashion">Fashion</Link></li>
              <li><Link to="/products?category=home">Home & Kitchen</Link></li>
              <li><Link to="/products?category=beauty">Beauty</Link></li>
              <li><Link to="/products?category=sports">Sports</Link></li>
              <li><Link to="/products?featured=true">Featured</Link></li>
              <li><Link to="/products?sort=price_asc">Best sellers</Link></li>
            </ul>
          </nav>

          <nav className="footer-col" aria-label="Customer support">
            <h3 className="footer-title">Support</h3>
            <ul className="footer-links">
              <li><Link to="/contact">Contact us</Link></li>
              <li><Link to="/shipping">Shipping info</Link></li>
              <li><Link to="/refunds">Returns & refunds</Link></li>
              <li><Link to="/cancellation">Cancellation policy</Link></li>
              <li><Link to="/grievance">Grievance officer</Link></li>
              <li><Link to="/account">Track order</Link></li>
              <li><Link to="/account">My account</Link></li>
              <li><Link to="/faq">FAQs</Link></li>
            </ul>
          </nav>

          <nav className="footer-col" aria-label="Legal & company">
            <h3 className="footer-title">Legal</h3>
            <ul className="footer-links">
              <li><Link to="/terms">Terms of service</Link></li>
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><Link to="/seller">Seller information</Link></li>
              <li><Link to="/about">About us</Link></li>
              <li><Link to="/careers">Careers</Link></li>
              <li><Link to="/press">Press</Link></li>
              <li><Link to="/partners">Partners</Link></li>
              <li><Link to="/accessibility">Accessibility</Link></li>
            </ul>
          </nav>
        </div>

        <div className="footer-bottom">
          <p>© {year} {store.name || 'ShopVerse'}. All rights reserved.</p>
          <div className="payment-badges">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>UPI</span>
            <span>Net Banking</span>
            <span>COD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
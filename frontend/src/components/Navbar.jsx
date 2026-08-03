import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import SearchSuggest from './SearchSuggest';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

  return (
    <header className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">S</span>
          ShopVerse
        </Link>
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" className={navLinkClass} end>
            Home
          </NavLink>
          <NavLink to="/products" className={navLinkClass}>
            Shop
          </NavLink>
        </nav>
        <div className="nav-search">
          <SearchSuggest
            onSearch={(q) => navigate(`/products?search=${encodeURIComponent(q)}`)}
            onCategory={(c) => navigate(`/products?category=${encodeURIComponent(c)}`)}
            onProduct={(p) => navigate(`/product/${p.id}`)}
          />
        </div>
        <div className="nav-actions">
          <Link to="/wishlist" className="icon-link" aria-label={`Wishlist, ${wishCount} items`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 20.5s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.2a5.4 5.4 0 0 1 9.3 5.3c-2.3 4.4-9.3 9-9.3 9Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
            <span className="wishlist-label">Wishlist</span>
            {wishCount > 0 && <span className="cart-badge">{wishCount}</span>}
          </Link>
          <Link to="/cart" className="cart-btn" aria-label={`Cart, ${count} items`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 9H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Cart
            {count > 0 && <span className="cart-badge">{count}</span>}
          </Link>
          {user ? (
            <div className="user-menu">
              <span className="user-name">{user.name}</span>
              {user.role === 'admin' && (
                <Link to="/admin" className="btn btn-sm btn-ghost">
                  Admin
                </Link>
              )}
              <Link to="/account" className="btn btn-sm btn-ghost">
                Orders
              </Link>
              <button onClick={handleLogout} className="btn btn-sm btn-outline">
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-sm btn-primary">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

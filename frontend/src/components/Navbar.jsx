import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">S</span>
          ShopVerse
        </Link>
        <nav className="nav-links">
          <NavLink to="/" className={navLinkClass} end>
            Home
          </NavLink>
          <NavLink to="/products" className={navLinkClass}>
            Shop
          </NavLink>
        </nav>
        <div className="nav-actions">
          <Link to="/cart" className="cart-btn" aria-label="Cart">
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

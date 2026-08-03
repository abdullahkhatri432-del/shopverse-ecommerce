import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

function Icon({ d }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-10.5Z',
  shop: 'M6 8h12l1 12H5L6 8ZM9 8V6a3 3 0 0 1 6 0v2',
  heart: 'M12 20.5s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6.2a5.4 5.4 0 0 1 9.3 5.3c-2.3 4.4-9.3 9-9.3 9Z',
  cart: 'M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 9H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0',
};

export default function MobileNav() {
  const { user } = useAuth();
  const { count } = useCart();
  const { count: wishCount } = useWishlist();

  const links = [
    { to: '/', label: 'Home', icon: ICONS.home, end: true },
    { to: '/products', label: 'Shop', icon: ICONS.shop },
    { to: '/wishlist', label: 'Wishlist', icon: ICONS.heart, badge: wishCount },
    { to: '/cart', label: 'Cart', icon: ICONS.cart, badge: count },
    user
      ? { to: '/account', label: 'Account', icon: ICONS.user }
      : { to: '/login', label: 'Sign in', icon: ICONS.user },
  ];

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon">
            <Icon d={l.icon} />
            {l.badge > 0 && <span className="mobile-nav-badge">{l.badge}</span>}
          </span>
          <span className="mobile-nav-label">{l.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

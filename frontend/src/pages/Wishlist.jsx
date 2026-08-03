import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import Seo from '../components/Seo';

export default function Wishlist() {
  const { items } = useWishlist();

  return (
    <div className="container section">
      <Seo title="Your wishlist - ShopVerse" description="Products you saved for later." />
      <h1 className="page-title">Your wishlist ({items.length})</h1>
      {items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          subtitle="Tap the heart on any product to save it here for later."
        >
          <Link to="/products" className="btn btn-primary btn-lg">
            Browse products
          </Link>
        </EmptyState>
      ) : (
        <div className="product-grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

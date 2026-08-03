import { Link } from 'react-router-dom';
import Seo from '../components/Seo';

export default function NotFound() {
  return (
    <div className="container section empty-state">
      <Seo title="Page not found - ShopVerse" description="The page you are looking for does not exist." />
      <div className="error-code">404</div>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <div className="hero-actions">
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
        <Link to="/products" className="btn btn-outline">
          Browse products
        </Link>
      </div>
    </div>
  );
}

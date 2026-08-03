import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import MobileNav from './components/MobileNav';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Login from './pages/Login';
import Register from './pages/Register';
import Account from './pages/Account';
import Invoice from './pages/Invoice';
import Wishlist from './pages/Wishlist';
import Legal from './pages/Legal';
import NotFound from './pages/NotFound';
import CookieConsent from './components/CookieConsent';
import ErrorBoundary from './components/ErrorBoundary';
import AdminLayout from './pages/admin/AdminLayout';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/AdminOrders';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <main className="main">
        <ErrorBoundary>
          <div key={location.pathname} className="page-fade">
            <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/success" element={<OrderSuccess />} />
            <Route path="/invoice/:orderId" element={<Invoice />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/terms" element={<Legal slug="terms" />} />
            <Route path="/privacy" element={<Legal slug="privacy" />} />
            <Route path="/refunds" element={<Legal slug="refunds" />} />
            <Route path="/shipping" element={<Legal slug="shipping" />} />
            <Route path="/cancellation" element={<Legal slug="cancellation" />} />
            <Route path="/grievance" element={<Legal slug="grievance" />} />
            <Route path="/contact" element={<Legal slug="contact" />} />
            <Route path="/seller" element={<Legal slug="seller" />} />
            <Route
              path="/account"
              element={
                <Protected>
                  <Account />
                </Protected>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminOnly>
                  <AdminLayout />
                </AdminOnly>
              }
            >
              <Route index element={<Navigate to="/admin/products" replace />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="orders" element={<AdminOrders />} />
            </Route>
            <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </ErrorBoundary>
      </main>
      <Footer />
      <CookieConsent />
      <MobileNav />
    </>
  );
}

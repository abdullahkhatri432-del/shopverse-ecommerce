import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  const linkClass = ({ isActive }) => `admin-tab ${isActive ? 'active' : ''}`;
  return (
    <div className="container section">
      <h1 className="page-title">Admin panel</h1>
      <div className="admin-tabs">
        <NavLink to="/admin/products" className={linkClass}>
          Products
        </NavLink>
        <NavLink to="/admin/categories" className={linkClass}>
          Categories
        </NavLink>
        <NavLink to="/admin/orders" className={linkClass}>
          Orders
        </NavLink>
      </div>
      <Outlet />
    </div>
  );
}

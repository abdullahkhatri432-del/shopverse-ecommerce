import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const load = () => {
    setLoading(true);
    api
      .get('/admin/categories', { auth: true })
      .then((d) => setCategories(d.categories))
      .catch((err) => push(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post('/admin/categories', { name: name.trim() }, { auth: true });
      push('Category added');
      setName('');
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await api.del(`/admin/categories/${c.id}`, { auth: true });
      push('Category deleted');
      load();
    } catch (err) {
      push(err.message, 'error');
    }
  };

  return (
    <div className="admin-content">
      <div className="admin-grid">
        <div className="admin-main">
          <h2>Categories ({categories.length})</h2>
          <p className="results-count">
            Sellers can only pick from these categories, so add them here first.
          </p>
          {loading ? (
            <div className="page-loading">Loading...</div>
          ) : categories.length === 0 ? (
            <div className="empty-state">
              <p>No categories yet. Add one to get started.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Products</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.productCount}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="admin-form-card">
          <h3>Add category</h3>
          <form onSubmit={handleAdd} className="auth-form">
            <label className="field">
              <span>Category name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Electronics"
                required
              />
            </label>
            <button className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Adding...' : 'Add category'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

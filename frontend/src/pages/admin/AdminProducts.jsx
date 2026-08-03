import { useEffect, useState } from 'react';
import { api, formatPrice } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

const EMPTY = {
  name: '',
  description: '',
  price: '',
  imageUrl: '',
  category: 'general',
  stock: 0,
  featured: false,
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { push } = useToast();

  const load = () => {
    setLoading(true);
    api
      .get('/admin/products', { auth: true })
      .then((d) => setProducts(d.products))
      .catch((err) => push(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api
      .get('/admin/categories', { auth: true })
      .then((d) => setCategories(d.categories))
      .catch((err) => push(err.message, 'error'));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrl: p.imageUrl,
      category: p.category,
      stock: p.stock,
      featured: p.featured,
    });
  };

  const set = (key) => (e) => {
    const value = key === 'featured' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await api.upload('/admin/upload', file, { auth: true });
      setForm((f) => ({ ...f, imageUrl: data.url }));
      push('Image uploaded');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
      if (editing === null) {
        await api.post('/admin/products', payload, { auth: true });
        push('Product created');
      } else {
        await api.put(`/admin/products/${editing}`, payload, { auth: true });
        push('Product updated');
      }
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.del(`/admin/products/${p.id}`, { auth: true });
      push('Product deleted');
      load();
    } catch (err) {
      push(err.message, 'error');
    }
  };

  return (
    <div className="admin-content">
      <div className="admin-grid">
        <div className="admin-main">
          <div className="section-head">
            <h2>Products ({products.length})</h2>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + New product
            </button>
          </div>
          {loading ? (
            <div className="page-loading">Loading...</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Featured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product">
                        <img src={p.imageUrl} alt="" width="40" height="40" />
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td>{formatPrice(p.priceCents)}</td>
                    <td>{p.stock}</td>
                    <td>{p.featured ? '✓' : ''}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(p)}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="admin-form-card">
          <h3>{editing === null ? 'Add product' : 'Edit product'}</h3>
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="field">
              <span>Name</span>
              <input value={form.name} onChange={set('name')} required />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea value={form.description} onChange={set('description')} rows={3} />
            </label>
            <label className="field">
              <span>Price</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={set('price')}
                required
              />
            </label>
            <div className="field">
              <span>Product image</span>
              {form.imageUrl && (
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  className="image-upload-preview"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleImageUpload}
                disabled={uploading}
              />
              <span className="hint">
                {uploading ? 'Uploading...' : 'Upload a photo, or paste an image URL below.'}
              </span>
            </div>
            <label className="field">
              <span>Image URL</span>
              <input value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://... or /uploads/..." />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Category</span>
                <select value={form.category} onChange={set('category')} required>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Stock</span>
                <input type="number" min="0" value={form.stock} onChange={set('stock')} />
              </label>
            </div>
            <label className="checkbox-field">
              <input type="checkbox" checked={form.featured} onChange={set('featured')} />
              <span>Featured on home page</span>
            </label>
            <div className="row-actions">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : editing === null ? 'Add product' : 'Save changes'}
              </button>
              {editing !== null && (
                <button type="button" className="btn btn-ghost" onClick={openCreate}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

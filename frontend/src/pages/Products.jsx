import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import ProductCard from '../components/ProductCard';
import ProductSlider from '../components/ProductSlider';
import SearchSuggest from '../components/SearchSuggest';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import Seo from '../components/Seo';

export default function Products() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'newest';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStock = searchParams.get('inStock') === '1';

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState(search);
  const [fallback, setFallback] = useState([]);

  useEffect(() => {
    api
      .get('/products/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (inStock) params.set('inStock', '1');
    api
      .get(`/products?${params.toString()}`)
      .then((d) => {
        setProducts(d.products);
        setTotal(d.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, search, sort, minPrice, maxPrice, inStock]);

  useEffect(() => {
    if (!loading && products.length === 0 && total === 0) {
      api
        .get('/products/recommend?limit=8')
        .then((d) => setFallback(d.products))
        .catch(() => {});
    }
  }, [loading, products.length, total]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (localSearch.trim()) next.set('search', localSearch.trim());
      else next.delete('search');
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="container section">
      <Seo
        title="Shop - ShopVerse"
        description="Browse electronics, fashion, home goods and more at ShopVerse."
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span className="breadcrumbs-current">Shop</span>
        {category && (
          <>
            <span aria-hidden="true">/</span>
            <span className="breadcrumbs-current">{category}</span>
          </>
        )}
      </nav>
      <h1 className="page-title">Shop</h1>

      <SearchSuggest
        className="products-search"
        value={localSearch}
        onValueChange={setLocalSearch}
        onSearch={(q) => updateParam('search', q)}
        onCategory={(c) => {
          const next = new URLSearchParams(searchParams);
          next.delete('search');
          next.set('category', c);
          setSearchParams(next, { replace: true });
          setLocalSearch('');
        }}
        onProduct={(p) => navigate(`/product/${p.id}`)}
      />

      <div className="shop-layout">
        <aside className="filters">
          <h3>Categories</h3>
          <button
            className={`filter-chip ${category === '' ? 'active' : ''}`}
            onClick={() => updateParam('category', '')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`filter-chip ${category === c ? 'active' : ''}`}
              onClick={() => updateParam('category', c)}
            >
              {c}
            </button>
          ))}

          <h3>Min price</h3>
          <select
            value={minPrice}
            onChange={(e) => updateParam('minPrice', e.target.value)}
            className="select-full"
          >
            <option value="">Any price</option>
            <option value="100">₹100 & up</option>
            <option value="500">₹500 & up</option>
            <option value="1000">₹1,000 & up</option>
            <option value="5000">₹5,000 & up</option>
            <option value="10000">₹10,000 & up</option>
          </select>

          <h3>Max price</h3>
          <select
            value={maxPrice}
            onChange={(e) => updateParam('maxPrice', e.target.value)}
            className="select-full"
          >
            <option value="">Any price</option>
            <option value="25">Under ₹25</option>
            <option value="50">Under ₹50</option>
            <option value="100">Under ₹100</option>
            <option value="250">Under ₹250</option>
            <option value="500">Under ₹500</option>
            <option value="1000">Under ₹1,000</option>
            <option value="2500">Under ₹2,500</option>
            <option value="5000">Under ₹5,000</option>
          </select>

          <label className="filter-check">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => updateParam('inStock', e.target.checked ? '1' : '')}
            />
            <span>In stock only</span>
          </label>

          <h3>Sort</h3>
          <select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="select-full"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name">Name A–Z</option>
          </select>
        </aside>

        <div className="shop-results">
          <p className="results-count" aria-live="polite">
            {loading ? 'Loading...' : `${total} product${total === 1 ? '' : 's'} found`}
          </p>
          {loading ? (
            <div className="product-grid" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="product-card" key={i}>
                  <Skeleton style={{ aspectRatio: '4 / 3' }} />
                  <div className="product-body">
                    <Skeleton style={{ width: '40%', height: 12 }} />
                    <Skeleton style={{ width: '80%', height: 16 }} />
                    <Skeleton style={{ width: '60%', height: 16 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <>
              <EmptyState
                title="No products found"
                subtitle="Try adjusting your search or filters."
              >
                <button className="btn btn-primary" onClick={() => setSearchParams({})}>
                  Clear filters
                </button>
              </EmptyState>
              {fallback.length > 0 && (
                <ProductSlider title="Popular right now" viewAll="/products" products={fallback} />
              )}
            </>
          ) : (
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

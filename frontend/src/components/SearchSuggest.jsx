import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../lib/api';

export default function SearchSuggest({
  value,
  onValueChange,
  onSearch,
  onCategory,
  onProduct,
  placeholder = 'Search products...',
  className = '',
  autoFocus = false,
}) {
  const navigate = useNavigate();
  const [term, setTerm] = useState(value || '');
  const effectiveValue = value !== undefined ? value : term;
  const setValue = onValueChange || setTerm;
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await api.get(`/products/suggest?q=${encodeURIComponent(effectiveValue.trim())}`);
        if (boxRef.current) {
          setProducts(d.products || []);
          setCategories(d.categories || []);
        }
      } catch {
        // ignore suggestion failures
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [effectiveValue]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const list = [
    ...categories.map((c) => ({ type: 'category', label: c })),
    ...products.map((p) => ({ type: 'product', label: p.name, product: p })),
  ];

  const goTo = (path) => {
    setOpen(false);
    setActive(-1);
    navigate(path);
  };

  const commitSearch = (q) => {
    setOpen(false);
    setActive(-1);
    const trimmed = q.trim();
    if (onSearch) onSearch(trimmed);
    else goTo(`/products?search=${encodeURIComponent(trimmed)}`);
  };

  const pick = (item) => {
    setOpen(false);
    setActive(-1);
    if (item.type === 'product') {
      if (onProduct) onProduct(item.product);
      else goTo(`/product/${item.product.id}`);
    } else if (item.type === 'category') {
      if (onCategory) onCategory(item.label);
      else goTo(`/products?category=${encodeURIComponent(item.label)}`);
    } else {
      commitSearch(item.label);
    }
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setOpen(true);
      setActive(e.key === 'ArrowDown' ? 0 : list.length - 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(list.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + Math.max(list.length, 1)) % Math.max(list.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && active < list.length) pick(list[active]);
      else if (effectiveValue.trim()) commitSearch(effectiveValue);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && active < list.length) pick(list[active]);
    else if (effectiveValue.trim()) commitSearch(effectiveValue);
  };

  const noResults = open && !loading && effectiveValue.trim() && list.length === 0;
  const hasResults = open && !loading && list.length > 0;

  return (
    <div className={`search-box ${className}`} ref={boxRef}>
      <form role="search" onSubmit={submit}>
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={effectiveValue}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          role="combobox"
          aria-expanded={open && !loading}
          aria-controls="search-suggestions"
          aria-activedescendant={active >= 0 ? `search-item-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
        />
        <button type="submit" className="search-submit" aria-label="Search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </form>

      {loading && open && (
        <div className="search-suggestions search-status" role="status">
          Searching…
        </div>
      )}

      {noResults && (
        <div className="search-suggestions" id="search-suggestions" role="listbox">
          <p className="suggest-none">No matches for “{effectiveValue.trim()}”.</p>
          <button type="button" className="suggest-footer" onClick={() => commitSearch(effectiveValue)}>
            See all results for “{effectiveValue.trim()}” →
          </button>
        </div>
      )}

      {hasResults && (
        <ul className="search-suggestions" id="search-suggestions" role="listbox">
          {categories.length > 0 && (
            <li className="suggest-group" role="presentation">
              Categories
            </li>
          )}
          {categories.map((c, ci) => (
            <li
              key={`cat-${c}`}
              id={`search-item-${ci}`}
              role="option"
              aria-selected={active === ci}
              className={`suggest-item suggest-cat ${active === ci ? 'active' : ''}`}
              onMouseEnter={() => setActive(ci)}
              onClick={() => pick({ type: 'category', label: c })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
              </svg>
              <span>{c}</span>
            </li>
          ))}
          {products.length > 0 && <li className="suggest-group suggest-group-products">Products</li>}
          {products.map((p, i) => {
            const idx = categories.length + i;
            return (
              <li
                key={`prod-${p.id}`}
                id={`search-item-${idx}`}
                role="option"
                aria-selected={active === idx}
                className={`suggest-item ${active === idx ? 'active' : ''}`}
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick({ type: 'product', product: p })}
              >
                <img src={p.imageUrl} alt="" className="suggest-thumb" loading="lazy" />
                <span className="suggest-item-name">
                  {p.name}
                  {p.stock <= 0 && <em className="suggest-out"> · Out of stock</em>}
                </span>
                <span className="suggest-item-price">{formatPrice(p.priceCents)}</span>
              </li>
            );
          })}
          <button
            type="button"
            className="suggest-footer"
            onClick={() => commitSearch(effectiveValue)}
          >
            See all results for “{effectiveValue.trim()}” →
          </button>
        </ul>
      )}
    </div>
  );
}

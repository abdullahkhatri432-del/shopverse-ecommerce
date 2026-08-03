import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const WishlistContext = createContext(null);
const KEY = 'sv_wishlist';

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const has = (productId) => items.some((i) => i.id === productId);

  const toggle = (product) => {
    setItems((prev) =>
      has(product.id)
        ? prev.filter((i) => i.id !== product.id)
        : [
            ...prev,
            {
              id: product.id,
              name: product.name,
              priceCents: product.priceCents,
              imageUrl: product.imageUrl,
              stock: product.stock,
              category: product.category,
            },
          ]
    );
  };

  const remove = (productId) => setItems((prev) => prev.filter((i) => i.id !== productId));

  const count = useMemo(() => items.length, [items]);

  return (
    <WishlistContext.Provider value={{ items, has, toggle, remove, count }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}

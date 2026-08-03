import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const STORAGE_KEY = 'sv_cart';
const TOKEN_KEY = 'sv_cart_token';

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function getGuestToken() {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

function toServerItems(items) {
  return items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState(loadCart);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const prevLoggedIn = useRef(undefined);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const loggedIn = !!user;
    if (loggedIn && !prevLoggedIn.current) {
      setHydrated(false);
      const token = getGuestToken();
      api
        .put('/cart', { cartToken: token, items: toServerItems(loadCart()) })
        .catch(() => {})
        .then(() => api.post('/cart/merge', { cartToken: token }, { auth: true }))
        .then((d) => {
          setItems(d.items);
          localStorage.removeItem(TOKEN_KEY);
        })
        .catch(() => {})
        .finally(() => setHydrated(true));
    } else {
      setHydrated(true);
    }
    prevLoggedIn.current = loggedIn;
  }, [user]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      if (user) {
        api.put('/cart', { items: toServerItems(items) }, { auth: true }).catch(() => {});
      } else {
        api.put('/cart', { cartToken: getGuestToken(), items: toServerItems(items) }).catch(() => {});
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [items, hydrated, user]);

  const add = (product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) } : i
        );
      }
      return [...prev, { productId: product.id, name: product.name, priceCents: product.priceCents, imageUrl: product.imageUrl, stock: product.stock, quantity }];
    });
  };

  const remove = (productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const setQuantity = (productId, quantity) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.productId !== productId) return i;
        const qty = Math.max(1, Math.min(quantity, i.stock));
        return { ...i, quantity: qty };
      })
    );
  };

  const clear = () => setItems([]);

  const openCart = () => setDrawerOpen(true);
  const closeCart = () => setDrawerOpen(false);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{ items, count, subtotal, add, remove, setQuantity, clear, drawerOpen, openCart, closeCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

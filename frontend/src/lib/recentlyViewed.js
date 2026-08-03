const KEY = 'sv_recent';
const MAX = 12;

export function addRecentlyViewed(product) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY)) || [];
    const entry = {
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      stock: product.stock,
      category: product.category,
    };
    const next = [entry, ...list.filter((i) => i.id !== product.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — ignore
  }
}

export function getRecentlyViewed() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

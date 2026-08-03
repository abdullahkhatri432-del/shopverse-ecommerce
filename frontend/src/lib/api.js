const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('sv_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('sv_token', token);
  else localStorage.removeItem('sv_token');
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts }),
  post: (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  put: (path, body, opts) => request(path, { method: 'PUT', body, ...opts }),
  patch: (path, body, opts) => request(path, { method: 'PATCH', body, ...opts }),
  del: (path, opts) => request(path, { method: 'DELETE', ...opts }),
  upload: async (path, file, opts) => {
    const headers = {};
    if (opts?.auth) {
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const body = new FormData();
    body.append('image', file);
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new Error((data && data.error) || 'Upload failed');
    }
    return data;
  },
};

let siteConfig = {
  paymentProvider: 'mock',
  paymentMode: 'mock',
  currency: 'INR',
  razorpayKeyId: '',
  codEnabled: true,
  googleClientId: '',
  store: {
    name: 'ShopVerse',
    legalName: '',
    proprietor: '',
    address: '',
    email: '',
    phone: '',
    website: '',
    gstin: '',
    stateCode: '',
    stateName: '',
    grievanceOfficer: { name: '', email: '', phone: '' },
  },
};

export async function loadConfig() {
  try {
    const data = await api.get('/config');
    if (data) siteConfig = { ...siteConfig, ...data };
  } catch {
    // keep defaults if the backend is unavailable
  }
  return siteConfig;
}

export function getConfig() {
  return siteConfig;
}

export function getStore() {
  return siteConfig.store || {};
}

export function getGrievanceOfficer() {
  const s = getStore();
  return s.grievanceOfficer || {};
}

export function formatPrice(cents) {
  const value = (cents ?? 0) / 100;
  if (siteConfig.currency === 'INR') {
    return '₹' + value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

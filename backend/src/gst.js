const INDIA_STATES = [
  { code: 'AN', name: 'Andaman and Nicobar Islands' },
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CH', name: 'Chandigarh' },
  { code: 'CG', name: 'Chhattisgarh' },
  { code: 'DD', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: 'DL', name: 'Delhi' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JK', name: 'Jammu and Kashmir' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'LA', name: 'Ladakh' },
  { code: 'LD', name: 'Lakshadweep' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OD', name: 'Odisha' },
  { code: 'PY', name: 'Puducherry' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TS', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UK', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' },
];

const stateByCode = Object.fromEntries(INDIA_STATES.map((s) => [s.code, s.name]));

const GST_RATES = {
  'Food & Beverages': 5,
  Books: 5,
  Groceries: 5,
  'Daily Essentials': 5,
  'Essential Commodities': 5,
  Clothing: 12,
  'Health & Personal Care': 12,
  'Home & Kitchen': 18,
  Electronics: 18,
  Mobile: 18,
  'Men': 12,
  'Women': 12,
  'Kids': 12,
  'Sports & Outdoors': 18,
  'Beauty & Care': 18,
  'Toys & Games': 18,
  general: 18,
};

function gstRateFor(category) {
  const clean = String(category || '').trim();
  if (!clean) return 18;
  if (GST_RATES[clean] !== undefined) return GST_RATES[clean];
  const lower = clean.toLowerCase();
  if (lower.includes('book')) return 5;
  if (lower.includes('food') || lower.includes('grocery') || lower.includes('essential')) return 5;
  if (lower.includes('cloth') || lower.includes('apparel') || lower.includes('textile')) return 12;
  return 18;
}

function validateGstin(gstin) {
  if (!gstin) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(gstin).toUpperCase());
}

function isValidState(code) {
  return !!stateByCode[String(code).toUpperCase()];
}

function stateName(code) {
  return stateByCode[String(code).toUpperCase()] || String(code).toUpperCase();
}

function roundCents(n) {
  return Math.round(n);
}

function splitGst(taxableCents, ratePercent, sellerState, buyerState) {
  const rate = Number(ratePercent) || 0;
  const gstCents = roundCents((taxableCents * rate) / 100);
  const sameState = isValidState(sellerState) && stateName(sellerState) === stateName(buyerState);
  if (sameState) {
    const cgst = Math.floor(gstCents / 2);
    const sgst = gstCents - cgst;
    return { cgst, sgst, igst: 0, gst: gstCents, rate, intraState: true };
  }
  return { cgst: 0, sgst: 0, igst: gstCents, gst: gstCents, rate, intraState: false };
}

function generateInvoiceNumber(orderId) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(orderId).padStart(6, '0')}`;
}

module.exports = {
  INDIA_STATES,
  GST_RATES,
  gstRateFor,
  validateGstin,
  isValidState,
  stateName,
  splitGst,
  generateInvoiceNumber,
};

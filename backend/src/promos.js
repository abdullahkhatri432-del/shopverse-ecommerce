const PROMOS = {
  FIRST10: { type: 'percent', value: 10, maxCents: 50000, label: '10% off (up to ₹500)' },
  WELCOME15: { type: 'percent', value: 15, maxCents: 75000, label: '15% off (up to ₹750)' },
  CODE20: { type: 'percent', value: 20, maxCents: 100000, label: '20% off (up to ₹1,000)' },
  SAVE50: { type: 'flat', valueCents: 5000, label: 'Flat ₹50 off' },
};

function applyPromo(code, subtotalCents) {
  const key = String(code || '').trim().toUpperCase();
  const promo = PROMOS[key];
  if (!promo) return null;
  let discountCents =
    promo.type === 'percent'
      ? Math.round((subtotalCents * promo.value) / 100)
      : promo.valueCents;
  if (promo.maxCents) discountCents = Math.min(discountCents, promo.maxCents);
  discountCents = Math.max(0, Math.min(discountCents, subtotalCents));
  return { code: key, label: promo.label, discountCents };
}

function promoList() {
  return Object.entries(PROMOS).map(([code, p]) => ({
    code,
    label: p.label,
  }));
}

module.exports = { PROMOS, applyPromo, promoList };

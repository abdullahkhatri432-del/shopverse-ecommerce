const round = (n) => Math.round(n);

const DEFAULTS = {
  commissionBps: 1000, // 1000 = 10%
  gatewayFeeBps: 200, // 200 = 2% of total charged
  gatewayFeeGstBps: 1800, // 18% GST on the gateway fee
  feeBorneBy: 'platform', // 'platform' | 'seller'
};

/**
 * Split one line item into taxable value, tax, commission, gateway fee and
 * seller payout. Commission is computed on the TAXABLE value (GST is never
 * part of a seller's income).
 */
function computeItemSplit({
  priceCents,
  taxCents,
  quantity = 1,
  commissionBps = DEFAULTS.commissionBps,
  gatewayFeeBps = DEFAULTS.gatewayFeeBps,
  gatewayFeeGstBps = DEFAULTS.gatewayFeeGstBps,
  feeBorneBy = DEFAULTS.feeBorneBy,
}) {
  const taxable = priceCents * quantity;
  const tax = taxCents * quantity;
  const commission = round((taxable * commissionBps) / 10000);
  const lineTotalPaid = taxable + tax;
  const gatewayFee = round((lineTotalPaid * gatewayFeeBps) / 10000);
  const gatewayGst = round((gatewayFee * gatewayFeeGstBps) / 10000);
  const fee = gatewayFee + gatewayGst;
  const payout =
    feeBorneBy === 'seller' ? taxable - commission - fee : taxable - commission;
  return { taxable, tax, commission, gatewayFee, gatewayGst, fee, payout };
}

/**
 * Split a whole order. Input items must carry { vendorId, priceCents, taxCents,
 * quantity, commissionBps }. Returns order totals plus a per-vendor breakdown
 * ready to map to Razorpay transfers.
 */
function splitOrder(items, options = {}) {
  const byVendor = new Map();
  let subtotal = 0;
  let totalTax = 0;
  let totalCommission = 0;
  let totalFee = 0;
  let totalPayout = 0;

  for (const it of items) {
    const s = computeItemSplit({ ...it, ...options });
    subtotal += s.taxable;
    totalTax += s.tax;
    totalCommission += s.commission;
    totalFee += s.fee;
    totalPayout += s.payout;

    if (!byVendor.has(it.vendorId)) {
      byVendor.set(it.vendorId, {
        vendorId: it.vendorId,
        payout: 0,
        commission: 0,
        fee: 0,
        lines: [],
      });
    }
    const v = byVendor.get(it.vendorId);
    v.payout += s.payout;
    v.commission += s.commission;
    v.fee += s.fee;
    v.lines.push({ productId: it.productId, ...s });
  }

  const totalPaid = subtotal + totalTax;
  return {
    subtotal,
    totalTax,
    totalPaid,
    totalCommission,
    totalFee,
    totalPayout,
    feeBorneBy: options.feeBorneBy || DEFAULTS.feeBorneBy,
    byVendor: [...byVendor.values()],
  };
}

module.exports = { DEFAULTS, computeItemSplit, splitOrder, round };

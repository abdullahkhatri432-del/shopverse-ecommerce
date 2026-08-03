/**
 * End-to-end marketplace demo with a mock Razorpay (no keys required).
 * Run:  node backend/src/marketplace/demo.js
 *
 * Flow: register 2 vendors -> list products -> multi-vendor checkout ->
 *       capture + split at the source -> vendor balances/ledger -> refund.
 */
const { openMarketplaceDb } = require('./db');
const { createMarketplaceService } = require('./service');
const { computeItemSplit } = require('./splits');

const inr = (cents) => '₹' + (cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  const db = openMarketplaceDb();
  const service = createMarketplaceService({ db });
  console.log(`\n=== ShopVerse Marketplace (mock Razorpay: ${service.isMock ? 'yes' : 'no'}) ===\n`);

  // 1) Vendor onboarding -> creates Razorpay Route linked account + fund account (mock).
  const v1 = await service.registerVendor({
    name: 'Vendor A',
    email: 'v1@example.com',
    password: 'secret',
    phone: '9000000001',
    business: { legalName: 'Acme Electronics', ownerName: 'Vendor A', pan: 'ABCDE1234F', businessType: 'proprietorship' },
    bank: { accountHolder: 'Vendor A', accountNumber: '1112223334', ifsc: 'HDFC0001234' },
    address: { street1: 'MG Road', city: 'Bengaluru', state: 'KA', postalCode: '560001' },
  });
  const v2 = await service.registerVendor({
    name: 'Vendor B',
    email: 'v2@example.com',
    password: 'secret',
    phone: '9000000002',
    business: { legalName: 'Mega Home Goods', ownerName: 'Vendor B', pan: 'ZYXWV9876C', businessType: 'proprietorship' },
    bank: { accountHolder: 'Vendor B', accountNumber: '5556667778', ifsc: 'ICIC0002233' },
    address: { street1: 'Banjara Hills', city: 'Hyderabad', state: 'TS', postalCode: '500034' },
  });
  console.log(`Vendor A: id=${v1.id} status=${v1.status} routeAccount=${v1.razo_account_id}`);
  console.log(`Vendor B: id=${v2.id} status=${v2.status} routeAccount=${v2.razo_account_id}`);

  // 2) Vendors list products (Electronics = 12% commission, General = 10%).
  const p1 = service.addProduct({
    vendorId: v1.id,
    categoryId: 1, // Electronics
    name: 'Wireless Headphones',
    priceCents: 100000, // ₹1,000 + 18% GST
    stock: 10,
  });
  const p2 = service.addProduct({
    vendorId: v2.id,
    categoryId: 4, // General
    name: 'Ceramic Mug Set',
    priceCents: 50000, // ₹500 + 18% GST
    stock: 20,
  });
  console.log(`\nProducts listed: #${p1.id} (Vendor A) and #${p2.id} (Vendor B)`);

  // 3) Multi-vendor checkout -> order + payment intent + pending per-vendor split.
  const { order, paymentIntent } = await service.placeOrder({
    customer: { id: null, name: 'Priya Sharma', email: 'priya@example.com' },
    shipping: '12 Lake View, Delhi',
    items: [
      { productId: p1.id, quantity: 1 },
      { productId: p2.id, quantity: 1 },
    ],
  });
  console.log(`\nOrder #${order.id}: total ${inr(order.total_cents)} (subtotal ${inr(order.subtotal_cents)} + GST ${inr(order.tax_cents)})`);
  console.log(`Payment intent: ${paymentIntent.id} (mock)`);

  // Show the line-level split math.
  console.log('\nLine splits:');
  for (const line of [
    { priceCents: 100000, taxCents: 18000, quantity: 1, commissionBps: 1200 },
    { priceCents: 50000, taxCents: 9000, quantity: 1, commissionBps: 1000 },
  ]) {
    const s = computeItemSplit(line);
    console.log(
      `  ${line.priceCents === 100000 ? 'Headphones' : 'Mug Set'}: taxable ${inr(s.taxable)} | commission ${inr(s.commission)} | seller payout ${inr(s.payout)}`
    );
  }

  // 4) Customer pays; webhook fires payment.captured -> we capture + transfer.
  const feeCents = Math.round((order.total_cents * 200) / 10000); // 2% gateway fee
  const feeGst = Math.round((feeCents * 1800) / 10000); // 18% GST on fee
  console.log(`\nGateway fee (2% of ${inr(order.total_cents)}) = ${inr(feeCents)} + GST ${inr(feeGst)} (borne by platform)`);

  const paid = await service.capturePayment({
    orderId: order.id,
    paymentId: `pay_${Date.now()}`,
    gatewayFeeCents: feeCents,
    gatewayFeeGstCents: feeGst,
  });
  console.log(`Order #${paid.id}: ${paid.status} / ${paid.payment_status}`);

  console.log('\nVendor balances after capture (payouts auto-transferred via Route):');
  console.log(`  Vendor A: ${inr(service.vendorBalance(v1.id).availableCents)}`);
  console.log(`  Vendor B: ${inr(service.vendorBalance(v2.id).availableCents)}`);

  // 5) Ledger snapshot.
  console.log('\nLedger:');
  for (const l of service.ledger()) {
    console.log(`  [${l.direction}] ${l.category.padEnd(11)} ${l.account.padEnd(16)} ${inr(l.amount_cents)}`);
  }

  // 6) Order cancelled -> full refund, transfers reversed.
  const refunded = await service.refundOrder({ orderId: order.id, reason: 'Customer cancelled' });
  console.log(`\nOrder #${refunded.id}: ${refunded.status} (refunded)`);
  console.log('Vendor balances after refund:');
  console.log(`  Vendor A: ${inr(service.vendorBalance(v1.id).availableCents)}`);
  console.log(`  Vendor B: ${inr(service.vendorBalance(v2.id).availableCents)}`);

  console.log('\nDemo complete. Enable RAZORPAY_KEY_ID/SECRET for real Route settlements.\n');
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});

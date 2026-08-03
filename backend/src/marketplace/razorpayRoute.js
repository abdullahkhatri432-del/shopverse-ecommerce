/**
 * Razorpay Route (Marketplace Settlement) integration.
 *
 * Real mode: uses the `razorpay` npm package with RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.
 * Mock mode: when keys are absent, returns synthetic ids so the full flow can be
 * exercised locally with zero configuration.
 *
 * Reference flow for a managed marketplace:
 *   1. On vendor registration  -> onboardVendor()   (creates a Linked Account)
 *   2. After vendor KYC        -> addFundAccount()  (attaches the vendor bank account)
 *   3. On payment capture      -> createPaymentTransfers() (splits at the source)
 *   4. On refund/cancellation  -> refundPayment()   (reverses transfers)
 */

const MOCK_PREFIXES = { acc: 'acc', fa: 'fa', trf: 'trf', rfnd: 'rfnd', ord: 'order', pay: 'pay' };

function getClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const Razorpay = require('razorpay');
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function mockId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function extractError(err, fallback) {
  return (
    (err && err.error && (err.error.description || err.error.reason)) ||
    (err && err.message) ||
    fallback
  );
}

/**
 * Create a Razorpay Route linked account for a vendor.
 * https://razorpay.com/docs/api/route/linked-account-entities/
 */
async function onboardVendor(client, {
  email,
  phone,
  legalBusinessName,
  customerFacingName,
  businessType = 'proprietorship',
  pan,
  gstin,
  address,
}) {
  if (!client) {
    return { id: mockId(MOCK_PREFIXES.acc), kycRequired: true, mock: true };
  }
  try {
    const account = await client.accounts.create({
      email,
      phone,
      legal_business_name: legalBusinessName,
      customer_facing_business_name: customerFacingName,
      business_type: businessType,
      profile: {
        category: 'physical_goods',
        subcategory: 'electronics',
        addresses: {
          registered: {
            street1: (address && address.street1) || '',
            city: (address && address.city) || '',
            state: (address && address.state) || '',
            postal_code: (address && address.postalCode) || '',
            country: 'IN',
          },
        },
      },
      legal_info: { pan: pan || undefined, gst: gstin || undefined },
    });
    return { id: account.id, kycRequired: true };
  } catch (err) {
    throw new Error(`Razorpay linked account creation failed: ${extractError(err, err.message)}`);
  }
}

/**
 * Attach a bank fund account to a linked account (the vendor's payout destination).
 * https://razorpay.com/docs/api/route/fund-accounts/
 */
async function addFundAccount(client, accountId, { name, ifsc, accountNumber, email, phone }) {
  if (!client) {
    return { id: mockId(MOCK_PREFIXES.fa), mock: true };
  }
  try {
    const fundAccount = await client.fundAccounts.create({
      account_id: accountId,
      contact: {
        name,
        email,
        phone,
        type: 'customer',
        reference_id: `vendor_${Date.now()}`,
      },
      bank_account: { name, ifsc, account_number: accountNumber },
      type: 'bank_account',
    });
    return { id: fundAccount.id };
  } catch (err) {
    throw new Error(`Razorpay fund account creation failed: ${extractError(err, err.message)}`);
  }
}

/**
 * Create an order (payment intent) for the total the customer pays.
 */
async function createOrder(client, { amountCents, currency = 'INR', receipt, notes }) {
  if (!client) {
    return { id: mockId(MOCK_PREFIXES.ord), amount: amountCents, currency, mock: true };
  }
  const order = await client.orders.create({
    amount: amountCents,
    currency,
    receipt,
    notes: notes || {},
  });
  return { id: order.id, amount: Number(order.amount), currency: order.currency };
}

/**
 * Split a captured payment at the source: one transfer per vendor to their
 * linked account. `fee`/`tax` are passed only when the seller bears the gateway
 * fee, so Razorpay deducts them from the transfer itself.
 * https://razorpay.com/docs/api/route/payments/transfers/
 */
async function createPaymentTransfers(client, paymentId, transfers) {
  if (!client) {
    return transfers.map((t) => ({
      id: mockId(MOCK_PREFIXES.trf),
      account: t.account,
      amount: t.amount,
      status: 'processed',
      mock: true,
    }));
  }
  try {
    const result = await client.payments.transfer(paymentId, {
      transfers: transfers.map((t) => ({
        account: t.account,
        amount: t.amount,
        currency: t.currency || 'INR',
        notes: t.notes || {},
        fee: t.fee || 0,
        tax: t.tax || 0,
      })),
    });
    return (result.items || []).map((t) => ({
      id: t.id,
      account: t.account,
      amount: Number(t.amount),
      status: t.status,
    }));
  } catch (err) {
    throw new Error(`Razorpay transfer creation failed: ${extractError(err, err.message)}`);
  }
}

/**
 * Refund a payment. With `reverse_all: 1` Razorpay reverses any transfers it
 * already made from that payment (handles canceled orders cleanly). For a
 * partial refund pass `amountCents`.
 * https://razorpay.com/docs/api/route/refunds/
 */
async function refundPayment(client, paymentId, { amountCents = null, reverseAll = true, notes = {} }) {
  if (!client) {
    return { id: mockId(MOCK_PREFIXES.rfnd), amount: amountCents, status: 'processed', mock: true };
  }
  const body = { notes };
  if (reverseAll) body.reverse_all = 1;
  if (amountCents != null) body.amount = amountCents;
  try {
    const refund = await client.payments.refund(paymentId, body);
    return {
      id: refund.id,
      amount: Number(refund.amount),
      status: refund.status,
      receipt: refund.receipt,
    };
  } catch (err) {
    throw new Error(`Razorpay refund failed: ${extractError(err, err.message)}`);
  }
}

module.exports = {
  getClient,
  onboardVendor,
  addFundAccount,
  createOrder,
  createPaymentTransfers,
  refundPayment,
};

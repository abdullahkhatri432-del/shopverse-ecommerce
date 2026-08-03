require('dotenv').config();

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' },
  });
}

function storeInfo() {
  return {
    name: process.env.STORE_NAME || 'ShopVerse',
    legalName: process.env.STORE_LEGAL_NAME || 'Your Legal Business Name',
    email: process.env.STORE_EMAIL || 'support@yourstore.com',
    phone: process.env.STORE_PHONE || '+91 90000 00000',
  };
}

function from() {
  const store = storeInfo();
  const email = process.env.SMTP_FROM || store.email;
  return `"${store.name}" <${email}>`;
}

async function send({ to, subject, text, html }) {
  if (!transporter) {
    console.log(
      `[mailer:mock] To: ${to} | Subject: ${subject}\n${text}\n` +
        'SMTP not configured — install SMTP_HOST/SMTP_USER/SMTP_PASS to send real email.'
    );
    return;
  }
  try {
    await transporter.sendMail({ from: from(), to, subject, text, html });
  } catch (err) {
    console.error('[mailer] send failed:', err.message);
  }
}

function orderEmailParts(order, items) {
  const store = storeInfo();
  const lines = items
    .map((i) => `${i.quantity} × ${i.productName} — Rs.${(i.priceCents / 100).toFixed(2)}`)
    .join('\n');
  const total = `Rs.${(order.total_cents / 100).toFixed(2)}`;
  const text = `Hi ${order.customer_name},\n\nThank you for your order #${order.id} at ${store.name}!\n\nItems:\n${lines}\n\nTotal: ${total}\nPayment method: ${order.payment_method}\n\nWe'll email you tracking details once it ships.\n\nContact us at ${store.email} or ${store.phone}.\n\n— ${store.name}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
    <h2>Order confirmed — #${order.id}</h2>
    <p>Hi ${order.customer_name}, thanks for shopping at ${store.name}!</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
      <tr style="background:#f4f4f5"><th align="left">Item</th><th align="right">Amount</th></tr>
      ${items
        .map(
          (i) =>
            `<tr><td>${i.quantity} × ${i.product_name}</td><td align="right">Rs.${(i.price_cents / 100).toFixed(2)}</td></tr>`
        )
        .join('')}
      <tr><td><strong>Total</strong></td><td align="right"><strong>${total}</strong></td></tr>
    </table>
    <p>Payment: ${order.payment_method}</p>
    <p>We'll send tracking details once your order ships.</p>
    <p>Questions? ${store.email} · ${store.phone}</p>
  </div>`;
  return { text, html };
}

function sendOrderConfirmation(order, items) {
  return send({
    to: order.customer_email,
    subject: `Order confirmed #${order.id} — ${storeInfo().name}`,
    ...orderEmailParts(order, items),
  });
}

function sendAdminNewOrder(order, items) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const { text } = orderEmailParts(order, items);
  return send({
    to: adminEmail,
    subject: `[Admin] New order #${order.id}`,
    text: `New order received:\n\n${text}`,
    html: `<p>New order <strong>#${order.id}</strong> received.</p><pre>${text}</pre>`,
  });
}

module.exports = { sendOrderConfirmation, sendAdminNewOrder };

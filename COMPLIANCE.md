# Legal & Compliance Checklist (India)

This document maps the ShopVerse store to Indian legal requirements. The app already
ships with most of the *implementable* pieces; the remaining items are registrations and
external processes you must complete before taking live payments in India.

> ⚠️ This is general information, not legal advice. Confirm with a CA / lawyer before going live.

## Already implemented in the app

| Requirement | Status | Where |
| ----------- | ------ | ----- |
| Terms of Service, Privacy Policy, Refund & Return, Shipping, Cancellation policies | ✅ Shipped | `/terms`, `/privacy`, `/refunds`, `/shipping`, `/cancellation` |
| Grievance Officer page (Consumer Protection E-Commerce Rules 2020 & IT Rules 2021) | ✅ Shipped | `/grievance` |
| Seller information page (Rule 4(1) disclosure) | ✅ Shipped | `/seller` |
| Cookie / local-storage consent banner | ✅ Shipped | `CookieConsent.jsx` |
| GST tax invoices with CGST/SGST/IGST split + invoice numbers | ✅ Shipped | `/api/orders/:id/invoice`, `/invoice/:orderId` |
| GSTIN + billing-state capture at checkout (optional, validated) | ✅ Shipped | `Checkout.jsx`, `/api/checkout` |
| Security hardening (Helmet, rate limiting, JSON size caps, hidden stack traces) | ✅ Shipped | `backend/src/server.js` |
| Password hashing (bcrypt) + JWT auth, no card data stored | ✅ Shipped | backend |

## Registrations to complete (before going live)

| Item | What to do | Regulator / portal |
| ---- | ---------- | ------------------ |
| **GST registration** | Register once your annual turnover exceeds ₹40L (goods) / ₹20L (services), or earlier for interstate supply. Add `STORE_GSTIN` to `.env`. | GST portal — https://www.gst.gov.in |
| **Business registration** | A sole proprietorship needs a shop & establishment registration (state-wise) and a current bank account in the proprietor's name. Consider Udyam registration (MSME). | State labour dept / https://udyamregistration.gov.in |
| **Bank account + UPI/online payment** | Set up a Razorpay live account with your business KYC; use the live keys in `.env`. | https://razorpay.com |
| **Grievance officer** | Appoint a named grievance officer and publish their name/email/phone (already a placeholder in `.env`). | — |

## Ongoing obligations

- **Returns & refunds** — honour the 7-day return window published on the store; process refunds to the original payment method.
- **GST invoicing** — issue a tax invoice for every taxable supply within the timelines under the GST law (the app generates one per paid order).
- **Data protection (DPDP Act 2023)** — honour data-access/correction/deletion requests sent to the published email; keep the grievance officer contact current.
- **Consumer protection** — respond to complaints within the timelines published on the Grievance page; keep the National Consumer Helpline reference visible.
- **Price transparency** — display prices inclusive of GST (the app does) and do not add hidden charges at delivery.
- **IT Rules (intermediary duties)** — update the privacy policy and grievance redressal details as your business details change; appoint a *Resident Grievance Officer* (and a nodal officer for DPDP when thresholds are crossed).

## Quick pre-launch checklist

1. Set a strong `JWT_SECRET` in `.env`.
2. Fill in all `STORE_*` and `GRIEVANCE_OFFICER_*` values in `.env`.
3. Obtain GST registration and set `STORE_GSTIN`.
4. Switch on Razorpay live keys (mock payments are **disabled automatically** when `NODE_ENV=production`; COD stays available if `COD_ENABLED=true`).
5. Review the placeholder company details shown on the legal pages and on invoices.
6. Serve the frontend over HTTPS behind a reverse proxy (e.g. Nginx/Caddy) in production.
7. Configure Google OAuth (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) so customers can sign in with a verified email.

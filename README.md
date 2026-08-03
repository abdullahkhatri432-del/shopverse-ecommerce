# ShopVerse — E-Commerce Store

A fully functional e-commerce website built with a **React** frontend and a **Node.js/Express + SQLite** backend.

## Features

- **Product catalog** — browse, search (debounced), filter by category, price range and in-stock, and sort products
- **Product details** — images, descriptions, stock status, **country of origin**, GST-inclusive pricing, quantity picker, breadcrumbs, and **verified-purchase reviews & star ratings**
- **Shopping cart** — add/remove items, change quantities, persisted in `localStorage` **and synced to the server** (merged when you sign in, so abandoned carts survive across devices)
- **Checkout** — shipping details, optional GSTIN/billing-state for GST invoices, pincode delivery check, order summary, **Cash on Delivery**, and **price-sync protection** (you're alerted if a price changed before you pay)
- **Payments** — Razorpay Checkout (test/live) with server-side signature verification, **COD**, and a mock checkout that is **disabled in production**
- **GST invoices** — printable + **PDF download** tax invoices with CGST/SGST/IGST breakdown, invoice numbers, and buyer/seller details
- **Order tracking** — status stepper (placed → packed → shipped → out for delivery → delivered), estimated delivery dates, order cancellation, and **return/refund requests** within 7 days of delivery
- **Wishlist & recently viewed** — save products for later (wishlist page + heart on every card), and a "Recently viewed" row on the home page
- **User-friendly polish** — loading skeletons, friendly empty states, page transitions, breadcrumbs, hover micro-interactions, a **mobile bottom nav**, focus-visible + reduced-motion accessibility, and a trust strip (free delivery, COD, returns)
- **Legal & compliance** — Terms, Privacy (DPDP-ready), Refund, Shipping, Cancellation, Grievance Officer, Seller Info and Contact pages, grievance officer details in the footer, plus a cookie/local-storage consent banner
- **User accounts** — secure **Google sign-in** (verified, duplicate-free) and view order history + GST invoices
- **Admin panel** — add/edit/delete products (with image upload + country of origin), manage categories from a fixed dropdown so sellers can't mistype them, and manage order statuses (incl. returns & refunds)
- **Security hardening** — Helmet, per-minute auth/checkout rate limits, JSON body-size caps, hidden error traces, malformed-body handling
- **SEO & UX** — dynamic titles/descriptions/Open Graph tags, custom 404 page, React error boundary, lazy-loaded images, fully responsive
- **SQLite database** — no external database server required (Node's built-in `node:sqlite`)

## Tech stack

| Layer    | Technology                         |
| -------- | ---------------------------------- |
| Frontend | React 18, Vite, React Router       |
| Backend  | Node.js, Express                   |
| Database | SQLite (via built-in `node:sqlite`)|
| Auth     | Google OAuth (verified accounts) + JWT |

## Project structure

```
ecommerce/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express app entry (Helmet, rate limits, security)
│   │   ├── db.js              # SQLite connection + schema + migrations
│   │   ├── auth.js            # JWT helpers & middleware
│   │   ├── gst.js             # GST rates, GSTIN validation, CGST/SGST/IGST split
│   │   ├── payments.js        # Razorpay vs COD vs mock gates (mock disabled in prod)
│   │   ├── mailer.js          # Order email notifications (SMTP or console mock)
│   │   ├── seed.js            # Seeds admin user + sample products
│   │   └── routes/
│   │       ├── auth.js        # Google OAuth / admin login / me
│   │       ├── products.js    # catalog, search, filters
│   │       ├── orders.js      # create / confirm / cancel / return / my orders / PDF invoice
│   │       ├── checkout.js    # Razorpay, COD or mock checkout
│   │       ├── cart.js        # persisted server-side carts + guest merge
│   │       ├── shipping.js    # pincode serviceability + ETA
│   │       ├── config.js      # payment + store/legal info
│   │       └── admin.js       # product, category & order management
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/             # Home, Shop, Product, Cart, Checkout, Invoice, Legal, Auth, Admin…
        ├── components/        # Navbar, ProductCard, Footer, CookieConsent, InvoiceView, GoogleButton, OrderTracking, ErrorBoundary, Seo
        ├── context/           # Auth, Cart, Toast
        └── lib/api.js         # API client + store config
```

## Getting started

Prerequisites: **Node.js 22.5+** (uses the built-in `node:sqlite` module).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # on Windows: copy .env.example .env
npm run seed                # creates admin user + sample products
npm start                   # API on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # app on http://localhost:5173
```

Open http://localhost:5173.

> The Vite dev server proxies `/api` requests to the backend, so no CORS config is needed in development.

### Product images

Products can use an external image URL **or** a photo uploaded from the admin panel. Uploads are stored in `backend/uploads/` and served at `/uploads/<file>`. In development, Vite proxies `/uploads` to the backend as well.

## Demo accounts

Seeded by `npm run seed`:

| Role     | Email                | Password  |
| -------- | -------------------- | --------- |
| Admin    | `admin@example.com`  | `admin123`|

Customer accounts use **Google sign-in** (see below); registration is Google-only to avoid duplicate
accounts.

## Authentication (Google)

Customers sign in with Google via the Sign-In-for-Web widget (the button shows once you configure
`GOOGLE_CLIENT_ID`):

1. Create a project at https://console.cloud.google.com → **APIs & Services → OAuth consent screen**,
   then **Credentials → Create credentials → OAuth client ID** → type *Web application*.
2. Set `GOOGLE_CLIENT_ID` (and `GOOGLE_CLIENT_SECRET`) in `backend/.env`.
3. Restart the backend. The login/register pages now show the **Google button**.

The backend verifies the ID token (`google-auth-library`) and only accepts accounts with a
**verified** email, then **upserts by that email** — signing in can never create a duplicate customer.
The admin account is unaffected and signs in with email + password (toggle under the Google button).

## GST invoices

After an order is paid, a GST tax invoice is generated automatically (`/api/orders/:id/invoice`)
and is viewable/printable at `/invoice/:orderId` (linked from the order-success page and from
each paid order in the account page), with a **PDF download** (`.pdf`) built server-side. The invoice shows:

- Seller details and GSTIN from `.env` (`STORE_*`), and buyer details/GSTIN captured at checkout
- Per-line GST at the category-based rate (books/essentials 5%, apparel 12%, most goods 18%)
- **CGST + SGST** for intra-state sales, or **IGST** for inter-state sales
- A unique sequential invoice number (`INV-YYYY-######`)

GST is informational until you set `STORE_GSTIN`; fill it in once your GST registration is done.

## Payments

By default the store uses a **mock checkout** in development: placing an order immediately creates and
confirms it with a note that no real payment was taken. Mock mode is **automatically disabled when
`NODE_ENV=production`** — online checkout returns `503` and no order can be force-confirmed, so a fake
payment can never grant "paid" access in a live deployment.

To enable **Razorpay Checkout**:

1. Create an account at https://razorpay.com and grab your key pair (`key_id` / `key_secret`, e.g. `rzp_test_...`) from **Dashboard → Settings → API Keys**.
2. Set them in `backend/.env`:

   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```

3. Restart the backend. The checkout now opens Razorpay's hosted checkout modal. Pay with the test card `4111 1111 1111 1111`, any future expiry date and any CVV.

The order is confirmed only after the payment signature is verified server-side (`POST /api/checkout/verify`),
so a fake payment can't be marked as paid. Failed or cancelled payments leave the order as `pending`.

### Cash on Delivery

Set `COD_ENABLED=true` in `backend/.env` to offer **Cash on Delivery** at checkout. COD orders are
created with status `pending`, stock is deducted immediately, and they're only marked `paid` when the
admin marks them **delivered**. They never touch a payment gateway.

## API overview

| Method | Endpoint                        | Description                     | Auth     |
| ------ | ------------------------------- | ------------------------------- | -------- |
| POST   | `/api/auth/google`              | Google ID-token sign-in         | –        |
| POST   | `/api/auth/login`               | Admin log in, returns JWT       | –        |
| GET    | `/api/auth/me`                  | Current user                    | User     |
| GET    | `/api/products`                 | List/search/filter/sort/in-stock| –        |
| GET    | `/api/products/:id`             | Single product                  | –        |
| GET    | `/api/products/categories`      | Distinct categories             | –        |
| GET    | `/api/products/featured`        | Featured products               | –        |
| GET    | `/api/config`                   | Payment + store/legal info      | –        |
| POST   | `/api/checkout`                 | Create order + start payment    | –        |
| GET    | `/api/checkout/config`          | Currency & payment provider info| –        |
| POST   | `/api/checkout/verify`          | Verify Razorpay payment signature| –        |
| GET    | `/api/cart` / `PUT /api/cart`   | Read / write server cart        | User/guest|
| POST   | `/api/cart/merge`               | Merge guest cart after sign-in  | User     |
| POST   | `/api/shipping/check`           | Pincode serviceability + ETA    | –        |
| POST   | `/api/orders/:id/confirm`       | Mark order paid (gated)         | –        |
| POST   | `/api/orders/:id/cancel`        | Cancel order, restock           | –        |
| POST   | `/api/orders/:id/return`        | Request a return                | –        |
| GET    | `/api/products/:id/reviews`     | Reviews + rating summary        | –        |
| POST   | `/api/products/:id/reviews`     | Review a purchased product      | User     |
| GET    | `/api/orders/:id/invoice`       | GST invoice for a paid order    | –        |
| GET    | `/api/orders/:id/invoice.pdf`   | PDF download of the invoice     | –        |
| GET    | `/api/orders/my`                | Current user's orders           | User     |
| POST   | `/api/admin/products`           | Create product                  | Admin    |
| PUT    | `/api/admin/products/:id`       | Update product                  | Admin    |
| DELETE | `/api/admin/products/:id`       | Delete product                  | Admin    |
| POST   | `/api/admin/upload`             | Upload a product image (multipart)| Admin  |
| GET    | `/api/admin/categories`         | List categories (+ product counts)| Admin    |
| POST   | `/api/admin/categories`         | Create a category                 | Admin    |
| DELETE | `/api/admin/categories/:id`     | Delete a category (only if unused)| Admin    |
| GET    | `/api/admin/orders`             | All orders                      | Admin    |
| PATCH  | `/api/admin/orders/:id/status`  | Update order status             | Admin    |

## Configuration

`backend/.env`:

| Variable            | Default                   | Description                          |
| ------------------- | ------------------------- | ------------------------------------ |
| `PORT`              | `4000`                    | API port                             |
| `JWT_SECRET`        | `dev-secret-change-me`    | JWT signing key — **change in prod** |
| `CURRENCY`          | `INR`                     | Payment currency (`INR` or `USD`)    |
| `ADMIN_EMAIL`       | `admin@example.com`       | Admin account used by `npm run seed` |
| `ADMIN_PASSWORD`    | `admin123`                | Admin password used by `npm run seed`|
| `RAZORPAY_KEY_ID`   | *(empty)*                 | Razorpay test key; enables Razorpay  |
| `RAZORPAY_KEY_SECRET`| *(empty)*                | Razorpay secret (with key id above)  |
| `PAYMENT_MODE`      | `mock`                    | `mock` or `live`; mock is disabled when `NODE_ENV=production` |
| `COD_ENABLED`       | `true`                    | Offer Cash on Delivery at checkout   |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | *(empty)* | Google OAuth web-client; enables Google sign-in |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` | *(empty)* | Order email notifications (falls back to console log) |
| `CORS_ORIGIN`       | `http://localhost:5173`   | Allowed frontend origin(s)           |
| `STORE_NAME`        | `ShopVerse`               | Store display name                   |
| `STORE_LEGAL_NAME`  | *(placeholder)*           | Legal business name (shown on invoices)|
| `STORE_PROPRIETOR`  | *(placeholder)*           | Proprietor name                      |
| `STORE_ADDRESS`     | *(placeholder)*           | Registered address                   |
| `STORE_EMAIL`/`STORE_PHONE`/`STORE_WEBSITE` | *(placeholder)* | Contact details            |
| `STORE_GSTIN`       | *(empty)*                 | Your GSTIN (enables seller GSTIN on invoices) |
| `STORE_STATE`/`STORE_STATE_NAME` | `DL` / `Delhi`   | Seller state for CGST/SGST vs IGST   |
| `GRIEVANCE_OFFICER_*` | *(placeholder)*        | Grievance officer name/email/phone   |

> Prices are stored in the smallest unit of `CURRENCY` (paise/cents). Seed prices such as `19900` display as ₹199.00 by default.

## Legal & compliance

See **[COMPLIANCE.md](COMPLIANCE.md)** for the India-focused checklist: which legal pages and
invoices are already built in, and the registrations (GST, shop & establishment, live Razorpay,
grievance officer) you must complete before going live.

## Production build

```bash
cd frontend
npm run build        # outputs to frontend/dist
```

Serve `frontend/dist` as static files and point the `/api` paths at the backend (the Vite proxy is dev-only). Run the backend with `NODE_ENV=production` — this **disables mock payments** (online checkout returns `503` until Razorpay keys are set) and forces real verification. Set a strong `JWT_SECRET`, choose `CURRENCY`, add your live Razorpay keys, and configure Google OAuth.

## License

MIT

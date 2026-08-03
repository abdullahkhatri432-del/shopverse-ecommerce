# ShopVerse — E-Commerce Store

A fully functional e-commerce website built with a **React** frontend and a **Node.js/Express + SQLite** backend.

## Features

- **Product catalog** — browse, search, filter by category and max price, and sort products
- **Product details** — images, descriptions, stock status, quantity picker
- **Shopping cart** — add/remove items, change quantities, persisted in `localStorage`
- **Checkout** — shipping details, optional GSTIN/billing-state for GST invoices, order summary, and payment
- **Payments** — Razorpay Checkout (test mode) with a built-in **mock checkout** fallback that works with zero configuration
- **GST invoices** — printable tax invoices with CGST/SGST/IGST breakdown, invoice numbers, and buyer/seller details
- **Legal & compliance** — Terms, Privacy (DPDP-ready), Refund, Shipping, Cancellation, Grievance Officer and Seller Info pages, plus a cookie/local-storage consent banner
- **User accounts** — register, log in (JWT), and view order history + GST invoices
- **Admin panel** — add/edit/delete products (with image upload), manage categories from a fixed dropdown so sellers can't mistype them, and manage order statuses
- **Security hardening** — Helmet, rate limiting, JSON body-size caps, hidden error traces
- **SQLite database** — no external database server required (Node's built-in `node:sqlite`)

## Tech stack

| Layer    | Technology                         |
| -------- | ---------------------------------- |
| Frontend | React 18, Vite, React Router       |
| Backend  | Node.js, Express                   |
| Database | SQLite (via built-in `node:sqlite`)|
| Auth     | JWT + bcrypt                       |
| Payments | Razorpay (optional, test mode)       |

## Project structure

```
ecommerce/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express app entry (Helmet, rate limits, security)
│   │   ├── db.js              # SQLite connection + schema + migrations
│   │   ├── auth.js            # JWT helpers & middleware
│   │   ├── gst.js             # GST rates, GSTIN validation, CGST/SGST/IGST split
│   │   ├── seed.js            # Seeds admin user + sample products
│   │   └── routes/
│   │       ├── auth.js        # register / login / me
│   │       ├── products.js    # catalog, search, filters
│   │       ├── orders.js      # create / confirm / my orders / invoice
│   │       ├── checkout.js    # Razorpay or mock checkout
│   │       ├── config.js      # payment + store/legal info
│   │       └── admin.js       # product, category & order management
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/             # Home, Shop, Product, Cart, Checkout, Invoice, Legal, Auth, Admin…
        ├── components/        # Navbar, ProductCard, Footer, CookieConsent, InvoiceView
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

Any user you register gets the `customer` role by default.

## GST invoices

After an order is paid, a GST tax invoice is generated automatically (`/api/orders/:id/invoice`)
and is viewable/printable at `/invoice/:orderId` (linked from the order-success page and from
each paid order in the account page). The invoice shows:

- Seller details and GSTIN from `.env` (`STORE_*`), and buyer details/GSTIN captured at checkout
- Per-line GST at the category-based rate (books/essentials 5%, apparel 12%, most goods 18%)
- **CGST + SGST** for intra-state sales, or **IGST** for inter-state sales
- A unique sequential invoice number (`INV-YYYY-######`)

GST is informational until you set `STORE_GSTIN`; fill it in once your GST registration is done.

## Payments

By default the store uses a **mock checkout**: placing an order immediately creates it and confirms it, with a note that no real payment was taken.

To enable **Razorpay Checkout** (test mode):

1. Create an account at https://razorpay.com and grab your **test key pair** (`key_id` / `key_secret`, e.g. `rzp_test_...`) from **Dashboard → Settings → API Keys**.
2. Set them in `backend/.env`:

   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```

3. Restart the backend. The checkout now opens Razorpay's hosted checkout modal. Pay with the test card `4111 1111 1111 1111`, any future expiry date and any CVV.

The order is confirmed only after the payment signature is verified server-side (`POST /api/checkout/verify`), so a fake payment can't be marked as paid. Failed or cancelled payments leave the order as `pending`.

## API overview

| Method | Endpoint                        | Description                     | Auth     |
| ------ | ------------------------------- | ------------------------------- | -------- |
| POST   | `/api/auth/register`            | Create account                  | –        |
| POST   | `/api/auth/login`               | Log in, returns JWT             | –        |
| GET    | `/api/auth/me`                  | Current user                    | User     |
| GET    | `/api/products`                 | List/search/filter/sort         | –        |
| GET    | `/api/products/:id`             | Single product                  | –        |
| GET    | `/api/products/categories`      | Distinct categories             | –        |
| GET    | `/api/products/featured`        | Featured products               | –        |
| GET    | `/api/config`                   | Payment + store/legal info      | –        |
| POST   | `/api/checkout`                 | Create order + start payment    | –        |
| GET    | `/api/checkout/config`          | Currency & payment provider info| –        |
| POST   | `/api/checkout/verify`          | Verify Razorpay payment signature| –        |
| POST   | `/api/orders/:id/confirm`       | Mark order paid                 | –        |
| GET    | `/api/orders/:id/invoice`       | GST invoice for a paid order    | –        |
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

Serve `frontend/dist` as static files and point the `/api` paths at the backend (the Vite proxy is dev-only). Set a strong `JWT_SECRET`, choose `CURRENCY`, and add your live Razorpay keys.

## License

MIT

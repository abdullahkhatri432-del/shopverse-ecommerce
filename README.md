# ShopVerse — E-Commerce Store

A fully functional e-commerce website built with a **React** frontend and a **Node.js/Express + SQLite** backend.

## Features

- **Product catalog** — browse, search, filter by category and max price, and sort products
- **Product details** — images, descriptions, stock status, quantity picker
- **Shopping cart** — add/remove items, change quantities, persisted in `localStorage`
- **Checkout** — shipping details, order summary, and payment
- **Payments** — Stripe Checkout integration (test mode) with a built-in **mock checkout** fallback that works with zero configuration
- **User accounts** — register, log in (JWT), and view order history
- **Admin panel** — add/edit/delete products, manage order statuses
- **SQLite database** — no external database server required (Node's built-in `node:sqlite`)

## Tech stack

| Layer    | Technology                         |
| -------- | ---------------------------------- |
| Frontend | React 18, Vite, React Router       |
| Backend  | Node.js, Express                   |
| Database | SQLite (via built-in `node:sqlite`)|
| Auth     | JWT + bcrypt                       |
| Payments | Stripe (optional, test mode)       |

## Project structure

```
ecommerce/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express app entry
│   │   ├── db.js              # SQLite connection + schema
│   │   ├── auth.js            # JWT helpers & middleware
│   │   ├── seed.js            # Seeds admin user + sample products
│   │   └── routes/
│   │       ├── auth.js        # register / login / me
│   │       ├── products.js    # catalog, search, filters
│   │       ├── orders.js      # create / confirm / my orders
│   │       ├── checkout.js    # Stripe or mock checkout
│   │       └── admin.js       # product & order management
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/             # Home, Shop, Product, Cart, Checkout, Auth, Admin…
        ├── components/        # Navbar, ProductCard, Footer
        ├── context/           # Auth, Cart, Toast
        └── lib/api.js         # API client
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

## Demo accounts

Seeded by `npm run seed`:

| Role     | Email                | Password  |
| -------- | -------------------- | --------- |
| Admin    | `admin@example.com`  | `admin123`|

Any user you register gets the `customer` role by default.

## Payments

By default the store uses a **mock checkout**: placing an order immediately creates it and marks it paid, with a note that no real payment was taken.

To enable **Stripe Checkout** (test mode):

1. Create an account at https://stripe.com and grab your **test secret key** (`sk_test_...`) from the dashboard.
2. Set it in `backend/.env`:

   ```
   STRIPE_SECRET_KEY=sk_test_...
   FRONTEND_URL=http://localhost:5173
   ```

3. Restart the backend. The checkout flow will now redirect to Stripe's hosted payment page (use test card `4242 4242 4242 4242`).

Orders are confirmed when Stripe redirects back to the success page.

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
| POST   | `/api/checkout`                 | Create order + start payment    | –        |
| POST   | `/api/orders/:id/confirm`       | Mark order paid                 | –        |
| GET    | `/api/orders/my`                | Current user's orders           | User     |
| POST   | `/api/admin/products`           | Create product                  | Admin    |
| PUT    | `/api/admin/products/:id`       | Update product                  | Admin    |
| DELETE | `/api/admin/products/:id`       | Delete product                  | Admin    |
| GET    | `/api/admin/orders`             | All orders                      | Admin    |
| PATCH  | `/api/admin/orders/:id/status`  | Update order status             | Admin    |

## Configuration

`backend/.env`:

| Variable          | Default                   | Description                          |
| ----------------- | ------------------------- | ------------------------------------ |
| `PORT`            | `4000`                    | API port                             |
| `JWT_SECRET`      | `dev-secret-change-me`    | JWT signing key — **change in prod** |
| `FRONTEND_URL`    | `http://localhost:5173`   | Frontend origin for Stripe redirects |
| `ADMIN_EMAIL`     | `admin@example.com`       | Admin account used by `npm run seed` |
| `ADMIN_PASSWORD`  | `admin123`                | Admin password used by `npm run seed`|
| `STRIPE_SECRET_KEY`| *(empty)*                | Enables Stripe; empty = mock checkout|

## Production build

```bash
cd frontend
npm run build        # outputs to frontend/dist
```

Serve `frontend/dist` as static files and point the `/api` paths at the backend (the Vite proxy is dev-only). Update `FRONTEND_URL` in `backend/.env` to your real domain, set a strong `JWT_SECRET`, and add real Stripe keys.

## License

MIT

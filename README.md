# Bisa Makan - QR Order App

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

Customer-facing QR code ordering app for restaurants and food businesses. Scan QR code at table → browse menu → place order → track status in real-time.

> **Checkpoint:** reconciled against `master` `a9ff7f4` on 2026-10-23. CI runs lint + 25 Vitest files + build; UI copy is Indonesian (no i18n framework yet).

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | React 19, Vite 8 |
| **Language** | TypeScript 6 |
| **Styling** | Tailwind CSS 4 |
| **State Management** | Zustand 5 |
| **Routing** | React Router v7 |
| **HTTP** | Axios |
| **Animation** | Framer Motion |
| **Icons** | Lucide React |
| **Tests** | Vitest 4 + Testing Library (jsdom) |

---

## Getting Started

### Prerequisites

- Node.js v20+
- npm or yarn

### Installation

```bash
git clone https://github.com/juragan-kasir/QR-ORDER-APP.git
cd QR-ORDER-APP
npm install
```

### Environment Variables

Create `.env` file:

```env
VITE_API_BASE_URL=https://api-bisa-nota.vercel.app
```

`VITE_API_BASE_URL` is required in production builds (a missing value throws at load; dev falls back to `http://localhost:5001`). Vite inlines it at build time.

### Development

```bash
npm run dev
```

### Build

```bash
npm run build      # tsc -b && vite build
npm run preview
npm run lint
npm test           # vitest run (25 files)
```

---

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/               # Page components
├── services/            # API service layer
├── store/               # Zustand stores
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── App.tsx              # Root component
└── main.tsx             # Entry point
```

---

## Features

- **QR Code Scanning** - Instant menu access via QR code at table
- **Real-time Order Tracking** - Live status updates via polling
- **Product Browsing** - Category-based menu with search
- **Cart Management** - Add, edit, remove items
- **Order History** - View past orders and reorder
- **Diner session privacy** - Order history is keyed to a per-device diner session (`bisamakan-diner-session:<store>`), not the printed table QR, so diners at one table do not see each other's orders
- **Waiter call** - Request a waiter from the table (`/waiter`)
- **Closed-store handling** - Shows closed state from `isOpen`/`nextOpenAt`; ordering a closed/archived store returns `STORE_CLOSED`/`STORE_ARCHIVED`
- **Responsive Design** - Mobile-first UI
- **Error Boundaries** - Graceful error handling with retry

---

## Routes

`/` (menu) · `/product/:id` · `/detail-product/:id` (redirect) · `/cart` · `/checkout` · `/payment` · `/orders` · `/waiter` · `/history` · `*` (not found) — `src/App.tsx`.

## Deployment

- **Production**: https://order-app-dun.vercel.app (Vercel)
- **CI**: `.github/workflows/ci.yml` runs lint + test + build + a localhost-leak guard, but GitHub Actions is currently disabled at the organisation level — run `npm run lint && npm test && npm run build` locally before pushing.

---

## Related

- [API Reference](./docs/API.md) — every backend endpoint this app calls (public customer endpoints, payloads, error codes, caching)
- [Backend API](https://github.com/juragan-kasir/BE-POS-App)
- [Frontend App](https://github.com/juragan-kasir/FE-POS-App)

# Bisa Makan - QR Order App

[![CI/CD](https://github.com/teddferdy/QR-ORDER-APP/actions/workflows/ci.yml/badge.svg)](https://github.com/teddferdy/QR-ORDER-APP/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

Customer-facing QR code ordering app for restaurants and food businesses. Scan QR code at table → browse menu → place order → track status in real-time.

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

---

## Getting Started

### Prerequisites

- Node.js v20+
- npm or yarn

### Installation

```bash
git clone https://github.com/teddferdy/QR-ORDER-APP.git
cd QR-ORDER-APP
npm install
```

### Environment Variables

Create `.env` file:

```env
VITE_API_URL=https://api-bisa-nota.vercel.app
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
npm run preview
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
- **Session Management** - Table-scoped ordering sessions
- **Responsive Design** - Mobile-first UI
- **Error Boundaries** - Graceful error handling with retry

---

## Related

- [API Reference](./docs/API.md) — every backend endpoint this app calls (public customer endpoints, payloads, error codes, caching)
- [Backend API](https://github.com/teddferdy/BE-POS-App)
- [Frontend App](https://github.com/teddferdy/FE-POS-App)

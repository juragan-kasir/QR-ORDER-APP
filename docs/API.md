# API Reference — Bisa Makan (QR Order App)

This document describes every backend endpoint consumed by this app, based on the actual code in `src/services/*`. The backend is **BE-POS-App**; this app only calls its **public (unauthenticated) customer endpoints**.

> **Checkpoint:** BISA `a9ff7f4`; BE `c9fe118` (2026-10-23). Tests: 26 Vitest files; CI runs lint + test + build.

## Client setup (`src/services/apiClient.ts`)

- **Base URL:** `VITE_API_BASE_URL` (e.g. `https://api-bisa-nota.vercel.app`). In dev, falls back to `http://localhost:5001`; in production a missing variable throws at load (never silently falls back to localhost).
- **Timeout:** 15 s, `Content-Type: application/json`.
- **No authentication:** this is a public customer app. A request interceptor deletes any `Authorization` header — a stale staff token in localStorage must never leak into anonymous QR calls.
- **Error normalization:** every failure is mapped to `ApiError { message, status, code?, data? }`.
  - `code` carries the backend machine code when present (e.g. `PPN_MISSING`, `PRICE_CHANGED`, `IDEMPOTENCY_KEY_REQUIRED`).
  - `data` carries the raw backend body (e.g. the `PRICE_CHANGED` `items` array) — UI must pick explicit fields, never render it wholesale.
  - User-facing messages are Indonesian; `ECONNABORTED` maps to a timeout message with `status: 0`.

All endpoints below were live-verified against the backend routes: they return the `{ success, message, data }` envelope unless noted.

---

## Order

### POST `/order/customer-create`
Creates an anonymous QR order.

- **Body:** `store` (required), `tableId`, `customerName`, `notes`, `paymentMethod`, `session`, `splitCount`, `idempotencyKey` (stable per checkout attempt — the backend dedupes on `(store, idempotencyKey)` so a retry never creates a second order), `items[]`.
- **Item shape:** `productId` (or `bundleId` for a bundle line — the backend resolves the underlying products), `productName`, `quantity`, `price`, `expectedPrice` (optional echo of the charged unit price; a mismatch answers `409 PRICE_CHANGED` with the changed `items`), `notes`, `options`, `modifiers`.
- **Response:** `{ message, data: <order> }` — order with `id`, `publicToken`, `orderNumber`, `status`, totals (`subTotal`, `discountAmount`, `taxAmount`, `serviceChargeAmount`, `totalPrice`), `items[]`, `table`. The best active automatic campaign for the outlet is applied and PPN is computed on the discounted subtotal — the same figures as `/order/customer-quote`.
- **Notes:** `customerId` is deliberately never sent (DR-16): the app has no verified member lookup, so orders are anonymous and staff attach a verified member at settlement in the POS app. A client-supplied `customerId` is rejected by the backend with `MEMBER_ATTACH_REQUIRES_STAFF`. An archived outlet returns `409 STORE_ARCHIVED`; a closed outlet returns `409 STORE_CLOSED` with `nextOpenAt` when known.
- **Service:** `orderService.ts` → `createCustomerOrder`.

### POST `/order/customer-quote`
Read-only price quote for the payment summary (FG-PRICE-02).

- **Body:** `store`, `items[]` (same item shape as `customer-create`).
- **Response:** `{ success, data: { subTotal, discountAmount, discountApplied: [{ campaignId, name, amount }], taxRate, taxAmount, serviceChargeAmount, totalPrice, items[] } }` — priced by the same code as `customer-create`, so the quoted total is the total charged. PPN is computed on the discounted subtotal.
- **Usage:** `PaymentPage` re-quotes whenever the cart lines change (`hooks/useCustomerQuote.ts`). With a quote, every summary figure is the backend's and the applied automatic campaign is shown by name. Without one (network error, refusal) the summary falls back to the undiscounted cart and says so — that can only overstate the total. The confirmation screen shows the `totalPrice`/`discountAmount` recorded on the created order.
- **Service:** `orderService.ts` → `fetchCustomerQuote` (never rejects; returns `{ status: "ok", quote } | { status: "error" }`).

### GET `/order/customer-order/:publicToken`
Public order status, keyed by the order's opaque `publicToken` (never the DB id).

- **Response:** `{ data: <order> }` (no `success` flag) — `status`, `totalPrice`, `items[]` (id, productName, quantity, price, totalPrice, status), `table`.
- **Status mapping:** kitchen `item.status` drives the diner label. A backend `paid` order is mapped by `paidOrderStatus`: all items `served` → `Sudah Diantar`; all `ready`/`served` → `Siap Diantar`; any non-`pending` → `Sedang Dimasak`; otherwise `Diproses`. Payment status is shown separately, so a cashier settling before serving never makes the order read `Sudah Diantar`. `endReason: "expired"` maps a cancelled order to `Kedaluwarsa`.
- **Service:** `orderService.ts` → `fetchCustomerOrder`.

### GET `/order/customer-orders`
Lists QR orders (`source: "qr"`) for one table of one store, newest first.

- **Query:** `store` (required), `tableId`, `session`, `page`, `limit`.
- **Response:** `{ data: [], pagination: { total, ... } }`.
- **Session privacy:** the app sends this device's `bisamakan-diner-session:<store>` token, never the `session` printed in the table QR. This keeps one diner's order history off another diner's phone at the same table. The printed QR `session` is still used for table context/order creation but is not treated as an identity token.
- **Service:** `orderService.ts` → `fetchCustomerOrders`.

### GET `/order/customer-menu`
The customer catalog for one store: products + active categories in a single call.

- **Query:** `store` (required).
- **Response:** `{ message, data: { products: [], categories: [] } }`.
- **Notes:** products carry outlet-resolved `effectivePrice` and `effectiveStock` when available (outlet row wins, including an explicit `0`), plus `inventoryMode` (`stocked` / `make_to_order` / `hybrid`). A `make_to_order` product's own stock is not authoritative — availability follows `isAvailable` only (the backend checks recipe ingredients at order time). Results are cached in-memory per store (see below).
- **Service:** `productService.ts` → `fetchCustomerMenu` (consumed by `fetchProductById`).

### GET `/product-bundle/customer-active`
Active, store-scoped product bundles.

- **Query:** `store` (optional).
- **Response:** `{ message, data: { items: [] } }` — each bundle with `bundlePrice`, `originalPrice`, `discountAmount`, `discountPercentage`, validity window, `items[]` (product, quantity, unitPrice, isOptional, productData).
- **Notes:** public counterpart of the admin `/product-bundle/get-all` (which 401s without JWT). Client additionally filters `status === "active" && isAvailable`. Cached in-memory per store.
- **Service:** `productService.ts` → `fetchBundles`.

### GET `/promo/customer-active`
Active promo campaigns for the store.

- **Query:** `store` (optional).
- **Response:** `{ success, message, data: [] }` — campaign `name`, `code`, `type`, `discountType`, `discountValue`, `maxDiscount`, `minPurchase`, date/time window, `daysOfWeek`, `applicableTo`, `priority`.
- **Notes:** cached in-memory per store.
- **Service:** `productService.ts` → `fetchCustomerPromos`.

### GET `/order/customer-tax-rate`
Resolves the PPN (and service-charge) rate charged on the QR channel.

- **Query:** `store` (required), `channel: "qr"`.
- **Response:** `{ data: { rate, serviceChargeRate } }` — `rate` is a percent (divided by 100 client-side); on `channel=qr` `serviceChargeRate` is `null` (never charged).
- **Status semantics (`StoreConfig.status`):**
  - `ok` — numeric rate accepted (including 0).
  - `missing` — `400 PPN_MISSING` (or a legacy codeless 400): the outlet has no usable PPN configuration.
  - `error` — anything else (wrong types, negative rate, nonzero service charge on QR, other error codes) — never resolved to a silent zero-tax config.
- **Notes:** non-`ok` results are evicted from the cache so a retry re-quotes.
- **Service:** `storeService.ts` → `fetchStoreConfig` (via `fetchTaxQuote`).

### GET `/location/get-location-public`
Public store/location list.

- **Response:** `{ success, message, data: [{ id, store, name, city, province, detailLocation, latitude, longitude, status, isOpen, nextOpenAt }] }` (`timezone` and `openingHours` are read server-side and not returned).
- **Notes:** `isOpen`/`nextOpenAt` are derived from `openingHours` + `timezone` by the backend. Used to resolve the store display name and to show closed-state messaging (`fetchStoreConfig`), and to list stores (`fetchPublicStores`, failures resolve to `[]`).
- **Service:** `storeService.ts` → `fetchStoreName`, `fetchPublicStores`.

### POST `/order/customer-review`
Submits a product review.

- **Body:** `name`, `productId`, `storeId`, `rating` (1–5), `comment`, `orderId`.
- **Response:** `{ data: <review> }`.
- **Service:** `reviewService.ts` → `createReview`.

### GET `/order/customer-reviews`
Published reviews for a product.

- **Query:** `productId` (required), `store`.
- **Response:** `{ data: { productId, reviews: [], averageRating, totalReviews } }`.
- **Service:** `reviewService.ts` → `fetchProductReviews`.

---

## Waiter Request

### POST `/waiter-request/customer-create`
Creates a customer service request (sendok, tisu, refill, bill, panggil pelayan).

- **Body:** `store` (required), `tableId`, `orderId`, `type`, `notes`, `customerName`.
- **Response:** `{ data: <request> }` — `id`, `requestNumber`, `type`, `status`, `table`, `createdAt`.
- **Service:** `waiterService.ts` → `createWaiterRequest`.

### GET `/waiter-request/customer-list`
Lists this table's waiter requests.

- **Query:** `store` (required), `tableId`.
- **Response:** `{ data: [] }`.
- **Notes:** non-array payloads resolve to `[]`.
- **Service:** `waiterService.ts` → `fetchMyWaiterRequests`.

---

## Caching & resilience

| Cache | Key | Scope / behavior |
|-------|-----|------------------|
| `customerMenuCache` | `storeId` | In-memory, module-scoped (lost on reload). Shares the in-flight promise across callers; a failed request is evicted immediately so later calls retry fresh. `fetchProductById` reuses the menu cache (zero extra requests on detail pages). |
| `bundlesCache`, `promosCache` | `storeId` | Same pattern. |
| `storeConfigCache` | `storeId` | Same pattern; additionally evicts non-`ok` results so `missing`/`error` never pin a store to a broken state. `fetchStoreConfig` never rejects — callers branch on `status`. |

## Quality & localization

- **Tests:** 26 Vitest files. CI runs `npm run lint`, `npm test`, and `npm run build`; the build asserts the dev API URL (`localhost:5001`) is absent from `dist`.
- **Localization:** UI copy is Indonesian; there is no i18n framework or locale switch yet.
- **Accessibility:** modal/bottom-sheet components use `aria-modal`, labelled headings, and the shared `useDialogA11y` hook; coverage is partial and not audited end-to-end.
- **Session privacy:** diner identity is per-device (`bisamakan-diner-session:<store>` in localStorage), not the printed table QR `session`; see the order-list note above.

## Related documents

- `README.md` — project overview and dev guide.
- BE repo `API_DOCUMENTATION.md` — full backend endpoint catalog.
- BE repo `docs` — response contracts and order-create client contract (idempotency lifecycle) used by the POS apps.

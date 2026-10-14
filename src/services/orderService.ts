import apiClient, { ApiError } from "./apiClient";
import type { Order, OrderStatus, PaymentMethod } from "../types";

interface CustomerCreateResponse {
  message: string;
  data: BackendOrder;
}

interface BackendOrder {
  id: number;
  publicToken?: string;
  orderNumber: string;
  store: number;
  tableId: number | null;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  discountId: number | null;
  promoCode: string | null;
  cashierId: number | null;
  cashierName: string | null;
  status: string;
  subTotal: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  serviceChargeRate: number;
  serviceChargeAmount: number;
  totalQuantity: number;
  totalPrice: number;
  paymentMethod: string | null;
  paymentStatus: string;
  notes: string | null;
  source: string;
  currencyId: number | null;
  currencyCode: string | null;
  exchangeRate: number | null;
  createdBy: number | null;
  modifiedBy: number | null;
  totalCovers: number;
  shiftId: number;
  promoCampaignId: number | null;
  splitCount: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  items: BackendOrderItem[];
  table: { id: number; name: string } | null;
}

interface BackendOrderItem {
  id: number;
  order: number;
  product: number;
  productName: string;
  quantity: number;
  price: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  totalPrice: number;
  options: unknown[];
  modifiers: unknown[];
  notes: string | null;
  status: string;
  createdBy: number | null;
  waktuSiap: string | null;
  urutanSaji: number;
  hppSnapshot: number | null;
  stationDapur: string | null;
  bundleId: number | null;
  bundleName: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface CustomerOrderResponse {
  data: {
    id: number;
    orderNumber: string;
    status: string;
    totalPrice: number;
    totalQuantity: number;
    customerName: string | null;
    createdAt: string;
    tableId: number | null;
    items: {
      id: number;
      productName: string;
      quantity: number;
      price: number;
      totalPrice: number;
      status: string;
    }[];
    table: { name: string } | null;
  };
}

function mapStatus(beStatus: string): OrderStatus {
  const map: Record<string, OrderStatus> = {
    pending: "Menunggu Konfirmasi",
    confirmed: "Diproses",
    preparing: "Sedang Dimasak",
    ready: "Siap Diantar",
    served: "Sudah Diantar",
    paid: "Sudah Diantar",
    cancelled: "Ditolak",
    void: "Dibatalkan",
  };
  return map[beStatus] || "Menunggu Konfirmasi";
}

function mapPaymentMethod(method: string | null): PaymentMethod {
  if (!method) return "QRIS";
  const lower = method.toLowerCase();
  if (lower.includes("qris")) return "QRIS";
  if (lower.includes("cash") || lower.includes("tunai")) return "Tunai";
  if (lower.includes("credit") || lower.includes("kartu"))
    return "Kartu Kredit";
  if (
    lower.includes("ewallet") ||
    lower.includes("e-wallet") ||
    lower.includes("e wallet")
  )
    return "E-Wallet";
  if (lower.includes("postpaid") || lower.includes("bayar")) return "Postpaid";
  if (lower.includes("split")) return "Split Bill";
  return "QRIS";
}

function mapOptionsToFrontend(options: unknown[]): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter(
      (opt): opt is { name: string; value: string } =>
        typeof opt === "object" &&
        opt !== null &&
        "name" in opt &&
        "value" in opt,
    )
    .map((opt) => opt.value || opt.name);
}

function mapModifiersToFrontend(
  modifiers: unknown[],
): { id: string; name: string; price: number }[] {
  if (!Array.isArray(modifiers)) return [];
  return modifiers
    .filter(
      (mod): mod is { id: string | number; name: string; price: number } =>
        typeof mod === "object" &&
        mod !== null &&
        "name" in mod &&
        "price" in mod,
    )
    .map((mod, idx) => ({
      id: String(mod.id || idx),
      name: mod.name,
      price: mod.price,
    }));
}

function mapBackendOrderToFrontend(bo: BackendOrder): Order {
  return {
    id: String(bo.id),
    publicToken: bo.publicToken,
    orderNumber: bo.orderNumber,
    tableNumber: bo.table?.name || String(bo.tableId || ""),
    storeId: String(bo.store),
    customerName: bo.customerName || undefined,
    items: bo.items.map((item) => ({
      productId: String(item.product),
      name: item.productName,
      price: item.price,
      quantity: item.quantity,
      customization: {
        size: mapOptionsToFrontend(item.options)[0] as
          | import("../types").Size
          | undefined,
        addOns:
          mapModifiersToFrontend(item.modifiers).length > 0
            ? mapModifiersToFrontend(item.modifiers)
            : undefined,
        notes: item.notes || undefined,
      },
      totalPrice: item.totalPrice,
      image: "",
      bundleId: item.bundleId != null ? String(item.bundleId) : undefined,
      bundleName: item.bundleName || undefined,
    })),
    subtotal: bo.subTotal,
    tax: bo.taxAmount,
    serviceCharge: bo.serviceChargeAmount,
    total: bo.totalPrice,
    paymentMethod: mapPaymentMethod(bo.paymentMethod),
    splitCount: bo.splitCount ?? undefined,
    status: mapStatus(bo.status),
    createdAt: bo.createdAt,
    statusHistory: [{ status: mapStatus(bo.status), timestamp: bo.createdAt }],
  };
}

export interface CreateOrderPayload {
  store: number;
  tableId?: number | null;
  customerName?: string;
  // DR-16: customerId is deliberately absent. This app has no authentication
  // and no verified member lookup, and neither free-text names nor
  // self-supplied ids may unlock member benefits — benefits require a
  // staff-verified member id. Orders are created anonymous (unpaid); staff
  // attach a verified member at settlement in FE-POS-App instead. Do not add
  // a member/customerId input here without an authenticated verification
  // flow.
  notes?: string;
  paymentMethod?: string;
  session?: string;
  splitCount?: number;
  // P5-02: stable per-checkout-attempt key the backend dedupes on
  // (store, idempotencyKey) — prevents a duplicate order on retry.
  idempotencyKey?: string;
  items: {
    // Required for a regular product line. Omitted for a bundle line, where
    // `bundleId` is the authoritative identifier and the backend resolves
    // the underlying products itself.
    productId?: number;
    productName: string;
    quantity: number;
    price: number;
    // DR-11: optional echo of the final charged unit price; the backend
    // compares it and answers 409 PRICE_CHANGED on mismatch.
    expectedPrice?: number;
    notes?: string;
    options?: unknown[];
    modifiers?: unknown[];
    bundleId?: number | null;
  }[];
}

export async function createCustomerOrder(
  payload: CreateOrderPayload,
): Promise<Order> {
  try {
    const { data } = await apiClient.post<CustomerCreateResponse>(
      "/order/customer-create",
      payload,
    );
    return mapBackendOrderToFrontend(data.data);
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError("Gagal membuat pesanan. Coba lagi.", 0);
  }
}

export async function fetchCustomerOrder(
  publicToken: string,
): Promise<Order | null> {
  try {
    const { data } = await apiClient.get<CustomerOrderResponse>(
      `/order/customer-order/${publicToken}`,
    );
    const d = data.data;
    return {
      id: String(d.id),
      orderNumber: d.orderNumber,
      tableNumber: d.table?.name || String(d.tableId || ""),
      storeId: "",
      customerName: d.customerName || undefined,
      items: d.items.map((item) => ({
        productId: "",
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        image: "",
      })),
      subtotal: d.totalPrice,
      tax: 0,
      serviceCharge: 0,
      total: d.totalPrice,
      paymentMethod: "QRIS",
      status: mapStatus(d.status),
      createdAt: d.createdAt,
      statusHistory: [{ status: mapStatus(d.status), timestamp: d.createdAt }],
    };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    return null;
  }
}

export async function fetchCustomerOrders(
  storeId: string,
  options?: { tableId?: string; session?: string; page?: number; limit?: number },
): Promise<{ orders: Order[]; total: number }> {
  try {
    const params: Record<string, string | number> = { store: storeId };
    if (options?.tableId) params.tableId = options.tableId;
    if (options?.session) params.session = options.session;
    if (options?.page) params.page = options.page;
    if (options?.limit) params.limit = options.limit;

    const { data } = await apiClient.get("/order/customer-orders", { params });
    const orders = data.data || [];
    if (!Array.isArray(orders)) return { orders: [], total: 0 };
    return {
      orders: orders.map((bo: BackendOrder) => mapBackendOrderToFrontend(bo)),
      total: data.pagination?.total || orders.length,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    return { orders: [], total: 0 };
  }
}

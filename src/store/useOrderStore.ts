import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Order, WaiterRequest } from "../types";
import { createCustomerOrder } from "../services/orderService";
import {
  createWaiterRequest,
  fetchMyWaiterRequests,
} from "../services/waiterService";

interface OrderState {
  activeOrderId: string | null;
  // The store/table context activeOrderId was actually set for — lets
  // consumers (CallWaiterButton) refuse to attach a request to an order
  // that belongs to a different table/store than the one currently in the
  // URL, without having to clear activeOrderId itself on every context
  // change (which risks racing a legitimate same-table reload).
  activeOrderStoreId: string | null;
  activeOrderTableId: string | null;
  waiterRequests: WaiterRequest[];
  createOrder: (params: {
    store: number;
    tableId?: number;
    customerName?: string;
    notes?: string;
    paymentMethod?: string;
    session?: string;
    splitCount?: number;
    idempotencyKey?: string;
    items: {
      productId?: number;
      productName: string;
      quantity: number;
      price: number;
      notes?: string;
      options?: unknown[];
      modifiers?: unknown[];
      bundleId?: number | null;
    }[];
  }) => Promise<Order>;
  setActiveOrder: (
    orderId: string | null,
    context?: { storeId: string | null; tableId: string | null },
  ) => void;
  addWaiterRequest: (request: WaiterRequest) => void;
  submitWaiterRequest: (params: {
    store: number;
    type: string;
    tableId?: number;
    orderId?: string;
    notes?: string;
    customerName?: string;
  }) => Promise<void>;
  fetchWaiterRequests: (storeId: string, tableId?: string) => Promise<void>;
  getWaiterRequests: () => WaiterRequest[];
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      activeOrderId: null,
      activeOrderStoreId: null,
      activeOrderTableId: null,
      waiterRequests: [],

      createOrder: async (params) => {
        const order = await createCustomerOrder(params);
        // params.store/tableId are the values order creation was actually
        // submitted with (URL-authoritative as of G-4), so they're the
        // correct context to remember alongside the resulting order id.
        set({
          activeOrderId: order.id,
          activeOrderStoreId: String(params.store),
          activeOrderTableId:
            params.tableId != null ? String(params.tableId) : null,
        });
        return order;
      },

      setActiveOrder: (orderId, context) =>
        set({
          activeOrderId: orderId,
          activeOrderStoreId: context?.storeId ?? null,
          activeOrderTableId: context?.tableId ?? null,
        }),

      addWaiterRequest: (request) =>
        set({
          waiterRequests: [request, ...get().waiterRequests],
        }),

      submitWaiterRequest: async (params) => {
        const result = await createWaiterRequest({
          ...params,
          orderId: params.orderId ? Number(params.orderId) : undefined,
        });
        const request: WaiterRequest = {
          id: result.id,
          requestNumber: result.requestNumber,
          type: result.type as WaiterRequest["type"],
          tableName: result.tableName,
          notes: result.notes,
          createdAt: result.createdAt,
          status: "Pending",
        };
        set({
          waiterRequests: [request, ...get().waiterRequests],
        });
      },

      fetchWaiterRequests: async (storeId, tableId) => {
        const entries = await fetchMyWaiterRequests(storeId, tableId);
        const requests: WaiterRequest[] = entries.map((e) => ({
          id: e.id,
          requestNumber: e.requestNumber,
          type: e.type as WaiterRequest["type"],
          tableName: e.tableName,
          notes: e.notes,
          createdAt: e.createdAt,
          status: (e.status as WaiterRequest["status"]) || "Pending",
        }));
        set({ waiterRequests: requests });
      },

      getWaiterRequests: () =>
        get().waiterRequests.filter((r) => r.status === "Pending"),
    }),
    {
      name: "bisamakan-orders",
      partialize: (state) => ({
        activeOrderId: state.activeOrderId,
        activeOrderStoreId: state.activeOrderStoreId,
        activeOrderTableId: state.activeOrderTableId,
        waiterRequests: state.waiterRequests,
      }),
    },
  ),
);

import { beforeEach, describe, expect, test, vi } from "vitest";
import apiClient from "./apiClient";
import { fetchCustomerOrder, fetchCustomerOrders } from "./orderService";

vi.mock("./apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./apiClient")>();
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } };
});

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

// DR-09: an unpaid QR order the system expired arrives as status
// "cancelled" with endReason "expired" — it must read "Kedaluwarsa", never
// "Ditolak" (a cashier's rejection).
const order = (status: string, endReason: string | null) => ({
  id: 1,
  orderNumber: "QR-1",
  status,
  endReason,
  paymentStatus: "unpaid",
  totalPrice: 10000,
  totalQuantity: 1,
  customerName: "Tamu",
  createdAt: "2026-10-20T10:00:00Z",
  tableId: 3,
  items: [],
  table: { name: "A1" },
});

beforeEach(() => mockedGet.mockReset());

describe("order end reason", () => {
  test.each([
    ["cancelled", "expired", "Kedaluwarsa"],
    ["cancelled", "cancelled", "Ditolak"],
    ["cancelled", null, "Ditolak"],
    ["void", "void", "Dibatalkan"],
    ["pending", null, "Menunggu Konfirmasi"],
  ])("status %s + endReason %s reads %s (single order)", async (status, endReason, label) => {
    mockedGet.mockResolvedValue({ data: { data: order(status, endReason) } });
    const result = await fetchCustomerOrder("token");
    expect(result?.status).toBe(label);
    expect(result?.statusHistory[0].status).toBe(label);
  });

  test("the order list maps an expired order to Kedaluwarsa too", async () => {
    mockedGet.mockResolvedValue({
      data: { data: [order("cancelled", "expired"), { ...order("cancelled", "cancelled"), id: 2 }] },
    });
    const { orders } = await fetchCustomerOrders("5", { tableId: "3", session: "diner-abc123" });
    expect(orders.map((o) => o.status)).toEqual(["Kedaluwarsa", "Ditolak"]);
  });
});

import { beforeEach, describe, expect, test, vi } from "vitest";
import apiClient from "./apiClient";
import { fetchCustomerOrder, fetchCustomerOrders } from "./orderService";

vi.mock("./apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./apiClient")>();
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } };
});

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

// A QR order the cashier settles is status "paid" while the kitchen display
// still advances its items. Paying must not jump the diner to "Sudah
// Diantar": the step follows the items' kitchen progress.
const paidOrder = (itemStatuses: string[]) => ({
  id: 1,
  orderNumber: "QR-1",
  status: "paid",
  endReason: null,
  paymentStatus: "paid",
  totalPrice: 30000,
  totalQuantity: itemStatuses.length,
  customerName: "Tamu",
  createdAt: "2026-10-22T10:00:00Z",
  tableId: 3,
  items: itemStatuses.map((status, i) => ({
    id: i + 1,
    product: 10 + i,
    productName: `Menu ${i + 1}`,
    quantity: 1,
    price: 15000,
    totalPrice: 15000,
    status,
  })),
  table: { name: "A1" },
});

beforeEach(() => mockedGet.mockReset());

describe("paid order follows the kitchen", () => {
  test.each([
    [["pending", "pending"], "Diproses"],
    [["preparing", "pending"], "Sedang Dimasak"],
    [["ready", "preparing"], "Sedang Dimasak"],
    [["ready", "served"], "Siap Diantar"],
    [["served", "served"], "Sudah Diantar"],
    [[], "Diproses"],
  ])("items %j read %s (single order)", async (statuses, label) => {
    mockedGet.mockResolvedValue({ data: { data: paidOrder(statuses) } });
    const result = await fetchCustomerOrder("token");
    expect(result?.status).toBe(label);
    expect(result?.paymentStatus).toBe("paid");
  });

  test("the order list maps a paid, not yet served order to its kitchen step", async () => {
    mockedGet.mockResolvedValue({ data: { data: [paidOrder(["preparing"])] } });
    const { orders } = await fetchCustomerOrders("5", { tableId: "3", session: "diner-abc123" });
    expect(orders[0].status).toBe("Sedang Dimasak");
  });
});

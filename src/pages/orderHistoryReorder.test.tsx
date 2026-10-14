import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OrderHistoryPage from "./OrderHistoryPage";
import { useCartStore } from "../store/useCartStore";

afterEach(cleanup);

vi.mock("../services/orderService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/orderService")>();
  return { ...actual, fetchCustomerOrders: vi.fn() };
});

vi.mock("../services/productService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/productService")>();
  return { ...actual, fetchProductById: vi.fn(), fetchBundles: vi.fn() };
});

import { fetchCustomerOrders } from "../services/orderService";
import { fetchProductById } from "../services/productService";

const mockedOrders = fetchCustomerOrders as unknown as ReturnType<typeof vi.fn>;
const mockedProductById = fetchProductById as unknown as ReturnType<typeof vi.fn>;

function historicalOrder() {
  return {
    id: "42",
    orderNumber: "CUST-42",
    tableNumber: "2",
    storeId: "1",
    customerName: "Tamu",
    items: [
      {
        productId: "5",
        name: "Kopi",
        price: 18000,
        quantity: 2,
        totalPrice: 36000,
        image: "",
      },
    ],
    subtotal: 36000,
    tax: 0,
    serviceCharge: 0,
    total: 36000,
    paymentMethod: "QRIS",
    status: "Sudah Diantar",
    createdAt: new Date().toISOString(),
    statusHistory: [],
  };
}

beforeEach(() => {
  useCartStore.setState({ storeId: "1", items: [] });
  mockedOrders.mockReset();
  mockedProductById.mockReset();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/orders?table=2&store=1&session=s"]}>
      <Routes>
        <Route path="/orders" element={<OrderHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OrderHistoryPage — offline reorder fallback", () => {
  test("an unverifiable product reorders at its historical price", async () => {
    mockedOrders.mockResolvedValueOnce({
      orders: [historicalOrder()],
      total: 1,
    });
    // Availability cannot be verified (network failure) — the historical
    // line is kept with its historical unit price.
    mockedProductById.mockRejectedValueOnce(new Error("offline"));
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /pesan ulang/i }));
    const lines = useCartStore.getState().items;
    expect(lines).toHaveLength(1);
    expect(lines[0].price).toBe(18000);
    expect(lines[0].basePrice).toBe(18000);
    expect(lines[0].quantity).toBe(2);
  });
});

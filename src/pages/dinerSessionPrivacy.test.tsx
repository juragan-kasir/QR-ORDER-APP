import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PaymentPage from "./PaymentPage";
import OrdersPage from "./OrdersPage";
import { useCartStore } from "../store/useCartStore";
import { useCheckoutStore } from "../store/useCheckoutStore";
import { createCustomerOrder } from "../services/orderService";
import { useOrders } from "../hooks/useOrders";
import { getDinerSession } from "../utils/dinerSession";

// D-10: a diner only ever sees their own orders. The table QR used to carry
// one printed `session` shared by everyone at that table; orders are now
// created and listed with this device's own token instead.

afterEach(cleanup);

vi.mock("../services/orderService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/orderService")>();
  return { ...actual, createCustomerOrder: vi.fn() };
});
vi.mock("../hooks/useOrders", () => ({
  useOrders: vi.fn(() => ({
    orders: [],
    loading: false,
    error: null,
    refetch: () => {},
    lastFetchedAt: null,
  })),
}));
vi.mock("../hooks/useStoreConfig", () => ({
  useStoreConfig: () => ({
    config: { taxRate: 0, serviceChargeRate: 0, storeName: "Toko", status: "ok" },
    loading: false,
    error: null,
    refetch: () => {},
  }),
}));
vi.mock("../hooks/usePromos", () => ({
  usePromos: () => ({ promos: [], loading: false, error: null, refetch: () => {} }),
}));

const PRINTED = "printedqr";
const url = (path: string) => `${path}?table=2&store=1&session=${PRINTED}`;
const mockedCreate = createCustomerOrder as unknown as ReturnType<typeof vi.fn>;
const mockedUseOrders = useOrders as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockedCreate.mockReset();
  mockedUseOrders.mockClear();
});

test("a new order is created with this device's token, not the printed QR session", async () => {
  useCartStore.setState({
    storeId: "1",
    items: [
      {
        id: "5",
        name: "Kopi",
        description: "",
        basePrice: 20000,
        price: 20000,
        image: "",
        category: "Minuman",
        quantity: 1,
        totalPrice: 20000,
      },
    ],
  });
  useCheckoutStore.setState({ data: { tableNumber: "2", customerName: "Tamu", subtotal: 20000 } });
  mockedCreate.mockResolvedValueOnce({
    id: "9",
    orderNumber: "CUST-9",
    tableNumber: "2",
    items: [],
    subtotal: 20000,
    tax: 0,
    serviceCharge: 0,
    total: 20000,
    paymentMethod: "QRIS",
    status: "Menunggu Konfirmasi",
  });
  render(
    <MemoryRouter initialEntries={[url("/payment")]}>
      <Routes>
        <Route path="/payment" element={<PaymentPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: /bayar sekarang|buat pesanan/i }));
  await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));

  const sent = (mockedCreate.mock.calls[0][0] as { session?: string }).session;
  expect(sent).toBe(getDinerSession("1"));
  expect(sent).not.toBe(PRINTED);
});

test("the order status page lists with this device's token, not the printed QR session", () => {
  render(
    <MemoryRouter initialEntries={[url("/orders")]}>
      <Routes>
        <Route path="/orders" element={<OrdersPage />} />
      </Routes>
    </MemoryRouter>,
  );
  const options = mockedUseOrders.mock.calls[0][1] as { tableId: string; session?: string };
  expect(options.tableId).toBe("2");
  expect(options.session).toBe(getDinerSession("1"));
  expect(options.session).not.toBe(PRINTED);
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PaymentPage from "./PaymentPage";
import { useCartStore } from "../store/useCartStore";
import { useCheckoutStore } from "../store/useCheckoutStore";
import { createCustomerOrder } from "../services/orderService";
import type { CartItem } from "../types";

afterEach(cleanup);

vi.mock("../services/orderService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/orderService")>();
  return { ...actual, createCustomerOrder: vi.fn() };
});
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

const mockedCreate = createCustomerOrder as unknown as ReturnType<typeof vi.fn>;

function cartLine(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "5",
    name: "Bakso Halus",
    description: "",
    basePrice: 15000,
    price: 15000,
    image: "",
    category: "Makanan",
    quantity: 1,
    totalPrice: 15000,
    ...overrides,
  };
}

const baseOrder = {
  id: "9",
  orderNumber: "CUST-9",
  tableNumber: "2",
  items: [],
  subtotal: 15000,
  tax: 0,
  serviceCharge: 0,
  total: 15000,
  paymentMethod: "QRIS",
  status: "Menunggu Konfirmasi",
};

function renderPage() {
  useCartStore.setState({ storeId: "1", items: [cartLine()] });
  useCheckoutStore.setState({
    data: { tableNumber: "2", customerName: "Tamu", subtotal: 15000 },
  });
  return render(
    <MemoryRouter initialEntries={["/payment?table=2&store=1&session=s"]}>
      <Routes>
        <Route path="/payment" element={<PaymentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  useCartStore.setState({ storeId: null, items: [] });
  useCheckoutStore.setState({ data: null });
  mockedCreate.mockReset();
});

describe("PaymentPage second-round trap", () => {
  test("unpaid confirmation hides Pesan Lagi and explains why", async () => {
    renderPage();
    mockedCreate.mockResolvedValueOnce({ ...baseOrder, paymentStatus: "unpaid" });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /bayar sekarang|buat pesanan/i }));

    await waitFor(() => expect(screen.queryByText("Pesanan Berhasil!")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /pesan lagi/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/bayar pesanan ini di kasir dulu/i)
    ).toBeInTheDocument();
  });

  test("paid confirmation still offers Pesan Lagi", async () => {
    renderPage();
    mockedCreate.mockResolvedValueOnce({ ...baseOrder, paymentStatus: "paid" });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /bayar sekarang|buat pesanan/i }));

    await waitFor(() => expect(screen.queryByText("Pesanan Berhasil!")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /pesan lagi/i })).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PaymentPage from "./PaymentPage";
import { useCartStore } from "../store/useCartStore";
import { useCheckoutStore } from "../store/useCheckoutStore";
import { createCustomerOrder } from "../services/orderService";
import { ApiError } from "../services/apiClient";
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

// DR-23 K at the checkout boundary (PaymentPage.submitOrder): a successful
// order clears its attempt key; any failure — network, timeout, 5xx, or a
// refusal — keeps it, so retrying the same cart reuses the same key and the
// backend dedupes instead of creating a second order.

const mockedCreate = createCustomerOrder as unknown as ReturnType<typeof vi.fn>;
const PREFIX = "bisa-makan-attempt-key:";

function cartLine(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "5",
    name: "Kopi",
    description: "",
    basePrice: 20000,
    price: 20000,
    image: "",
    category: "Minuman",
    quantity: 1,
    totalPrice: 20000,
    ...overrides,
  };
}

function renderPage() {
  useCartStore.setState({ storeId: "1", items: [cartLine()] });
  useCheckoutStore.setState({
    data: { tableNumber: "2", customerName: "Tamu", subtotal: 20000 },
  });
  return render(
    <MemoryRouter initialEntries={["/payment?table=2&store=1&session=s"]}>
      <Routes>
        <Route path="/payment" element={<PaymentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const payButton = () =>
  screen.findByRole("button", { name: /bayar sekarang|buat pesanan/i });

const storedAttemptKeys = () =>
  Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX));

const sentKey = (call: number) =>
  (mockedCreate.mock.calls[call][0] as { idempotencyKey: string }).idempotencyKey;

const createdOrder = {
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
};

beforeEach(() => {
  sessionStorage.clear();
  useCartStore.setState({ storeId: null, items: [] });
  useCheckoutStore.setState({ data: null });
  mockedCreate.mockReset();
});

describe("PaymentPage attempt key — scenario 4: success cleanup", () => {
  test("a created order clears this cart's attempt key", async () => {
    renderPage();
    mockedCreate.mockResolvedValueOnce(createdOrder);
    const user = userEvent.setup();
    await user.click(await payButton());

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(sentKey(0).length).toBeGreaterThan(0);
    await waitFor(() => expect(storedAttemptKeys()).toHaveLength(0));
  });

  test("success clears only its own attempt, not another cart's", async () => {
    const otherAttempt = `${PREFIX}other-cart-signature`;
    sessionStorage.setItem(otherAttempt, "other-key");
    renderPage();
    mockedCreate.mockResolvedValueOnce(createdOrder);
    const user = userEvent.setup();
    await user.click(await payButton());

    await waitFor(() => expect(storedAttemptKeys()).toEqual([otherAttempt]));
    expect(sessionStorage.getItem(otherAttempt)).toBe("other-key");
  });
});

describe("PaymentPage attempt key — scenario 5: failure retention", () => {
  test.each([
    ["a network failure", new ApiError("Tidak dapat terhubung ke server.", 0)],
    ["a timeout", new ApiError("Koneksi timeout. Periksa jaringan dan coba lagi.", 0)],
    ["a 5xx", new ApiError("Internal Server Error", 500)],
    ["a refusal (400)", new ApiError("Produk tidak tersedia", 400)],
  ])("%s keeps the key, and the retry of the same cart reuses it", async (_label, error) => {
    renderPage();
    mockedCreate.mockRejectedValueOnce(error);
    const user = userEvent.setup();
    await user.click(await payButton());

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const first = sentKey(0);
    expect(await screen.findByText(error.message)).toBeInTheDocument();
    const stored = storedAttemptKeys();
    expect(stored).toHaveLength(1);
    expect(sessionStorage.getItem(stored[0])).toBe(first);

    mockedCreate.mockResolvedValueOnce(createdOrder);
    await user.click(await payButton());
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(2));
    expect(sentKey(1)).toBe(first);
    await waitFor(() => expect(storedAttemptKeys()).toHaveLength(0));
  });

  test("a failed attempt's key survives a remount (reload) and is reused", async () => {
    renderPage();
    mockedCreate.mockRejectedValueOnce(new ApiError("Tidak dapat terhubung ke server.", 0));
    const user = userEvent.setup();
    await user.click(await payButton());
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const first = sentKey(0);

    cleanup();
    renderPage();
    mockedCreate.mockResolvedValueOnce(createdOrder);
    await userEvent.setup().click(await payButton());
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(2));
    expect(sentKey(1)).toBe(first);
  });

  // Scenario 9 at the boundary: a changed cart is a new attempt.
  test("changing the cart after a failure sends a different key", async () => {
    renderPage();
    mockedCreate.mockRejectedValueOnce(new ApiError("Tidak dapat terhubung ke server.", 0));
    const user = userEvent.setup();
    await user.click(await payButton());
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const first = sentKey(0);

    useCartStore.setState({ items: [cartLine({ quantity: 2, totalPrice: 40000 })] });
    mockedCreate.mockResolvedValueOnce(createdOrder);
    await user.click(await payButton());
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(2));
    expect(sentKey(1)).not.toBe(first);
  });
});

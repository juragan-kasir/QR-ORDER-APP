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
    // DR-17: status "ok" keeps these DR-11 tests on the submittable path;
    // DR-17 quote states are covered in paymentTaxQuote.test.tsx.
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

function seed() {
  useCartStore.setState({ storeId: "1", items: [cartLine()] });
  useCheckoutStore.setState({
    data: { tableNumber: "2", customerName: "Tamu", subtotal: 20000 },
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/payment?table=2&store=1&session=s"]}>
      <Routes>
        <Route path="/payment" element={<PaymentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitOrder() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: /bayar sekarang/i }),
  );
  return user;
}

function priceChangedError() {
  return new ApiError("One or more item prices changed.", 409, {
    code: "PRICE_CHANGED",
    data: {
      code: "PRICE_CHANGED",
      message: "One or more item prices changed.",
      items: [
        { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
      ],
    },
  });
}

beforeEach(() => {
  useCartStore.setState({ storeId: null, items: [] });
  useCheckoutStore.setState({ data: null });
  mockedCreate.mockReset();
});

describe("PaymentPage — 409 PRICE_CHANGED (DR-11)", () => {
  test("shows the Indonesian confirmation and does not retry automatically", async () => {
    seed();
    renderPage();
    mockedCreate.mockRejectedValueOnce(priceChangedError());
    await submitOrder();
    expect(
      await screen.findByRole("heading", { name: "Harga berubah" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledTimes(1),
    );
    // Settle any stray timers/promises: still exactly one submission.
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  test("declining keeps the cart and submits nothing further", async () => {
    seed();
    renderPage();
    mockedCreate.mockRejectedValueOnce(priceChangedError());
    const user = await submitOrder();
    await screen.findByRole("heading", { name: "Harga berubah" });
    await user.click(screen.getByRole("button", { name: /batal/i }));
    expect(
      screen.queryByRole("heading", { name: "Harga berubah" }),
    ).not.toBeInTheDocument();
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  test("confirming resubmits once with accepted prices and the same idempotency key", async () => {
    seed();
    renderPage();
    mockedCreate.mockRejectedValueOnce(priceChangedError());
    mockedCreate.mockResolvedValueOnce({
      id: "9",
      orderNumber: "CUST-1",
      tableNumber: "2",
      items: [],
      subtotal: 25000,
      tax: 0,
      serviceCharge: 0,
      total: 25000,
      paymentMethod: "QRIS",
      status: "Menunggu Konfirmasi",
      createdAt: "",
      statusHistory: [],
    });
    const user = await submitOrder();
    await screen.findByRole("heading", { name: "Harga berubah" });
    await user.click(screen.getByRole("button", { name: /konfirmasi/i }));
    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledTimes(2),
    );
    const first = mockedCreate.mock.calls[0][0];
    const second = mockedCreate.mock.calls[1][0];
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.items[0].expectedPrice).toBe(25000);
    // Success clears the cart and shows confirmation (existing behavior).
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(
      await screen.findByText(/pesanan berhasil/i),
    ).toBeInTheDocument();
  });

  test("double confirm cannot create concurrent submissions", async () => {
    seed();
    renderPage();
    mockedCreate.mockRejectedValueOnce(priceChangedError());
    let resolveSecond!: (value: unknown) => void;
    mockedCreate.mockImplementationOnce(
      () => new Promise((resolve) => (resolveSecond = resolve)),
    );
    const user = await submitOrder();
    await screen.findByRole("heading", { name: "Harga berubah" });
    const confirm = screen.getByRole("button", { name: /konfirmasi/i });
    await user.click(confirm);
    await user.click(confirm);
    expect(mockedCreate).toHaveBeenCalledTimes(2);
    resolveSecond({
      id: "9",
      orderNumber: "CUST-1",
      tableNumber: "2",
      items: [],
      subtotal: 25000,
      tax: 0,
      serviceCharge: 0,
      total: 25000,
      paymentMethod: "QRIS",
      status: "Menunggu Konfirmasi",
      createdAt: "",
      statusHistory: [],
    });
    await screen.findByText(/pesanan berhasil/i);
    expect(mockedCreate).toHaveBeenCalledTimes(2);
  });

  test("a cart changed while confirming invalidates the stale dialog", async () => {
    seed();
    renderPage();
    mockedCreate.mockRejectedValueOnce(priceChangedError());
    const user = await submitOrder();
    await screen.findByRole("heading", { name: "Harga berubah" });
    useCartStore.getState().updateQuantity("5", 3);
    expect(
      await screen.findByText(/keranjang berubah setelah harga diperbarui/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /konfirmasi/i }),
    ).not.toBeInTheDocument();
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /batal/i }));
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });

  test("a malformed PRICE_CHANGED body falls back without dialog or retry", async () => {
    seed();
    renderPage();
    mockedCreate.mockRejectedValueOnce(
      new ApiError("Conflict.", 409, { code: "PRICE_CHANGED", data: {} }),
    );
    await submitOrder();
    // Existing verbatim error path — no dialog, no retry, cart kept.
    await screen.findByText("Conflict.");
    expect(
      screen.queryByRole("heading", { name: "Harga berubah" }),
    ).not.toBeInTheDocument();
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  test("an unrelated 409 keeps the existing error path", async () => {
    seed();
    renderPage();
    mockedCreate.mockRejectedValueOnce(
      new ApiError("idempotencyKey already used with a different payload.", 409),
    );
    await submitOrder();
    await screen.findByText(/already used with a different payload/i);
    expect(
      screen.queryByRole("heading", { name: "Harga berubah" }),
    ).not.toBeInTheDocument();
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  test("two rapid taps send a single initial order", async () => {
    seed();
    renderPage();
    let resolveFirst!: (value: unknown) => void;
    mockedCreate.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve)),
    );
    const user = userEvent.setup();
    const button = await screen.findByRole("button", {
      name: /bayar sekarang/i,
    });
    // Dispatched without awaiting between them, narrowing the window in
    // which React could re-render and disable the button. The synchronous
    // re-entry guard is the primary protection for a pre-render double
    // tap; the disabled state below is the secondary one. (user-event
    // flushes between clicks, so this test cannot fully isolate the guard
    // from the disabled state — both mechanisms are asserted together.)
    await Promise.all([user.click(button), user.click(button)]);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    resolveFirst({
      id: "9",
      orderNumber: "CUST-1",
      tableNumber: "2",
      items: [],
      subtotal: 20000,
      tax: 0,
      serviceCharge: 0,
      total: 20000,
      paymentMethod: "QRIS",
      status: "Menunggu Konfirmasi",
      createdAt: "",
      statusHistory: [],
    });
    await screen.findByText(/pesanan berhasil/i);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  test("a retry after failure reuses the attempt key; a remount starts a new attempt", async () => {
    seed();
    renderPage();
    mockedCreate.mockRejectedValueOnce(new ApiError("Gagal.", 500));
    mockedCreate.mockResolvedValueOnce({
      id: "9",
      orderNumber: "CUST-1",
      tableNumber: "2",
      items: [],
      subtotal: 20000,
      tax: 0,
      serviceCharge: 0,
      total: 20000,
      paymentMethod: "QRIS",
      status: "Menunggu Konfirmasi",
      createdAt: "",
      statusHistory: [],
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: /bayar sekarang/i }),
    );
    await screen.findByText("Gagal.");
    await user.click(
      await screen.findByRole("button", { name: /bayar sekarang/i }),
    );
    await screen.findByText(/pesanan berhasil/i);
    const firstKey = mockedCreate.mock.calls[0][0].idempotencyKey;
    const retryKey = mockedCreate.mock.calls[1][0].idempotencyKey;
    expect(typeof firstKey).toBe("string");
    expect(retryKey).toBe(firstKey);
    // A fresh mount is a fresh attempt with a fresh key.
    cleanup();
    useCartStore.setState({ storeId: "1", items: [cartLine()] });
    useCheckoutStore.setState({
      data: { tableNumber: "2", customerName: "Tamu", subtotal: 20000 },
    });
    mockedCreate.mockResolvedValueOnce({
      id: "10",
      orderNumber: "CUST-2",
      tableNumber: "2",
      items: [],
      subtotal: 20000,
      tax: 0,
      serviceCharge: 0,
      total: 20000,
      paymentMethod: "QRIS",
      status: "Menunggu Konfirmasi",
      createdAt: "",
      statusHistory: [],
    });
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: /bayar sekarang/i }),
    );
    await screen.findByText(/pesanan berhasil/i);
    expect(mockedCreate.mock.calls[2][0].idempotencyKey).not.toBe(firstKey);
  });

  test("shows a loading skeleton before the payment content", () => {
    seed();
    const { container } = renderPage();
    expect(
      container.querySelectorAll(".skeleton-shimmer").length,
    ).toBeGreaterThan(0);
  });
});

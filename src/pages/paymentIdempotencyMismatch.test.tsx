import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

const mockedCreate = createCustomerOrder as unknown as ReturnType<typeof vi.fn>;
const ATTEMPT_PREFIX = "bisa-makan-attempt-key:";

// DR-23 K: when the backend reports that this cart's attempt key already
// recorded an order (409 IDEMPOTENCY_MISMATCH), the diner is sent to the
// table's active orders — never a silent retry, never a fresh key.

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

function OrdersMarker() {
  const location = useLocation();
  return <p data-testid="orders-page">{location.search}</p>;
}

function renderPage() {
  useCartStore.setState({ storeId: "1", items: [cartLine()] });
  useCheckoutStore.setState({ data: { tableNumber: "2", customerName: "Tamu", subtotal: 20000 } });
  return render(
    <MemoryRouter initialEntries={["/payment?table=2&store=1&session=s"]}>
      <Routes>
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/orders" element={<OrdersMarker />} />
      </Routes>
    </MemoryRouter>,
  );
}

const payButton = () => screen.findByRole("button", { name: /bayar sekarang|buat pesanan/i });

function mismatch(data: Record<string, unknown> = {}) {
  return new ApiError("idempotencyKey already used with a different payload", 409, {
    code: "IDEMPOTENCY_MISMATCH",
    data: {
      code: "IDEMPOTENCY_MISMATCH",
      message: "idempotencyKey already used with a different payload",
      fields: ["paymentMethod"],
      ...data,
    },
  });
}

const storedAttemptKeys = () =>
  Object.keys(sessionStorage).filter((k) => k.startsWith(ATTEMPT_PREFIX));

beforeEach(() => {
  sessionStorage.clear();
  useCartStore.setState({ storeId: null, items: [] });
  useCheckoutStore.setState({ data: null });
  mockedCreate.mockReset();
});

describe("PaymentPage — 409 IDEMPOTENCY_MISMATCH (DR-23 K)", () => {
  test("shows the order-already-recorded state and routes to the table's active orders", async () => {
    renderPage();
    mockedCreate.mockRejectedValueOnce(mismatch());
    const user = userEvent.setup();
    await user.click(await payButton());

    const panel = await screen.findByTestId("order-already-recorded");
    expect(panel).toHaveTextContent("Pesanan ini sudah tercatat");
    // no raw backend text, no generic error banner
    expect(screen.queryByText(/idempotencyKey already used/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lihat Pesanan" }));
    const orders = await screen.findByTestId("orders-page");
    expect(orders.textContent).toContain("table=2");
    expect(orders.textContent).toContain("store=1");
  });

  test("never retries or mints a new attempt: one request, key and cart kept, pay disabled", async () => {
    renderPage();
    mockedCreate.mockRejectedValueOnce(mismatch());
    const user = userEvent.setup();
    await user.click(await payButton());
    await screen.findByTestId("order-already-recorded");

    const keysAfter = storedAttemptKeys();
    expect(keysAfter).toHaveLength(1);
    const keySent = mockedCreate.mock.calls[0][0].idempotencyKey;
    expect(sessionStorage.getItem(keysAfter[0])).toBe(keySent);

    const button = await payButton();
    expect(button).toBeDisabled();
    await user.click(button);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  test.each([
    ["a valid", { existingOrder: { id: 7, orderNumber: "CUST-7", totalPrice: 20000 } }],
    ["a malformed", { existingOrder: { orderNumber: 12 } }],
  ])("%s existingOrder in the body follows the same active-orders recovery", async (_l, data) => {
    renderPage();
    mockedCreate.mockRejectedValueOnce(mismatch(data));
    const user = userEvent.setup();
    await user.click(await payButton());
    expect(await screen.findByTestId("order-already-recorded")).toBeInTheDocument();
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  test("a 409 that is not IDEMPOTENCY_MISMATCH keeps the existing error path", async () => {
    renderPage();
    mockedCreate.mockRejectedValueOnce(new ApiError("Konflik lain", 409, { code: "SOMETHING_ELSE" }));
    const user = userEvent.setup();
    await user.click(await payButton());
    expect(await screen.findByText("Konflik lain")).toBeInTheDocument();
    expect(screen.queryByTestId("order-already-recorded")).not.toBeInTheDocument();
    await waitFor(async () => expect(await payButton()).not.toBeDisabled());
  });

  test("success still clears the attempt key (unchanged)", async () => {
    renderPage();
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
    const user = userEvent.setup();
    await user.click(await payButton());
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(storedAttemptKeys()).toHaveLength(0));
  });
});

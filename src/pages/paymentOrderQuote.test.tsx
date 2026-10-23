import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PaymentPage from "./PaymentPage";
import { useCartStore } from "../store/useCartStore";
import { useCheckoutStore } from "../store/useCheckoutStore";
import { createCustomerOrder } from "../services/orderService";
import apiClient from "../services/apiClient";
import type { CartItem } from "../types";

// FG-PRICE-02 / FG-PROMO-01: the summary shows the backend's quote — the
// automatic campaign by name and PPN on the discounted subtotal — and the
// confirmation shows the total actually recorded on the order.

afterEach(cleanup);

vi.mock("../services/orderService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/orderService")>();
  return { ...actual, createCustomerOrder: vi.fn() };
});

vi.mock("../hooks/usePromos", () => ({
  usePromos: () => ({ promos: [], loading: false, error: null, refetch: () => {} }),
}));

vi.mock("../services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/apiClient")>();
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } };
});

const mockedCreate = createCustomerOrder as unknown as ReturnType<typeof vi.fn>;
const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

function cartLine(): CartItem {
  return {
    id: "5",
    name: "Bakso",
    description: "",
    basePrice: 50000,
    price: 50000,
    image: "",
    category: "Makanan",
    quantity: 2,
    totalPrice: 100000,
  };
}

const QUOTE = {
  subTotal: 100000,
  discountAmount: 10000,
  discountApplied: [{ campaignId: 4, name: "Diskon Jumat 10%", amount: 10000 }],
  taxRate: 11,
  taxAmount: 9900,
  serviceChargeAmount: 0,
  totalPrice: 99900,
};

function seed() {
  useCartStore.setState({ storeId: "1", items: [cartLine()] });
  useCheckoutStore.setState({
    data: { tableNumber: "2", customerName: "Tamu", subtotal: 100000 },
  });
  mockedGet.mockImplementation((url: string) =>
    url === "/order/customer-tax-rate"
      ? Promise.resolve({ data: { message: "ok", data: { rate: 11, serviceChargeRate: null } } })
      : Promise.resolve({ data: { message: "ok", data: [] } }),
  );
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

const payButton = () => screen.findByRole("button", { name: /memuat|buat pesanan/i });

beforeEach(() => {
  mockedCreate.mockReset();
  mockedGet.mockReset();
  mockedPost.mockReset();
});

describe("PaymentPage — backend order quote", () => {
  test("shows the campaign line and the quoted total, taxed after the discount", async () => {
    mockedPost.mockResolvedValue({ data: { success: true, data: QUOTE } });
    seed();
    renderPage();
    expect(await screen.findByText("Diskon Jumat 10%")).toBeTruthy();
    const pay = await payButton();
    // 100,000 − 10,000 + 11 % of 90,000 = 99,900 (not 111,000)
    await waitFor(() => expect(pay.textContent).toContain("99,900"));
    expect(pay).toBeEnabled();
    expect(mockedPost).toHaveBeenCalledWith("/order/customer-quote", {
      store: 1,
      items: [expect.objectContaining({ productId: 5, quantity: 2 })],
    });
  });

  test("without a quote it falls back to the undiscounted cart and says so", async () => {
    mockedPost.mockRejectedValue(new Error("offline"));
    seed();
    renderPage();
    expect(await screen.findByText(/promo otomatis belum bisa dihitung/i)).toBeTruthy();
    const pay = await payButton();
    await waitFor(() => expect(pay.textContent).toContain("111,000"));
    expect(screen.queryByText("Diskon Jumat 10%")).toBeNull();
  });

  test("the confirmation shows the total the backend recorded", async () => {
    mockedPost.mockResolvedValue({ data: { success: true, data: QUOTE } });
    mockedCreate.mockResolvedValue({
      id: "9",
      orderNumber: "CUST-1",
      tableNumber: "2",
      items: [],
      subtotal: 100000,
      discount: 10000,
      tax: 9900,
      serviceCharge: 0,
      total: 99900,
      paymentMethod: "QRIS",
      paymentStatus: "unpaid",
      status: "Menunggu Konfirmasi",
      createdAt: new Date().toISOString(),
      statusHistory: [],
    });
    seed();
    renderPage();
    const pay = await payButton();
    await waitFor(() => expect(pay.textContent).toContain("99,900"));
    await userEvent.setup().click(pay);
    expect(await screen.findByText("Total Tagihan")).toBeTruthy();
    expect(screen.getByText("Rp99,900")).toBeTruthy();
    expect(screen.getByText("−Rp10,000")).toBeTruthy();
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PaymentPage from "./PaymentPage";
import { useCartStore } from "../store/useCartStore";
import { useCheckoutStore } from "../store/useCheckoutStore";
import { createCustomerOrder } from "../services/orderService";
import apiClient, { ApiError } from "../services/apiClient";
import type { CartItem } from "../types";

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
  return {
    ...actual,
    default: { get: vi.fn(), post: vi.fn() },
  };
});

const mockedCreate = createCustomerOrder as unknown as ReturnType<typeof vi.fn>;
const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

function cartLine(): CartItem {
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
  };
}

function seed() {
  useCartStore.setState({ storeId: "1", items: [cartLine()] });
  useCheckoutStore.setState({
    data: { tableNumber: "2", customerName: "Tamu", subtotal: 20000 },
  });
}

function renderPage(storeId: string) {
  return render(
    <MemoryRouter initialEntries={[`/payment?table=2&store=${storeId}&session=s`]}>
      <Routes>
        <Route path="/payment" element={<PaymentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// DR-17: the quote endpoint — never store tax rows — decides the checkout.
function mockQuote(rate: unknown, serviceChargeRate: unknown) {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/order/customer-tax-rate") {
      return Promise.resolve({
        data: { message: "ok", data: { rate, serviceChargeRate } },
      });
    }
    return Promise.resolve({ data: { message: "ok", data: [] } });
  });
}

function mockQuoteFailure(error: unknown) {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/order/customer-tax-rate") {
      return Promise.reject(error);
    }
    return Promise.resolve({ data: { message: "ok", data: [] } });
  });
}

function quoteCalls() {
  return mockedGet.mock.calls.filter(([url]) => url === "/order/customer-tax-rate");
}

async function payButton(): Promise<HTMLElement> {
  // The pay button is the only one whose label ever mentions paying or
  // loading ("Memuat…" while the quote loads, "Bayar Sekarang" after).
  return screen.findByRole("button", { name: /memuat|bayar sekarang/i });
}

beforeEach(() => {
  useCartStore.setState({ storeId: null, items: [] });
  useCheckoutStore.setState({ data: null });
  mockedCreate.mockReset();
  mockedGet.mockReset();
  mockedCreate.mockResolvedValue({ id: 1 } as never);
});

describe("PaymentPage — QR tax quote (DR-17)", () => {
  test("uses the backend quote rate in the total and submits", async () => {
    mockQuote(11, null);
    seed();
    renderPage("t1");
    // 20000 + 11% = 22200; the quote endpoint (not store rows) was consulted.
    const pay = await payButton();
    await waitFor(() => expect(pay).toBeEnabled());
    // jsdom formats with en-US grouping: 20000 + 11% = Rp22,200.
    expect(pay.textContent).toContain("22,200");
    expect(quoteCalls()).toHaveLength(1);
    expect(quoteCalls()[0][1]).toMatchObject({
      params: { store: "t1", channel: "qr" },
    });
    expect(
      mockedGet.mock.calls.some(([url]) => url === "/tax-config/public"),
    ).toBe(false);
    // QR service charge is not applicable: no row, nothing added.
    expect(screen.queryByText(/service/i)).toBeNull();
    await userEvent.setup().click(pay);
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
  });

  test("accepts an explicitly configured zero rate", async () => {
    mockQuote(0, null);
    seed();
    renderPage("t2");
    const pay = await payButton();
    await waitFor(() => expect(pay).toBeEnabled());
    expect(await screen.findByText(/pajak \(0%\)/i)).toBeTruthy();
    await userEvent.setup().click(pay);
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
  });

  test("missing PPN shows a setup error and blocks submission with cart intact", async () => {
    mockQuoteFailure(new ApiError("PPN tax configuration is missing", 400));
    seed();
    renderPage("t3");
    expect(await screen.findByText(/konfigurasi pajak.*belum lengkap/i)).toBeTruthy();
    const pay = await payButton();
    expect(pay).toBeDisabled();
    await userEvent.setup().click(pay);
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  test("coded INVALID_STORE shows the transient error, not the setup message, and blocks submission", async () => {
    mockQuoteFailure(
      new ApiError("Invalid store value", 400, { code: "INVALID_STORE" }),
    );
    seed();
    renderPage("t8");
    expect(await screen.findByText(/gagal memuat konfigurasi pajak/i)).toBeTruthy();
    expect(screen.queryByText(/konfigurasi pajak.*belum lengkap/i)).toBeNull();
    const pay = await payButton();
    expect(pay).toBeDisabled();
    await userEvent.setup().click(pay);
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  test("transient failure shows an error with retry; retry recovers without duplicate submits", async () => {
    mockQuoteFailure(new ApiError("boom", 500));
    seed();
    renderPage("t4");
    expect(await screen.findByText(/gagal memuat konfigurasi pajak/i)).toBeTruthy();
    expect(quoteCalls()).toHaveLength(1);

    mockQuote(11, null);
    await userEvent.setup().click(
      await screen.findByRole("button", { name: /coba lagi/i }),
    );
    const pay = await payButton();
    await waitFor(() => expect(pay).toBeEnabled());
    expect(quoteCalls()).toHaveLength(2);
    await userEvent.setup().click(pay);
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
  });

  test("an unexpected nonzero QR service charge fails safe and blocks submission", async () => {
    mockQuote(11, 5);
    seed();
    renderPage("t5");
    expect(await screen.findByText(/gagal memuat konfigurasi pajak/i)).toBeTruthy();
    const pay = await payButton();
    expect(pay).toBeDisabled();
    await userEvent.setup().click(pay);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  test("a numeric zero service charge is shown as zero and adds nothing", async () => {
    mockQuote(11, 0);
    seed();
    renderPage("t6");
    const pay = await payButton();
    await waitFor(() => expect(pay).toBeEnabled());
    expect(screen.getByText(/service \(0%\)/i)).toBeTruthy();
    await userEvent.setup().click(pay);
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
  });

  test("submission stays blocked while the quote is loading", async () => {
    let resolveQuote!: (v: unknown) => void;
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return new Promise((resolve) => {
          resolveQuote = resolve;
        });
      }
      return Promise.resolve({ data: { message: "ok", data: [] } });
    });
    seed();
    renderPage("t7");
    // Wait until the quote request is in flight before resolving it.
    await waitFor(() => expect(quoteCalls()).toHaveLength(1));
    const pay = await payButton();
    expect(pay).toBeDisabled();
    resolveQuote({ data: { message: "ok", data: { rate: 11, serviceChargeRate: null } } });
    await waitFor(() => expect(pay).toBeEnabled());
  });
});

describe("PaymentPage — split-bill tax readiness (DR-17 F1)", () => {
  async function selectSplitBill() {
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: /split bill/i }));
    return screen.findByText(/setiap orang membayar/i);
  }

  function splitAmountBox() {
    // The per-person amount lives in the same block as its label.
    const label = screen.getByText(/setiap orang membayar/i);
    const box = label.closest("div");
    if (!box) throw new Error("split-bill amount block not found");
    return box;
  }

  test("withholds the per-person amount while the quote is loading", async () => {
    let resolveQuote!: (v: unknown) => void;
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return new Promise((resolve) => {
          resolveQuote = resolve;
        });
      }
      return Promise.resolve({ data: { message: "ok", data: [] } });
    });
    seed();
    renderPage("s1");
    await waitFor(() => expect(quoteCalls()).toHaveLength(1));
    await selectSplitBill();
    // 20000 / 2 with no verified tax basis must never appear as final.
    expect(within(splitAmountBox()).queryByText(/Rp[\d.,]+/)).toBeNull();
    resolveQuote({
      data: { message: "ok", data: { rate: 11, serviceChargeRate: null } },
    });
    // 22200 / 2 once the quote is valid.
    await waitFor(() =>
      expect(within(splitAmountBox()).queryByText("Rp11,100")).toBeTruthy(),
    );
  });

  test("withholds the per-person amount when PPN is missing", async () => {
    mockQuoteFailure(new ApiError("PPN tax configuration is missing", 400));
    seed();
    renderPage("s2");
    expect(await screen.findByText(/konfigurasi pajak.*belum lengkap/i)).toBeTruthy();
    await selectSplitBill();
    expect(within(splitAmountBox()).queryByText(/Rp[\d.,]+/)).toBeNull();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  test("shows the correct per-person amount with a valid quote", async () => {
    mockQuote(11, null);
    seed();
    renderPage("s3");
    await selectSplitBill();
    // (20000 + 11%) / 2 with the backend-resolved rate.
    await waitFor(() =>
      expect(within(splitAmountBox()).queryByText("Rp11,100")).toBeTruthy(),
    );
  });
});

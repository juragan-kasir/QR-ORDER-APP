import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CartSummary from "./CartSummary";
import { useCartStore } from "../store/useCartStore";
import apiClient, { ApiError } from "../services/apiClient";

afterEach(cleanup);

vi.mock("../services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/apiClient")>();
  return {
    ...actual,
    default: { get: vi.fn(), post: vi.fn() },
  };
});

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

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

function renderSummary(storeId: string, showDetails = true) {
  return render(
    <MemoryRouter initialEntries={[`/cart?store=${storeId}`]}>
      <CartSummary showDetails={showDetails} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedGet.mockReset();
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
});

describe("CartSummary — QR tax quote (DR-17)", () => {
  test("shows quote-based tax and total with no service-charge row", async () => {
    mockQuote(11, null);
    renderSummary("c1");
    expect(await screen.findByText(/pajak \(11%\)/i)).toBeTruthy();
    expect(screen.queryByText(/service/i)).toBeNull();
    expect(screen.getByText("Rp22,200")).toBeTruthy();
  });

  test("shows a setup error instead of a zero-tax total when PPN is missing", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(new ApiError("PPN missing", 400));
      }
      return Promise.resolve({ data: { message: "ok", data: [] } });
    });
    renderSummary("c2");
    expect(await screen.findByText(/konfigurasi pajak.*belum lengkap/i)).toBeTruthy();
    // No final total is presented while the effective rate is unknown.
    expect(screen.queryByText(/^total$/i)).toBeNull();
  });

  test("shows a retryable error instead of a zero-tax total on failure", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(new ApiError("boom", 500));
      }
      return Promise.resolve({ data: { message: "ok", data: [] } });
    });
    renderSummary("c3");
    expect(await screen.findByText(/gagal memuat konfigurasi pajak/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /coba lagi/i })).toBeTruthy();
    // No final total is presented while the effective rate is unknown.
    expect(screen.queryByText(/^total$/i)).toBeNull();
  });

  test("compact summary withholds its total while the quote is invalid", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(new ApiError("PPN missing", 400));
      }
      return Promise.resolve({ data: { message: "ok", data: [] } });
    });
    renderSummary("c4", false);
    expect(await screen.findByText("…")).toBeTruthy();
    expect(screen.queryByText(/Rp[\d.,]+/)).toBeNull();
  });

  test("compact summary shows its total with a valid quote", async () => {
    mockQuote(11, null);
    renderSummary("c5", false);
    expect(await screen.findByText("Rp22,200")).toBeTruthy();
  });
});

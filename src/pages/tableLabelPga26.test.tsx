import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HomePage from "./HomePage";
import CartPage from "./CartPage";
import CheckoutPage from "./CheckoutPage";
import { useCartStore } from "../store/useCartStore";
import type { CartItem } from "../types";

afterEach(cleanup);

vi.mock("../hooks/useTableLabel", () => ({
  useTableLabel: () => ({ label: "K3-4", loading: false, error: null }),
}));

vi.mock("../hooks/useStoreConfig", () => ({
  useStoreConfig: () => ({
    config: { storeName: "Seturan", storeIsOpen: true, status: "ok" },
    loading: false,
    error: null,
    refetch: () => {},
  }),
}));

vi.mock("../hooks/useProducts", () => ({
  useProducts: () => ({
    products: [],
    categories: [],
    loading: false,
    error: null,
    refetch: () => {},
  }),
}));

vi.mock("../hooks/useBundles", () => ({
  useBundles: () => ({ bundles: [], loading: false, error: null, refetch: () => {} }),
}));

vi.mock("../hooks/usePromos", () => ({
  usePromos: () => ({ promos: [], loading: false, error: null, refetch: () => {} }),
}));

const cartLine = (): CartItem => ({
  id: "9",
  name: "Americano",
  description: "",
  basePrice: 22000,
  price: 22000,
  image: "",
  category: "Minuman",
  quantity: 1,
  totalPrice: 22000,
});

function renderPage(path: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path.split("?")[0]} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useCartStore.setState({ storeId: "4", items: [cartLine()] });
});

describe("PGA-26 — BISA shows the table name, never the raw table id", () => {
  test("menu header renders the resolved table name", async () => {
    renderPage("/?table=10&store=4&session=s", <HomePage />);
    expect(await screen.findByText("Meja K3-4")).toBeInTheDocument();
    expect(screen.queryByText("Meja 10")).not.toBeInTheDocument();
  });

  test("cart header renders the resolved table name", async () => {
    renderPage("/cart?table=10&store=4&session=s", <CartPage />);
    expect(await screen.findByText("Meja K3-4", undefined, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByText("Meja 10")).not.toBeInTheDocument();
  });

  test("checkout renders the resolved table name", () => {
    renderPage("/checkout?table=10&store=4&session=s", <CheckoutPage />);
    expect(screen.getByText("Meja K3-4")).toBeInTheDocument();
    expect(screen.queryByText("Meja 10")).not.toBeInTheDocument();
  });
});

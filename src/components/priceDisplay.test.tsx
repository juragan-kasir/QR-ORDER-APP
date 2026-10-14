import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MenuCard from "./MenuCard";
import ProductQuickPreview from "./ProductQuickPreview";
import type { Product } from "../types";

afterEach(cleanup);

// NOTE: jsdom/Node formats with en-US grouping ("20,000"); production
// browsers in Indonesia render "20.000". Tests assert both forms via regex.

function productLike(overrides: Partial<Product> = {}): Product {
  return {
    id: "1",
    name: "Nasi Goreng",
    description: "Enak",
    price: 20000,
    image: "",
    images: [],
    category: "Makanan",
    rating: 0,
    reviewsCount: 0,
    isBestSeller: false,
    isPromo: false,
    isVegetarian: false,
    estimatedTime: 15,
    stock: 10,
    storeId: "1",
    ingredients: [],
    ...overrides,
  };
}

function renderCard(product: Product) {
  return render(
    <MemoryRouter>
      <MenuCard product={product} />
    </MemoryRouter>,
  );
}

describe("MenuCard — outlet price display (DR-11)", () => {
  test("shows the effective price when the backend resolved one", () => {
    renderCard(productLike({ price: 20000, effectivePrice: 25000 }));
    expect(screen.getByText(/Rp25[.,]000/)).toBeInTheDocument();
  });

  test("shows a zero effective price instead of the catalog price", () => {
    renderCard(productLike({ price: 20000, effectivePrice: 0 }));
    expect(screen.getByText("Rp0")).toBeInTheDocument();
  });

  test("falls back to the catalog price when effective price is null", () => {
    renderCard(productLike({ price: 20000, effectivePrice: null }));
    expect(screen.getByText(/Rp20[.,]000/)).toBeInTheDocument();
  });
});

describe("ProductQuickPreview — outlet price display (DR-11)", () => {
  test("shows the effective price when the backend resolved one", () => {
    render(
      <MemoryRouter>
        <ProductQuickPreview
          product={productLike({ price: 20000, effectivePrice: 25000 })}
          open
          onClose={() => {}}
          onAdd={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Rp25[.,]000/)).toBeInTheDocument();
  });

  test("shows a zero effective price instead of the catalog price", () => {
    render(
      <MemoryRouter>
        <ProductQuickPreview
          product={productLike({ price: 20000, effectivePrice: 0 })}
          open
          onClose={() => {}}
          onAdd={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Rp0")).toBeInTheDocument();
  });

  test("falls back to the catalog price when effective price is null", () => {
    vi.useFakeTimers();
    try {
      render(
        <MemoryRouter>
          <ProductQuickPreview
            product={productLike({ price: 20000, effectivePrice: null })}
            open
            onClose={() => {}}
            onAdd={() => {}}
          />
        </MemoryRouter>,
      );
      expect(screen.getByText(/Rp20[.,]000/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

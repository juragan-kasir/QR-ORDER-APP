import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductDetailPage from "./ProductDetailPage";
import type { Product } from "../types";

afterEach(cleanup);

// jsdom does not implement Element.scrollTo (used by the image carousel).
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

const baseProduct: Product = {
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
};

vi.mock("../hooks/useProduct", () => ({
  useProduct: () => ({ product: baseProduct, loading: false, error: null }),
}));

vi.mock("../services/reviewService", () => ({
  fetchProductReviews: () =>
    Promise.resolve({ reviews: [], averageRating: 0, totalReviews: 0 }),
}));

function renderPage(product: Product) {
  baseProduct.price = product.price;
  baseProduct.effectivePrice = product.effectivePrice;
  return render(
    <MemoryRouter initialEntries={["/product/1?table=2&store=1&session=s"]}>
      <Routes>
        <Route path="/product/:id" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProductDetailPage — outlet price display (DR-11)", () => {
  test("total starts from the effective price", () => {
    renderPage({ ...baseProduct, price: 20000, effectivePrice: 25000 });
    expect(screen.getByText(/Rp25[.,]000/)).toBeInTheDocument();
  });

  test("a zero effective price is preserved", () => {
    renderPage({ ...baseProduct, price: 20000, effectivePrice: 0 });
    expect(screen.getByText("Rp0")).toBeInTheDocument();
  });
});

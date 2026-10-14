import { describe, expect, test } from "vitest";
import { resolveDisplayPrice } from "./resolveDisplayPrice";
import type { Product } from "../types";

function productLike(overrides: Partial<Product> = {}): Product {
  return {
    id: "1",
    name: "Nasi Goreng",
    description: "",
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

describe("resolveDisplayPrice — outlet effective price", () => {
  test("a non-null effective price overrides the catalog price", () => {
    expect(
      resolveDisplayPrice(productLike({ price: 20000, effectivePrice: 25000 })),
    ).toBe(25000);
  });

  test("effectivePrice 0 is a valid price and stays zero", () => {
    expect(
      resolveDisplayPrice(productLike({ price: 20000, effectivePrice: 0 })),
    ).toBe(0);
  });

  test("effectivePrice null falls back to the catalog price", () => {
    expect(
      resolveDisplayPrice(productLike({ price: 20000, effectivePrice: null })),
    ).toBe(20000);
  });

  test("an absent effectivePrice preserves backward compatibility", () => {
    const { effectivePrice: _dropped, ...legacy } = productLike({
      price: 20000,
    });
    void _dropped;
    expect(resolveDisplayPrice(legacy as Product)).toBe(20000);
  });

  test("does not use truthiness fallback for a zero catalog price", () => {
    expect(resolveDisplayPrice(productLike({ price: 0 }))).toBe(0);
  });
});

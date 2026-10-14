import { describe, expect, test } from "vitest";
import { mapBackendProductToFrontend } from "./productService";

type BackendProductArg = Parameters<typeof mapBackendProductToFrontend>[0];

function backendProductLike(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    nameProduct: "Kopi",
    sku: "KOPI-5",
    image: null,
    images: null,
    barcode: null,
    brand: null,
    category: 1,
    description: null,
    price: 20000,
    costPrice: 10000,
    isOption: false,
    options: [],
    hasModifiers: false,
    modifiers: [],
    stock: 10,
    minStock: 0,
    unit: "pcs",
    baseUnit: "pcs",
    conversionFactor: 1,
    status: "active",
    isAvailable: true,
    point: 0,
    redeemPoints: 0,
    tax: null,
    priceTiers: [],
    currencyId: null,
    currencyCode: null,
    createdBy: null,
    modifiedBy: null,
    tipeProduk: "makanan",
    hppPerPorsi: 0,
    foodCostPersen: 0,
    marginPersen: 0,
    isAvailableHariIni: true,
    composition: [],
    estimationTime: 15,
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
    categoryData: { name: "Minuman" },
    ...overrides,
  } as unknown as BackendProductArg;
}

describe("mapBackendProductToFrontend — effectivePrice (DR-11)", () => {
  test("carries a non-null effective price", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ price: 20000, effectivePrice: 25000 }),
      "1",
    );
    expect(product.price).toBe(20000);
    expect(product.effectivePrice).toBe(25000);
  });

  test("carries effectivePrice 0 without normalizing it away", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ price: 20000, effectivePrice: 0 }),
      "1",
    );
    expect(product.effectivePrice).toBe(0);
  });

  test("maps an explicit null effective price to null", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ price: 20000, effectivePrice: null }),
      "1",
    );
    expect(product.effectivePrice).toBeNull();
  });

  test("an absent effective price stays backward compatible", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ price: 20000 }),
      "1",
    );
    expect(product.effectivePrice).toBeNull();
    expect(product.price).toBe(20000);
  });

  test("does not mutate the backend response object", () => {
    const raw = backendProductLike({ price: 20000, effectivePrice: 25000 });
    const snapshot = { ...raw };
    mapBackendProductToFrontend(raw, "1");
    expect(raw).toEqual(snapshot);
  });
});

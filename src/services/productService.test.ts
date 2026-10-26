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

describe("mapBackendProductToFrontend — make_to_order availability", () => {
  test("a recipe (make_to_order) dish with zero product stock stays orderable", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ inventoryMode: "make_to_order", stock: 0, effectiveStock: 0 }),
      "1",
    );
    expect(product.stock).toBeGreaterThan(0);
    expect(product.madeToOrder).toBe(true);
  });

  test("a switched-off make_to_order dish is still unavailable", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ inventoryMode: "make_to_order", stock: 0, isAvailable: false }),
      "1",
    );
    expect(product.stock).toBe(0);
  });

  test("a stocked product keeps the effective per-store stock, including 0", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ inventoryMode: "stocked", stock: 10, effectiveStock: 0 }),
      "1",
    );
    expect(product.stock).toBe(0);
    expect(product.madeToOrder).toBe(false);
  });

  test("a hybrid product is still limited by its effective stock", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ inventoryMode: "hybrid", stock: 10, effectiveStock: 3 }),
      "1",
    );
    expect(product.stock).toBe(3);
  });
});

describe("mapBackendProductToFrontend — recipe portions (BRD BR-05)", () => {
  test("a make_to_order dish offers exactly the portions its ingredients make", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ inventoryMode: "make_to_order", stock: 0, availablePortions: 10 }),
      "1",
    );
    expect(product.stock).toBe(10);
    expect(product.madeToOrder).toBe(true);
  });

  test("a make_to_order dish whose ingredients ran out shows Habis", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ inventoryMode: "make_to_order", stock: 0, availablePortions: 0 }),
      "1",
    );
    expect(product.stock).toBe(0);
  });

  test("a hybrid product is limited by its stock and its portions", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ inventoryMode: "hybrid", stock: 10, effectiveStock: 8, availablePortions: 3 }),
      "1",
    );
    expect(product.stock).toBe(3);
  });

  test("a stocked product ignores a null availablePortions", () => {
    const product = mapBackendProductToFrontend(
      backendProductLike({ inventoryMode: "stocked", stock: 10, effectiveStock: 4, availablePortions: null }),
      "1",
    );
    expect(product.stock).toBe(4);
  });
});

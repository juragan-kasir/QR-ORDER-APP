import { beforeEach, describe, expect, test, vi } from "vitest";
import apiClient from "./apiClient";
import { fetchCustomerMenu } from "./productService";

vi.mock("./apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./apiClient")>();
  return {
    ...actual,
    default: { get: vi.fn(), post: vi.fn() },
  };
});

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

function menuResponse(price: number, effectivePrice: number | null) {
  return {
    data: {
      message: "ok",
      data: {
        products: [
          {
            id: 5,
            nameProduct: "Kopi",
            sku: "KOPI-5",
            image: null,
            images: null,
            barcode: null,
            brand: null,
            category: 1,
            description: null,
            price,
            effectivePrice,
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
            reviews: [],
          },
        ],
        categories: [],
      },
    },
  };
}

describe("fetchCustomerMenu — cache and effective price (DR-11)", () => {
  beforeEach(() => {
    mockedGet.mockClear();
  });
  test("shares one network request per store across callers", async () => {
    mockedGet.mockResolvedValueOnce(menuResponse(20000, 25000));
    const [first, second] = await Promise.all([
      fetchCustomerMenu("store-cache-a"),
      fetchCustomerMenu("store-cache-a"),
    ]);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(first.products).toHaveLength(1);
    expect(second.products[0].id).toBe("5");
  });

  test("the cached product preserves the outlet effective price", async () => {
    mockedGet.mockResolvedValueOnce(menuResponse(20000, 25000));
    const { products } = await fetchCustomerMenu("store-cache-b");
    expect(products[0].price).toBe(20000);
    expect(products[0].effectivePrice).toBe(25000);
  });

  test("a failed request is evicted so the next call retries", async () => {
    mockedGet.mockRejectedValueOnce(new Error("down"));
    await expect(fetchCustomerMenu("store-cache-c")).rejects.toThrow();
    mockedGet.mockResolvedValueOnce(menuResponse(20000, null));
    const { products } = await fetchCustomerMenu("store-cache-c");
    expect(products[0].effectivePrice).toBeNull();
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });
});

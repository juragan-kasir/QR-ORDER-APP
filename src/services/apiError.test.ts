import { describe, expect, test, vi } from "vitest";
import apiClient, { ApiError, toApiError } from "./apiClient";
import { createCustomerOrder } from "./orderService";

vi.mock("./apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./apiClient")>();
  return {
    ...actual,
    default: {
      post: vi.fn(),
      get: vi.fn(),
    },
  };
});

const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

describe("ApiError — structured backend details (DR-11)", () => {
  test("carries the backend code and response data", () => {
    const err = new ApiError("Harga berubah.", 409, {
      code: "PRICE_CHANGED",
      data: { code: "PRICE_CHANGED", items: [] },
    });
    expect(err.status).toBe(409);
    expect(err.code).toBe("PRICE_CHANGED");
    expect(err.data).toEqual({ code: "PRICE_CHANGED", items: [] });
  });

  test("code and data default to undefined for legacy errors", () => {
    const err = new ApiError("Gagal.", 0);
    expect(err.code).toBeUndefined();
    expect(err.data).toBeUndefined();
  });
});

describe("toApiError — 409 PRICE_CHANGED mapping", () => {
  test("preserves status, backend code, and the items array", () => {
    const err = toApiError({
      response: {
        status: 409,
        data: {
          code: "PRICE_CHANGED",
          message: "One or more item prices changed.",
          items: [
            { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
          ],
        },
      },
    });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("PRICE_CHANGED");
    expect(err.data).toEqual({
      code: "PRICE_CHANGED",
      message: "One or more item prices changed.",
      items: [
        { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
      ],
    });
  });

  test("other statuses keep existing message behavior with undefined code", () => {
    const err = toApiError({ response: { status: 500, data: {} } });
    expect(err.status).toBe(500);
    expect(err.code).toBeUndefined();
    expect(err.message).toBe("Terjadi kesalahan pada server. Coba lagi nanti.");
  });

  test("network failures without a response stay status 0", () => {
    const err = toApiError({ code: "ECONNABORTED" });
    expect(err.status).toBe(0);
    expect(err.data).toBeUndefined();
  });
});

describe("createCustomerOrder — error passthrough (DR-11)", () => {
  test("a 409 PRICE_CHANGED ApiError reaches the caller intact", async () => {
    const backendError = new ApiError("Harga berubah.", 409, {
      code: "PRICE_CHANGED",
      data: {
        code: "PRICE_CHANGED",
        items: [
          { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
        ],
      },
    });
    mockedPost.mockRejectedValueOnce(backendError);
    await expect(
      createCustomerOrder({
        store: 1,
        items: [{ productId: 5, productName: "Kopi", quantity: 1, price: 20000 }],
      }),
    ).rejects.toBe(backendError);
  });
});

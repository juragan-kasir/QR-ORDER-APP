import { beforeEach, describe, expect, test, vi } from "vitest";
import apiClient, { ApiError } from "./apiClient";
import { fetchStoreConfig } from "./storeService";

vi.mock("./apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./apiClient")>();
  return {
    ...actual,
    default: { get: vi.fn(), post: vi.fn() },
  };
});

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

// DR-17: the backend quote endpoint resolves store-or-global PPN once and
// returns a single effective rate — the frontend must not pick rows itself.
function quoteResponse(rate: unknown, serviceChargeRate: unknown) {
  return { data: { message: "ok", data: { rate, serviceChargeRate } } };
}

function locationResponse(storeNum: number, name: string) {
  return {
    data: {
      message: "ok",
      data: [
        {
          store: storeNum,
          id: storeNum,
          name,
          city: "",
          province: "",
          detailLocation: "",
          latitude: null,
          longitude: null,
          status: "active",
        },
      ],
    },
  };
}

// The location lookup matches on the numeric store id, so each test serves
// a location row for its own store id.
function mockQuote(
  rate: unknown,
  serviceChargeRate: unknown,
  storeNum: number,
  name = "Toko",
) {
  mockedGet.mockImplementation((url: string) => {
    if (url === "/order/customer-tax-rate") {
      return Promise.resolve(quoteResponse(rate, serviceChargeRate));
    }
    return Promise.resolve(locationResponse(storeNum, name));
  });
}

function quoteCalls() {
  return mockedGet.mock.calls.filter(([url]) => url === "/order/customer-tax-rate");
}

function legacyCalls() {
  return mockedGet.mock.calls.filter(([url]) => url === "/tax-config/public");
}

beforeEach(() => {
  mockedGet.mockReset();
});

describe("fetchStoreConfig — QR tax quote (DR-17)", () => {
  test("uses the backend quote rate with channel=qr, never store tax rows", async () => {
    mockQuote(11, null, 81);
    const config = await fetchStoreConfig("81");
    expect(config.status).toBe("ok");
    expect(config.taxRate).toBeCloseTo(0.11, 10);
    expect(legacyCalls()).toHaveLength(0);
    expect(quoteCalls()).toHaveLength(1);
    expect(quoteCalls()[0][1]).toMatchObject({
      params: { store: "81", channel: "qr" },
    });
  });

  test("accepts an explicitly configured zero rate as valid", async () => {
    mockQuote(0, null, 82);
    const config = await fetchStoreConfig("82");
    expect(config.status).toBe("ok");
    expect(config.taxRate).toBe(0);
  });

  test("maps a missing-PPN 400 to a setup error, never a zero-tax ok", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(
          new ApiError("PPN tax configuration is missing", 400),
        );
      }
      return Promise.resolve(locationResponse(83, "Toko"));
    });
    const config = await fetchStoreConfig("83");
    expect(config.status).toBe("missing");
  });

  test("400 with PPN_MISSING code is classified as missing", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(
          new ApiError("PPN tax configuration is missing", 400, {
            code: "PPN_MISSING",
          }),
        );
      }
      return Promise.resolve(locationResponse(90, "Toko"));
    });
    const config = await fetchStoreConfig("90");
    expect(config.status).toBe("missing");
  });

  test("400 with INVALID_STORE code is not classified as missing", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(
          new ApiError("Invalid store value", 400, {
            code: "INVALID_STORE",
          }),
        );
      }
      return Promise.resolve(locationResponse(91, "Toko"));
    });
    const config = await fetchStoreConfig("91");
    expect(config.status).toBe("error");
  });

  test("400 with INVALID_CHANNEL code is not classified as missing", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(
          new ApiError("channel must be counter or qr", 400, {
            code: "INVALID_CHANNEL",
          }),
        );
      }
      return Promise.resolve(locationResponse(92, "Toko"));
    });
    const config = await fetchStoreConfig("92");
    expect(config.status).toBe("error");
  });

  test("400 with an unknown code is not classified as missing", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(
          new ApiError("Something else", 400, { code: "SOME_FUTURE_CODE" }),
        );
      }
      return Promise.resolve(locationResponse(93, "Toko"));
    });
    const config = await fetchStoreConfig("93");
    expect(config.status).toBe("error");
  });

  test("maps network failure and server errors to error, never zero-tax ok", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(new ApiError("Tidak dapat terhubung", 0));
      }
      return Promise.resolve(locationResponse(84, "Toko"));
    });
    await expect(fetchStoreConfig("84")).resolves.toMatchObject({
      status: "error",
    });

    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(new ApiError("Internal Server Error", 500));
      }
      return Promise.resolve(locationResponse(85, "Toko"));
    });
    await expect(fetchStoreConfig("85")).resolves.toMatchObject({
      status: "error",
    });
  });

  test("maps malformed quote responses to error", async () => {
    for (const [label, body] of [
      ["missing data", { data: { message: "ok" } }],
      ["null data", { data: { message: "ok", data: null } }],
      ["string rate", quoteResponse("11", null)],
      ["negative rate", quoteResponse(-5, null)],
    ] as const) {
      mockedGet.mockImplementation((url: string) => {
        if (url === "/order/customer-tax-rate") {
          return Promise.resolve(body);
        }
        return Promise.resolve(locationResponse(94, "Toko"));
      });
      await expect(fetchStoreConfig(`94-${label}`)).resolves.toMatchObject({
        status: "error",
      });
    }
  });

  test("distinguishes service-charge null, zero, and unexpected values", async () => {
    mockQuote(11, null, 87);
    await expect(fetchStoreConfig("87")).resolves.toMatchObject({
      status: "ok",
      serviceChargeRate: null,
    });

    mockQuote(11, 0, 88);
    await expect(fetchStoreConfig("88")).resolves.toMatchObject({
      status: "ok",
      serviceChargeRate: 0,
    });

    // A nonzero QR service charge contradicts the documented contract
    // (the backend never charges it on QR orders) — fail safe, never
    // silently adopt a new fee.
    mockQuote(11, 5, 89);
    await expect(fetchStoreConfig("89")).resolves.toMatchObject({
      status: "error",
    });
  });

  test("a failed quote is retried fresh instead of reusing the failure", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(new ApiError("boom", 500));
      }
      return Promise.resolve(locationResponse(90, "Toko"));
    });
    await expect(fetchStoreConfig("90")).resolves.toMatchObject({
      status: "error",
    });
    expect(quoteCalls()).toHaveLength(1);

    mockQuote(11, null, 90);
    await expect(fetchStoreConfig("90")).resolves.toMatchObject({
      status: "ok",
      taxRate: expect.closeTo(0.11, 10),
    });
    expect(quoteCalls()).toHaveLength(2);
  });

  test("concurrent callers share a single underlying quote request", async () => {
    const resolvers: Array<(v: unknown) => void> = [];
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return new Promise((resolve) => {
          resolvers.push(resolve);
        });
      }
      return Promise.resolve(locationResponse(91, "Toko"));
    });
    const first = fetchStoreConfig("91");
    const second = fetchStoreConfig("91");
    expect(quoteCalls()).toHaveLength(1);
    resolvers.forEach((resolve) => resolve(quoteResponse(11, null)));
    await expect(first).resolves.toMatchObject({ status: "ok" });
    await expect(second).resolves.toMatchObject({ status: "ok" });
    expect(quoteCalls()).toHaveLength(1);
  });

  test("store name still resolves when the quote fails, and vice versa", async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.reject(new ApiError("boom", 500));
      }
      return Promise.resolve(locationResponse(92, "Toko A"));
    });
    await expect(fetchStoreConfig("92")).resolves.toMatchObject({
      status: "error",
      storeName: "Toko A",
    });

    mockedGet.mockImplementation((url: string) => {
      if (url === "/order/customer-tax-rate") {
        return Promise.resolve(quoteResponse(11, null));
      }
      return Promise.reject(new ApiError("boom", 500));
    });
    await expect(fetchStoreConfig("93")).resolves.toMatchObject({
      status: "ok",
      storeName: "",
    });
  });
});

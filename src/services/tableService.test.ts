import { afterEach, describe, expect, test, vi } from "vitest";
import apiClient from "./apiClient";
import { fetchTableLabel } from "./tableService";

vi.mock("./apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./apiClient")>();
  return { ...actual, default: { get: vi.fn() } };
});

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

afterEach(() => mockedGet.mockReset());

describe("fetchTableLabel", () => {
  test("asks the store-scoped public table endpoint and returns the human name", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { success: true, data: { id: 10, name: "K3-4" } },
    });

    await expect(fetchTableLabel("4", "10")).resolves.toBe("K3-4");
    expect(mockedGet).toHaveBeenCalledWith("/order/customer-table", {
      params: { store: "4", tableId: "10" },
    });
  });

  test("refuses a response without a usable name instead of displaying an id", async () => {
    mockedGet.mockResolvedValueOnce({ data: { success: true, data: { id: 10 } } });
    await expect(fetchTableLabel("4", "10")).rejects.toThrow(/meja/i);
  });
});

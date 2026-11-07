import { afterEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTableLabel } from "./useTableLabel";
import { fetchTableLabel } from "../services/tableService";

vi.mock("../services/tableService", () => ({ fetchTableLabel: vi.fn() }));

const mockedFetch = fetchTableLabel as unknown as ReturnType<typeof vi.fn>;

afterEach(() => mockedFetch.mockReset());

describe("useTableLabel", () => {
  test("resolves the store-scoped table name", async () => {
    mockedFetch.mockResolvedValueOnce("K3-4");
    const { result } = renderHook(() => useTableLabel("4", "10"));
    await waitFor(() => expect(result.current.label).toBe("K3-4"));
    expect(mockedFetch).toHaveBeenCalledWith("4", "10");
  });

  test("keeps the fallback id only after the lookup fails", async () => {
    mockedFetch.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTableLabel("4", "10"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.label).toBeNull();
    expect(result.current.error).toMatch(/offline/i);
  });
});

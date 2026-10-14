import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import apiClient from "../services/apiClient";
import { useStoreConfig } from "./useStoreConfig";

vi.mock("../services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/apiClient")>();
  return {
    ...actual,
    default: { get: vi.fn(), post: vi.fn() },
  };
});

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  mockedGet.mockReset();
});

function Harness({ storeId }: { storeId: string | null }) {
  const { config, loading, error, refetch } = useStoreConfig(storeId);
  return (
    <div>
      <span data-testid="status">{config.status}</span>
      <span data-testid="tax">{config.taxRate}</span>
      <span data-testid="loading">{loading ? "yes" : "no"}</span>
      <span data-testid="error">{error ?? "none"}</span>
      <button type="button" onClick={refetch}>
        retry-tax
      </button>
    </div>
  );
}

describe("useStoreConfig — stale response safety (DR-17)", () => {
  test("a late response for a previous store cannot overwrite the current quote", async () => {
    const resolvers = new Map<string, (v: unknown) => void>();
    mockedGet.mockImplementation((url: string, opts?: { params?: { store?: string } }) => {
      if (url === "/order/customer-tax-rate") {
        const store = opts?.params?.store ?? "";
        return new Promise((resolve) => {
          resolvers.set(store, resolve);
        });
      }
      return Promise.resolve({ data: { message: "ok", data: [] } });
    });

    const { rerender } = render(<Harness storeId="h1" />);
    rerender(<Harness storeId="h2" />);

    // The current store resolves first with 11%.
    resolvers.get("h2")?.({
      data: { message: "ok", data: { rate: 11, serviceChargeRate: null } },
    });
    await screen.findByText("ok");
    expect(screen.getByTestId("tax").textContent).toBe("0.11");

    // The stale store resolves late with 5% — it must be ignored.
    resolvers.get("h1")?.({
      data: { message: "ok", data: { rate: 5, serviceChargeRate: null } },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId("status").textContent).toBe("ok");
    expect(screen.getByTestId("tax").textContent).toBe("0.11");
  });
});

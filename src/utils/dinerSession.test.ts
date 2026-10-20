import { beforeEach, describe, expect, test, vi } from "vitest";
import { getDinerSession } from "./dinerSession";

// D-10: the diner's own order list is keyed by a per-device token.

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("getDinerSession", () => {
  test("creates a backend-valid token once and reuses it for that store", () => {
    const first = getDinerSession("1");
    expect(first).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(getDinerSession("1")).toBe(first);
    expect(localStorage.getItem("bisamakan-diner-session:1")).toBe(first);
  });

  test("each store gets its own token", () => {
    expect(getDinerSession("1")).not.toBe(getDinerSession("2"));
  });

  test("no store → no session", () => {
    expect(getDinerSession(null)).toBeUndefined();
    expect(getDinerSession("")).toBeUndefined();
  });

  test("a corrupted stored value is replaced, never sent", () => {
    localStorage.setItem("bisamakan-diner-session:1", "x y");
    const token = getDinerSession("1");
    expect(token).not.toBe("x y");
    expect(token).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  });

  test("blocked storage still yields one stable token for this page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const a = getDinerSession("9");
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(getDinerSession("9")).toBe(a);
  });
});

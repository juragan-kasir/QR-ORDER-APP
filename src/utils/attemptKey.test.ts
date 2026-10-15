import { afterEach, describe, expect, test, beforeEach, vi } from "vitest";
import {
  cartSignature,
  getAttemptKey,
  clearAttemptKey,
} from "./attemptKey";

// DR-23 K: the idempotency key must survive a reload for the same logical
// attempt, and change when the cart changes. Scenarios 4 (success cleanup)
// and 5 (failure retention) are decided by the caller and are covered at the
// checkout boundary in src/pages/paymentAttemptKey.test.tsx.

const PREFIX = "bisa-makan-attempt-key:";
const line = { id: "9", quantity: 2, customizationKey: '{"size":"Large"}' };

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("cartSignature", () => {
  // Scenario 8 — deterministic signature.
  test("is deterministic for the same cart and context", () => {
    expect(cartSignature([line], "7", "3")).toBe(
      cartSignature([line], "7", "3"),
    );
  });

  test("is order-independent for identical lines", () => {
    const a = [
      { id: "1", quantity: 1, customizationKey: "x" },
      { id: "2", quantity: 1, customizationKey: "y" },
    ];
    const b = [...a].reverse();
    expect(cartSignature(a, "7", "3")).toBe(cartSignature(b, "7", "3"));
  });

  test("equal carts built as separate objects give the same signature", () => {
    const rebuilt = JSON.parse(JSON.stringify([line])) as (typeof line)[];
    expect(cartSignature(rebuilt, "7", "3")).toBe(cartSignature([line], "7", "3"));
  });

  test("a missing store/table and an empty one are the same context", () => {
    expect(cartSignature([line], null, null)).toBe(cartSignature([line], "", ""));
  });

  // Scenario 9 — every order-defining field the checkout contract feeds in
  // (PaymentPage: product id, quantity, customization, store, table)
  // invalidates reuse. Unit price is deliberately not an input (a confirmed
  // PRICE_CHANGED resubmits under the same key; see attemptKey.ts).
  test("changes when lines, customization, store, or table change", () => {
    const base = cartSignature([line], "7", "3");
    expect(cartSignature([{ ...line, quantity: 3 }], "7", "3")).not.toBe(base);
    expect(
      cartSignature([{ ...line, customizationKey: '{"size":"Small"}' }], "7", "3"),
    ).not.toBe(base);
    expect(cartSignature([line], "8", "3")).not.toBe(base);
    expect(cartSignature([line], "7", "4")).not.toBe(base);
  });

  test("changes when a product is replaced, added or removed", () => {
    const base = cartSignature([line], "7", "3");
    expect(cartSignature([{ ...line, id: "10" }], "7", "3")).not.toBe(base);
    const extra = { id: "4", quantity: 1, customizationKey: "null" };
    expect(cartSignature([line, extra], "7", "3")).not.toBe(base);
    expect(cartSignature([line, extra], "7", "3")).not.toBe(
      cartSignature([extra], "7", "3"),
    );
    expect(cartSignature([], "7", "3")).not.toBe(base);
  });

  test("two identical lines are not the same cart as one", () => {
    expect(cartSignature([line, line], "7", "3")).not.toBe(
      cartSignature([line], "7", "3"),
    );
  });
});

describe("getAttemptKey / clearAttemptKey", () => {
  // Scenario 1 — same cart signature reuses the key.
  test("reuses the persisted key for the same signature", () => {
    const first = getAttemptKey("sig-A");
    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
    expect(getAttemptKey("sig-A")).toBe(first);
  });

  test("the same cart, recomputed, reuses the same key", () => {
    const first = getAttemptKey(cartSignature([line], "7", "3"));
    const again = getAttemptKey(cartSignature([{ ...line }], "7", "3"));
    expect(again).toBe(first);
  });

  // Scenario 3 — a materially different cart gets a different key.
  test("mints distinct keys per signature", () => {
    expect(getAttemptKey("sig-A")).not.toBe(getAttemptKey("sig-B"));
  });

  test("a materially different cart gets a different key", () => {
    const first = getAttemptKey(cartSignature([line], "7", "3"));
    const other = getAttemptKey(cartSignature([{ ...line, quantity: 5 }], "7", "3"));
    expect(other).not.toBe(first);
  });

  test("mints a fresh key after clear", () => {
    const first = getAttemptKey("sig-A");
    clearAttemptKey("sig-A");
    expect(getAttemptKey("sig-A")).not.toBe(first);
  });

  // Scenario 2 — reload persistence: a fresh module instance (as after a
  // page reload) reads the key back from sessionStorage.
  test("the key survives a reload of the module (sessionStorage-backed)", async () => {
    const signature = cartSignature([line], "7", "3");
    const before = getAttemptKey(signature);
    expect(sessionStorage.getItem(`${PREFIX}${signature}`)).toBe(before);

    vi.resetModules();
    const reloaded = await import("./attemptKey");
    expect(reloaded.cartSignature([line], "7", "3")).toBe(signature);
    expect(reloaded.getAttemptKey(signature)).toBe(before);
  });

  // Scenario 7 — isolation.
  test("clearing one attempt leaves another cart's/store's attempt and unrelated storage", () => {
    const sigTable3 = cartSignature([line], "7", "3");
    const sigOtherStore = cartSignature([line], "8", "3");
    const keep = getAttemptKey(sigOtherStore);
    getAttemptKey(sigTable3);
    sessionStorage.setItem("unrelated", "value");

    clearAttemptKey(sigTable3);

    expect(sessionStorage.getItem(`${PREFIX}${sigTable3}`)).toBeNull();
    expect(getAttemptKey(sigOtherStore)).toBe(keep);
    expect(sessionStorage.getItem("unrelated")).toBe("value");
  });

  test("clearing an attempt that was never stored is a no-op", () => {
    const keep = getAttemptKey("sig-A");
    expect(() => clearAttemptKey("sig-never")).not.toThrow();
    expect(getAttemptKey("sig-A")).toBe(keep);
  });
});

// Scenario 6 — storage unavailable or throwing: the checkout must still get
// a usable key (ephemeral, not persisted), and cleanup never throws.
describe("storage fallback", () => {
  test("a throwing getItem yields a usable ephemeral key per call", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const a = getAttemptKey("sig-A");
    const b = getAttemptKey("sig-A");
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    // nothing could be read back, so nothing is reused
    expect(b).not.toBe(a);
  });

  test("a throwing setItem (quota) still returns a key and persists nothing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const key = getAttemptKey("sig-A");
    expect(key.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
    expect(sessionStorage.getItem(`${PREFIX}sig-A`)).toBeNull();
  });

  test("no sessionStorage at all (SSR / blocked) still returns a key", () => {
    vi.stubGlobal("sessionStorage", undefined);
    const a = getAttemptKey("sig-A");
    expect(a.length).toBeGreaterThan(0);
    expect(getAttemptKey("sig-A")).not.toBe(a);
    expect(() => clearAttemptKey("sig-A")).not.toThrow();
  });

  test("a throwing removeItem does not break cleanup", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearAttemptKey("sig-A")).not.toThrow();
  });

  test("without randomUUID the key comes from getRandomValues", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(171));
    vi.stubGlobal("crypto", { getRandomValues });
    const key = getAttemptKey("sig-A");
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(key).toBe("ab".repeat(16));
  });

  test("without WebCrypto the fallback keys are still distinct", () => {
    vi.stubGlobal("crypto", undefined);
    vi.stubGlobal("sessionStorage", undefined);
    const a = getAttemptKey("sig-A");
    const b = getAttemptKey("sig-A");
    expect(a).toMatch(/^fallback-/);
    expect(b).not.toBe(a);
  });
});

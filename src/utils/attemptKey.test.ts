import { describe, expect, test, beforeEach } from "vitest";
import {
  cartSignature,
  getAttemptKey,
  clearAttemptKey,
} from "./attemptKey";

// DR-23 K: the idempotency key must survive a reload for the same logical
// attempt, and change when the cart changes.

const line = { id: "9", quantity: 2, customizationKey: '{"size":"Large"}' };

beforeEach(() => {
  sessionStorage.clear();
});

describe("cartSignature", () => {
  test("is deterministic for the same cart and context", () => {
    expect(cartSignature([line], "7", "3")).toBe(
      cartSignature([line], "7", "3"),
    );
  });

  test("changes when lines, customization, store, or table change", () => {
    const base = cartSignature([line], "7", "3");
    expect(cartSignature([{ ...line, quantity: 3 }], "7", "3")).not.toBe(base);
    expect(
      cartSignature([{ ...line, customizationKey: '{"size":"Small"}' }], "7", "3"),
    ).not.toBe(base);
    expect(cartSignature([line], "8", "3")).not.toBe(base);
    expect(cartSignature([line], "7", "4")).not.toBe(base);
  });

  test("is order-independent for identical lines", () => {
    const a = [
      { id: "1", quantity: 1, customizationKey: "x" },
      { id: "2", quantity: 1, customizationKey: "y" },
    ];
    const b = [...a].reverse();
    expect(cartSignature(a, "7", "3")).toBe(cartSignature(b, "7", "3"));
  });
});

describe("getAttemptKey / clearAttemptKey", () => {
  test("reuses the persisted key for the same signature", () => {
    const first = getAttemptKey("sig-A");
    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
    expect(getAttemptKey("sig-A")).toBe(first);
  });

  test("mints distinct keys per signature", () => {
    expect(getAttemptKey("sig-A")).not.toBe(getAttemptKey("sig-B"));
  });

  test("mints a fresh key after clear", () => {
    const first = getAttemptKey("sig-A");
    clearAttemptKey("sig-A");
    expect(getAttemptKey("sig-A")).not.toBe(first);
  });
});

import { describe, expect, test } from "vitest";
import { orderListLabel } from "./orderNumber";

describe("orderListLabel", () => {
  test("daily-counter numbers show the sequence, distinct per order", () => {
    expect(orderListLabel("ORD-12-261119-0001", "1")).toBe("0001");
    expect(orderListLabel("ORD-12-261119-0002", "2")).toBe("0002");
  });

  test("legacy numbers keep the first 10 characters, upper-cased", () => {
    expect(orderListLabel("26111904ab3f", "9")).toBe("26111904AB");
  });

  test("falls back to the id when there is no number", () => {
    expect(orderListLabel(undefined, "abcdef0123456789")).toBe("ABCDEF0123");
  });
});

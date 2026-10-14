import { describe, expect, test } from "vitest";
import {
  isSnapshotCurrent,
  matchChangedLines,
  parsePriceChangedData,
  snapshotCartLines,
  type SubmittedLine,
} from "./priceChange";
import type { CartItem } from "../types";

function cartLine(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "5",
    name: "Kopi",
    description: "",
    basePrice: 20000,
    price: 20000,
    image: "",
    category: "Minuman",
    quantity: 2,
    totalPrice: 40000,
    ...overrides,
  };
}

describe("parsePriceChangedData — defensive 409 parsing", () => {
  test("accepts a well-formed items array", () => {
    expect(
      parsePriceChangedData({
        code: "PRICE_CHANGED",
        items: [
          { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
          { index: 1, bundleId: 7, expectedPrice: 50000, currentPrice: 52000 },
        ],
      }),
    ).toEqual([
      { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
      { index: 1, bundleId: 7, expectedPrice: 50000, currentPrice: 52000 },
    ]);
  });

  test("rejects a missing items array", () => {
    expect(parsePriceChangedData({ code: "PRICE_CHANGED" })).toBeNull();
  });

  test("rejects non-object and null payloads", () => {
    expect(parsePriceChangedData(null)).toBeNull();
    expect(parsePriceChangedData("PRICE_CHANGED")).toBeNull();
    expect(parsePriceChangedData(undefined)).toBeNull();
  });

  test("drops malformed entries but keeps valid ones", () => {
    expect(
      parsePriceChangedData({
        items: [
          { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
          { index: "zero", productId: 5, expectedPrice: 1, currentPrice: 2 },
          { productId: 5, expectedPrice: 1, currentPrice: 2 },
          null,
        ],
      }),
    ).toEqual([
      { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
    ]);
  });

  test("returns null when no entry survives validation", () => {
    expect(parsePriceChangedData({ items: [{ nope: true }] })).toBeNull();
  });

  test("rejects negative and fractional prices", () => {
    expect(
      parsePriceChangedData({
        items: [{ index: 0, productId: 5, expectedPrice: -1, currentPrice: 2.5 }],
      }),
    ).toBeNull();
  });
});

describe("snapshotCartLines / isSnapshotCurrent — staleness guard", () => {
  test("an untouched cart matches its snapshot", () => {
    const items = [cartLine(), cartLine({ id: "9", name: "Teh" })];
    expect(isSnapshotCurrent(items, snapshotCartLines(items))).toBe(true);
  });

  test("a quantity change invalidates the snapshot", () => {
    const items = [cartLine()];
    const snapshot = snapshotCartLines(items);
    expect(
      isSnapshotCurrent([{ ...items[0], quantity: 3 }], snapshot),
    ).toBe(false);
  });

  test("a price change invalidates the snapshot", () => {
    const items = [cartLine()];
    const snapshot = snapshotCartLines(items);
    expect(
      isSnapshotCurrent(
        [{ ...items[0], price: 25000, totalPrice: 50000 }],
        snapshot,
      ),
    ).toBe(false);
  });

  test("adding or removing a line invalidates the snapshot", () => {
    const items = [cartLine()];
    const snapshot = snapshotCartLines(items);
    expect(isSnapshotCurrent([...items, cartLine({ id: "9" })], snapshot)).toBe(
      false,
    );
    expect(isSnapshotCurrent([], snapshot)).toBe(false);
  });

  test("a customization change invalidates the snapshot", () => {
    const items = [cartLine()];
    const snapshot = snapshotCartLines(items);
    expect(
      isSnapshotCurrent(
        [{ ...items[0], customization: { notes: "es teh" } }],
        snapshot,
      ),
    ).toBe(false);
  });
});

describe("matchChangedLines — backend index to cart line", () => {
  const submitted: SubmittedLine[] = [
    { key: "5", name: "Kopi", unitPrice: 20000, quantity: 2, productId: 5 },
    { key: "bundle-7", name: "Paket", unitPrice: 50000, quantity: 1, bundleId: 7 },
  ];

  test("maps each mismatch to its submitted line by index", () => {
    expect(
      matchChangedLines(submitted, [
        { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
        { index: 1, bundleId: 7, expectedPrice: 50000, currentPrice: 52000 },
      ]),
    ).toEqual([
      {
        line: submitted[0],
        expectedPrice: 20000,
        currentPrice: 25000,
      },
      {
        line: submitted[1],
        expectedPrice: 50000,
        currentPrice: 52000,
      },
    ]);
  });

  test("verifies product/bundle identity before matching", () => {
    expect(
      matchChangedLines(submitted, [
        { index: 0, productId: 999, expectedPrice: 1, currentPrice: 2 },
      ]),
    ).toEqual([]);
  });

  test("drops out-of-range indexes", () => {
    expect(
      matchChangedLines(submitted, [
        { index: 7, productId: 5, expectedPrice: 1, currentPrice: 2 },
      ]),
    ).toEqual([]);
  });

  test("duplicate indexes resolve deterministically to a single change", () => {
    expect(
      matchChangedLines(submitted, [
        { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 25000 },
        { index: 0, productId: 5, expectedPrice: 20000, currentPrice: 26000 },
      ]),
    ).toEqual([
      {
        line: submitted[0],
        expectedPrice: 20000,
        currentPrice: 25000,
      },
    ]);
  });
});

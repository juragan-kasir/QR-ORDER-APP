import { describe, expect, test } from "vitest";
import { buildOrderItemsPayload } from "./buildOrderItemsPayload";
import type { CartItem } from "../types";

function cartLine(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "5",
    name: "Kopi",
    description: "",
    basePrice: 25000,
    price: 25000,
    image: "",
    category: "Minuman",
    quantity: 1,
    totalPrice: 25000,
    ...overrides,
  };
}

describe("buildOrderItemsPayload — expectedPrice (DR-11)", () => {
  test("a product line echoes its final unit price as expectedPrice", () => {
    const [line] = buildOrderItemsPayload([
      cartLine({ price: 25000, quantity: 2, totalPrice: 50000 }),
    ]);
    expect(line.expectedPrice).toBe(25000);
  });

  test("customization markups are reflected exactly once, not multiplied by quantity", () => {
    const [line] = buildOrderItemsPayload([
      cartLine({
        basePrice: 25000,
        price: 33000,
        quantity: 3,
        totalPrice: 99000,
        customization: {
          addOns: [{ id: "11", name: "Telur", price: 5000 }],
          selectedOptions: [
            {
              groupId: "g1",
              groupName: "Ukuran",
              choiceName: "Large",
              price: 3000,
            },
          ],
        },
      }),
    ]);
    expect(line.expectedPrice).toBe(33000);
    // Existing serialization preserved.
    expect(line.options).toEqual([
      { name: "Ukuran - Large", value: "Large" },
    ]);
    expect(line.modifiers).toEqual([
      { id: 11, name: "Telur", price: 5000 },
    ]);
  });

  test("a bundle line echoes bundlePrice with bundle identity", () => {
    const [line] = buildOrderItemsPayload([
      cartLine({
        id: "bundle-7",
        name: "Paket Hemat",
        price: 50000,
        basePrice: 50000,
        totalPrice: 100000,
        quantity: 2,
        bundleId: "7",
        bundleItems: [{ name: "Ayam", quantity: 1 }],
      }),
    ]);
    expect(line.bundleId).toBe(7);
    expect(line.productId).toBeUndefined();
    expect(line.expectedPrice).toBe(50000);
  });

  test("line ordering and existing fields are preserved", () => {
    const lines = buildOrderItemsPayload([
      cartLine({ id: "5", name: "Kopi", price: 25000 }),
      cartLine({
        id: "bundle-7",
        name: "Paket",
        price: 50000,
        bundleId: "7",
      }),
      cartLine({ id: "9", name: "Teh", price: 15000, quantity: 2 }),
    ]);
    expect(lines.map((l) => l.productName)).toEqual(["Kopi", "Paket", "Teh"]);
    expect(lines[0]).toMatchObject({
      productId: 5,
      quantity: 1,
      price: 25000,
    });
    expect(lines[2]).toMatchObject({ productId: 9, quantity: 2 });
  });

  test("a legacy persisted line (no effective-price history) echoes its stored unit price", () => {
    const [line] = buildOrderItemsPayload([
      cartLine({ basePrice: 20000, price: 20000 }),
    ]);
    expect(line.expectedPrice).toBe(20000);
  });
});

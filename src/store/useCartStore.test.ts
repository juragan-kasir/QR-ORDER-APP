import { afterEach, describe, expect, test } from "vitest";
import { useCartStore } from "./useCartStore";
import type { Product } from "../types";

afterEach(() => {
  useCartStore.setState({ items: [], storeId: null });
});

function productLike(overrides: Partial<Product> = {}): Product {
  return {
    id: "1",
    name: "Nasi Goreng",
    description: "",
    price: 20000,
    image: "",
    images: [],
    category: "Makanan",
    rating: 0,
    reviewsCount: 0,
    isBestSeller: false,
    isPromo: false,
    isVegetarian: false,
    estimatedTime: 15,
    stock: 10,
    storeId: "1",
    ingredients: [],
    ...overrides,
  };
}

describe("useCartStore — DR-11 outlet base price", () => {
  test("a newly added item stores the resolved effective base price", () => {
    useCartStore
      .getState()
      .addItem(productLike({ price: 20000, effectivePrice: 25000 }));
    const [line] = useCartStore.getState().items;
    expect(line.basePrice).toBe(25000);
    expect(line.price).toBe(25000);
    expect(line.totalPrice).toBe(25000);
  });

  test("a zero effective price is stored, not replaced by catalog price", () => {
    useCartStore
      .getState()
      .addItem(productLike({ price: 20000, effectivePrice: 0 }));
    const [line] = useCartStore.getState().items;
    expect(line.basePrice).toBe(0);
    expect(line.price).toBe(0);
  });

  test("a null effective price keeps the catalog base price", () => {
    useCartStore
      .getState()
      .addItem(productLike({ price: 20000, effectivePrice: null }));
    expect(useCartStore.getState().items[0].basePrice).toBe(20000);
  });

  test("customization markups apply on top of the resolved base", () => {
    useCartStore.getState().addItem(
      productLike({ price: 20000, effectivePrice: 25000 }),
      {
        addOns: [{ id: "a1", name: "Telur", price: 5000 }],
        selectedOptions: [
          {
            groupId: "g1",
            groupName: "Ukuran",
            choiceName: "Large",
            price: 3000,
          },
        ],
      },
    );
    const [line] = useCartStore.getState().items;
    expect(line.price).toBe(33000);
    expect(line.totalPrice).toBe(33000);
  });

  test("updateCustomization recalculates from the stored resolved base", () => {
    useCartStore
      .getState()
      .addItem(productLike({ price: 20000, effectivePrice: 25000 }));
    useCartStore.getState().updateCustomization("1", {
      addOns: [{ id: "a1", name: "Telur", price: 5000 }],
    });
    const [line] = useCartStore.getState().items;
    expect(line.price).toBe(30000);
    expect(line.totalPrice).toBe(30000);
  });

  test("quantity scales the line total but not the stored unit price", () => {
    useCartStore
      .getState()
      .addItem(productLike({ price: 20000, effectivePrice: 25000 }));
    useCartStore.getState().updateQuantity("1", 3);
    const [line] = useCartStore.getState().items;
    expect(line.price).toBe(25000);
    expect(line.totalPrice).toBe(75000);
  });

  test("bundle lines keep the bundle price untouched", () => {
    useCartStore.getState().addItem(
      productLike({
        id: "bundle-7",
        price: 50000,
        bundleId: "7",
        bundleItems: [{ name: "Ayam", quantity: 1 }],
      }),
    );
    const [line] = useCartStore.getState().items;
    expect(line.basePrice).toBe(50000);
    expect(line.price).toBe(50000);
    expect(line.bundleId).toBe("7");
  });
});

describe("useCartStore.applyServerPrices — DR-11 confirmed prices", () => {
  test("updates unit price and line total from accepted server prices", () => {
    useCartStore.getState().addItem(productLike({ id: "5", price: 20000 }));
    useCartStore.getState().addItem(productLike({ id: "9", price: 15000 }));
    useCartStore.getState().updateQuantity("5", 2);
    useCartStore.getState().applyServerPrices([{ index: 0, price: 25000 }]);
    const lines = useCartStore.getState().items;
    expect(lines[0].price).toBe(25000);
    expect(lines[0].totalPrice).toBe(50000);
    expect(lines[1].price).toBe(15000);
  });

  test("out-of-range positions are ignored", () => {
    useCartStore.getState().addItem(productLike({ id: "5", price: 20000 }));
    useCartStore.getState().applyServerPrices([{ index: 7, price: 1 }]);
    expect(useCartStore.getState().items[0].price).toBe(20000);
  });
});

describe("useCartStore — confirmed price basis survives customization edits (P2)", () => {
  test("confirm 27k then change markup 5k→8k yields unit 30k and matching expectedPrice", async () => {
    const { buildOrderItemsPayload } =
      await import("../utils/buildOrderItemsPayload");
    useCartStore.getState().addItem(productLike({ id: "5", price: 20000 }), {
      addOns: [{ id: "11", name: "Telur", price: 5000 }],
    });
    // Server confirms a new final unit price for the submitted customization.
    useCartStore.getState().applyServerPrices([{ index: 0, price: 27000 }]);
    expect(useCartStore.getState().items[0].price).toBe(27000);
    // Customer edits the customization through the real path.
    useCartStore.getState().updateCustomization("5", {
      addOns: [{ id: "12", name: "Keju", price: 8000 }],
    });
    const [line] = useCartStore.getState().items;
    // Confirmed basis (27k − 5k = 22k) + new markup (8k) = 30k.
    expect(line.price).toBe(30000);
    expect(line.totalPrice).toBe(30000);
    const [payload] = buildOrderItemsPayload(
      useCartStore.getState().items,
    );
    expect(payload.expectedPrice).toBe(30000);
    expect(payload.quantity).toBe(1);
  });

  test("a confirmed price with no markups becomes the new base", () => {
    useCartStore.getState().addItem(productLike({ id: "5", price: 20000 }));
    useCartStore.getState().applyServerPrices([{ index: 0, price: 22000 }]);
    useCartStore.getState().updateCustomization("5", {
      addOns: [{ id: "11", name: "Telur", price: 5000 }],
    });
    expect(useCartStore.getState().items[0].price).toBe(27000);
  });

  test("multiple markups are all backed out of the confirmed basis", () => {
    useCartStore.getState().addItem(
      productLike({ id: "5", price: 20000 }),
      {
        addOns: [{ id: "11", name: "Telur", price: 5000 }],
        selectedOptions: [
          { groupId: "g1", groupName: "Ukuran", choiceName: "Large", price: 3000 },
        ],
      },
    );
    // 20k + 5k + 3k = 28k submitted; server confirms 30k → basis 22k.
    useCartStore.getState().applyServerPrices([{ index: 0, price: 30000 }]);
    useCartStore.getState().updateCustomization("5", {
      addOns: [{ id: "11", name: "Telur", price: 5000 }],
      selectedOptions: [
        { groupId: "g1", groupName: "Ukuran", choiceName: "Reguler", price: 0 },
      ],
    });
    expect(useCartStore.getState().items[0].price).toBe(27000);
  });

  test("a confirmed zero price with no markups keeps a zero base", () => {
    useCartStore.getState().addItem(
      productLike({ id: "5", price: 20000, effectivePrice: 0 }),
    );
    useCartStore.getState().applyServerPrices([{ index: 0, price: 0 }]);
    useCartStore.getState().updateCustomization("5", {});
    expect(useCartStore.getState().items[0].price).toBe(0);
  });
});

describe("useCartStore.applyServerPrices — same-product siblings (F1)", () => {
  const telur = { id: "11", name: "Telur", price: 5000 };
  const keju = { id: "12", name: "Keju", price: 8000 };

  function seedSiblings() {
    // Line 0: base 20k + 5k = 25k. Line 1: base 20k + 8k = 28k.
    useCartStore.getState().addItem(productLike({ id: "5", price: 20000 }), {
      addOns: [telur],
    });
    useCartStore.getState().addItem(productLike({ id: "5", price: 20000 }), {
      addOns: [keju],
    });
  }

  test("confirming the first line leaves the sibling untouched", async () => {
    const { buildOrderItemsPayload } =
      await import("../utils/buildOrderItemsPayload");
    seedSiblings();
    // Backend mismatch index 0 → first submitted line only.
    useCartStore.getState().applyServerPrices([{ index: 0, price: 27000 }]);
    const [first, second] = useCartStore.getState().items;
    expect(first.price).toBe(27000);
    expect(first.basePrice).toBe(22000);
    expect(first.totalPrice).toBe(27000);
    expect(second.price).toBe(28000);
    expect(second.basePrice).toBe(20000);
    expect(second.customization).toEqual({ addOns: [keju] });
    expect(second.quantity).toBe(1);
    expect(second.totalPrice).toBe(28000);
    const payload = buildOrderItemsPayload(useCartStore.getState().items);
    expect(payload[0].expectedPrice).toBe(27000);
    expect(payload[1].expectedPrice).toBe(28000);
    expect(payload).toHaveLength(2);
  });

  test("confirming only the second sibling line is position-precise", () => {
    seedSiblings();
    useCartStore.getState().applyServerPrices([{ index: 1, price: 30000 }]);
    const [first, second] = useCartStore.getState().items;
    expect(first.price).toBe(25000);
    expect(first.basePrice).toBe(20000);
    expect(second.price).toBe(30000);
    expect(second.basePrice).toBe(22000);
  });
});

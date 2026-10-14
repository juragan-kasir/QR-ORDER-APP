import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product, CartItemCustomization } from "../types";
import { resolveDisplayPrice } from "../utils/resolveDisplayPrice";

interface CartState {
  storeId: string | null;
  items: CartItem[];
  addItem: (product: Product, customization?: CartItemCustomization) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateCustomization: (
    productId: string,
    customization: CartItemCustomization,
  ) => void;
  // DR-11: applies customer-confirmed server prices after PRICE_CHANGED.
  // Updates are positional: `index` is the submit-time cart position of the
  // affected line (the backend mismatch `index` counts submitted lines in
  // order, and the caller's snapshot check guarantees the live cart still
  // has that exact order). Positional — never product-ID — addressing keeps
  // same-product sibling lines with different customizations precise.
  // Only quantity and customization are untouched; out-of-range entries are
  // ignored.
  applyServerPrices: (updates: { index: number; price: number }[]) => void;
  clearCart: () => void;
  setStoreId: (storeId: string | null) => void;
  totalItems: () => number;
  subtotal: () => number;
  tax: () => number;
  serviceCharge: () => number;
  totalPrice: () => number;
}

const TAX_RATE = 0;
const SERVICE_CHARGE_RATE = 0;

function calcMarkupTotal(customization?: CartItemCustomization): number {
  const addOnTotal =
    customization?.addOns?.reduce((sum, a) => sum + a.price, 0) || 0;
  const optionGroupsTotal =
    customization?.selectedOptions?.reduce((sum, o) => sum + o.price, 0) || 0;
  return addOnTotal + optionGroupsTotal;
}

function calcUnitPrice(
  basePrice: number,
  customization?: CartItemCustomization,
): number {
  return basePrice + calcMarkupTotal(customization);
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      items: [],
      addItem: (product, customization) => {
        const currentItems = get().items;

        if (product.stock <= 0) return false;

        const existingItem = currentItems.find(
          (item) =>
            item.id === product.id &&
            JSON.stringify(item.customization) ===
              JSON.stringify(customization),
        );

        // DR-11: persist the outlet-resolved base so cart, payment
        // review, and expectedPrice all derive from the same price of
        // record. Bundle lines carry bundlePrice as product.price already.
        const basePrice = resolveDisplayPrice(product);
        const unitPrice = calcUnitPrice(basePrice, customization);

        if (existingItem) {
          const newQty = existingItem.quantity + 1;
          if (newQty > product.stock) return false;

          set({
            items: currentItems.map((item) =>
              item.id === product.id &&
              JSON.stringify(item.customization) ===
                JSON.stringify(customization)
                ? { ...item, quantity: newQty, totalPrice: unitPrice * newQty }
                : item,
            ),
          });
        } else {
          set({
            items: [
              ...currentItems,
              {
                id: product.id,
                name: product.name,
                description: product.description,
                basePrice,
                price: unitPrice,
                image: product.image,
                category: product.category,
                quantity: 1,
                customization,
                totalPrice: unitPrice,
                bundleId: product.bundleId,
                bundleItems: product.bundleItems,
              },
            ],
          });
        }
        return true;
      },
      removeItem: (productId) => {
        set({ items: get().items.filter((item) => item.id !== productId) });
      },
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((item) =>
            item.id === productId
              ? { ...item, quantity, totalPrice: item.price * quantity }
              : item,
          ),
        });
      },
      updateCustomization: (productId, customization) => {
        set({
          items: get().items.map((item) =>
            item.id === productId
              ? (() => {
                  const unitPrice = calcUnitPrice(
                    item.basePrice,
                    customization,
                  );
                  return {
                    ...item,
                    customization,
                    price: unitPrice,
                    totalPrice: unitPrice * item.quantity,
                  };
                })()
              : item,
          ),
        });
      },
      clearCart: () => set({ items: [] }),
      applyServerPrices: (updates) => {
        const byIndex = new Map(updates.map((u) => [u.index, u.price]));
        set({
          items: get().items.map((item, index) => {
            const price = byIndex.get(index);
            if (price === undefined) return item;
            // DR-11 price-basis invariant: the confirmed value is a FINAL
            // unit price for the line's current customization (guaranteed by
            // the caller's snapshot check), so the persisted base becomes
            // confirmed − current markups. Later customization edits then
            // recalculate from the confirmed basis instead of a stale base.
            const basePrice = price - calcMarkupTotal(item.customization);
            return { ...item, basePrice, price, totalPrice: price * item.quantity };
          }),
        });
      },
      setStoreId: (newStoreId) => {
        const current = get().storeId;
        if (newStoreId && current && newStoreId !== current) {
          set({ storeId: newStoreId, items: [] });
        } else {
          set({ storeId: newStoreId });
        }
      },
      totalItems: () =>
        get().items.reduce((acc, item) => acc + item.quantity, 0),
      subtotal: () =>
        get().items.reduce((acc, item) => acc + item.totalPrice, 0),
      tax: () => get().subtotal() * TAX_RATE,
      serviceCharge: () => get().subtotal() * SERVICE_CHARGE_RATE,
      totalPrice: () => get().subtotal() + get().tax() + get().serviceCharge(),
    }),
    {
      name: "bisamakan-cart",
      partialize: (state) => ({
        storeId: state.storeId,
        items: state.items,
      }),
    },
  ),
);

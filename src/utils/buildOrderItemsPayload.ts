import type { CartItem } from "../types";

export interface OrderItemPayload {
  productId?: number;
  productName: string;
  quantity: number;
  price: number;
  // DR-11: client echo of the final charged unit price for this line
  // (outlet-resolved base + price-bearing customizations, or bundlePrice
  // for bundles). Comparison-only server-side; omission skips enforcement.
  expectedPrice: number;
  notes?: string;
  options?: unknown[];
  modifiers?: unknown[];
  bundleId?: number | null;
}

// Builds the backend-facing order-item payload from cart lines: a bundle
// line is sent with `bundleId` only — BE-POS-App resolves the underlying
// products itself (see order/customer-create) — never a synthetic
// productId; a regular line is sent with `productId` plus its selected
// size/add-ons. Pure mapping, no network calls and no financial authority —
// price/stock/table remain re-validated and authoritatively priced
// server-side regardless of what's sent here.
export function buildOrderItemsPayload(cartItems: CartItem[]): OrderItemPayload[] {
  return cartItems.map((item) =>
    item.bundleId
      ? {
          bundleId: Number(item.bundleId),
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          // DR-11: bundle lines compare against bundlePrice, which the
          // cart stores as the line's unit price.
          expectedPrice: item.price,
          notes: item.customization?.notes,
        }
      : {
          productId: Number(item.id),
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          // DR-11: the cart unit price already is catalogBase + markup
          // (see useCartStore), i.e. exactly the backend's unit-price
          // semantics before quantity/discount/tax/service.
          expectedPrice: item.price,
          notes: item.customization?.notes,
          options: buildOptionsPayload(item),
          modifiers: item.customization?.addOns?.map((a) => ({
            id: Number(a.id),
            name: a.name,
            price: a.price,
          })),
        },
  );
}

// BE-POS-App's own price re-derivation (order/customer-create ->
// getServerItemPrice) matches each options[].name against a product's real
// option-group data using either the bare choice name or the qualified
// "<groupName> - <choiceName>" form — the qualified form is used here so a
// choice can't collide with a same-named choice in a different group on the
// same product (e.g. Nasgor's "Ukuran"/"Piring" groups don't share names
// today, but nothing guarantees that in general).
function buildOptionsPayload(item: CartItem): unknown[] | undefined {
  const entries: unknown[] = [];
  if (item.customization?.size) {
    entries.push({ name: "size", value: item.customization.size });
  }
  for (const option of item.customization?.selectedOptions || []) {
    entries.push({
      name: `${option.groupName} - ${option.choiceName}`,
      value: option.choiceName,
    });
  }
  return entries.length > 0 ? entries : undefined;
}

import type { Product } from "../types";

// DR-11: single display-price resolver for ordinary products — the
// backend-resolved outlet price is the price of record. Nullish coalescing
// (never truthiness) so a legitimate price of 0 is preserved. Bundles keep
// their own bundlePrice contract and must not go through here.
export function resolveDisplayPrice(product: Product): number {
  return product.effectivePrice ?? product.price;
}

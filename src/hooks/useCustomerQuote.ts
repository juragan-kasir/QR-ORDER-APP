import { useState } from "react";
import { fetchCustomerQuote } from "../services/orderService";
import type { CustomerQuoteResult } from "../services/orderService";
import type { OrderItemPayload } from "../utils/buildOrderItemsPayload";
import { useFetchEffect } from "./useFetch";

// FG-PRICE-02: re-quotes the summary whenever the cart lines change. The
// result belongs to the exact `key` it was fetched for, so a quote for an
// older cart is never shown against the current one.
export function useCustomerQuote(
  storeId: string | null,
  items: OrderItemPayload[],
): { result: CustomerQuoteResult | null; loading: boolean } {
  const key = JSON.stringify(
    items.map((i) => [i.productId ?? null, i.bundleId ?? null, i.quantity, i.options ?? [], i.modifiers ?? []]),
  );
  const [state, setState] = useState<{ key: string; result: CustomerQuoteResult } | null>(null);

  const { isPending } = useFetchEffect(async (cancelled) => {
    if (!storeId || items.length === 0) return;
    const result = await fetchCustomerQuote(Number(storeId), items);
    if (!cancelled()) setState({ key, result });
  }, [storeId, key]);

  const current = state && state.key === key ? state.result : null;
  return { result: current, loading: isPending || current === null };
}

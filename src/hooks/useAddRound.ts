import { useState } from "react";
import { ApiError } from "../services/apiClient";
import { addCustomerOrderItems } from "../services/orderService";
import type { AddRoundTarget } from "../store/useOrderStore";
import type { CartItem } from "../types";
import { buildOrderItemsPayload } from "../utils/buildOrderItemsPayload";
import { cartSignature, clearAttemptKey, getAttemptKey } from "../utils/attemptKey";

// What the diner reads when the backend refuses the round; `closed` drops
// the target so the cart goes back to placing a new order.
const REFUSALS: Record<string, { message: string; closed: boolean }> = {
  ORDER_NOT_OPEN: {
    message: "Pesanan ini sudah dibayar atau ditutup. Lanjutkan ke checkout untuk membuat pesanan baru.",
    closed: true,
  },
  ORDER_PARTIALLY_PAID: {
    message: "Tagihan ini sedang dibayar di kasir. Panggil pelayan untuk menambah pesanan.",
    closed: false,
  },
  ORDER_HAS_SPLITS: {
    message: "Tagihan ini sudah dipisah di kasir. Panggil pelayan untuk menambah pesanan.",
    closed: false,
  },
  PRICE_CHANGED: {
    message: "Harga menu berubah. Kembali ke menu untuk melihat harga terbaru, lalu coba lagi.",
    closed: false,
  },
};

const roundSignature = (target: AddRoundTarget, items: CartItem[]) =>
  cartSignature(
    items.map((item) => ({
      id: String(item.id),
      quantity: item.quantity,
      customizationKey: JSON.stringify(item.customization ?? null),
    })),
    target.storeId,
    `round-${target.publicToken}`,
  );

export function useAddRound({
  target,
  items,
  onAdded,
  onClosed,
}: {
  target: AddRoundTarget;
  items: CartItem[];
  onAdded: () => void;
  onClosed: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    const signature = roundSignature(target, items);
    setSubmitting(true);
    setError(null);
    try {
      await addCustomerOrderItems(target.publicToken, {
        items: buildOrderItemsPayload(items),
        idempotencyKey: getAttemptKey(signature),
      });
      clearAttemptKey(signature);
      onAdded();
    } catch (err) {
      const refusal = err instanceof ApiError && err.code ? REFUSALS[err.code] : undefined;
      setError(refusal?.message ?? (err instanceof Error ? err.message : "Gagal menambah pesanan."));
      if (refusal?.closed) onClosed();
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, error };
}

import React from "react";
import { useCartStore } from "../store/useCartStore";
import { useOrderStore, type AddRoundTarget } from "../store/useOrderStore";
import { useAddRound } from "../hooks/useAddRound";

const AddRoundCta: React.FC<{ target: AddRoundTarget; onDone: () => void }> = ({
  target,
  onDone,
}) => {
  const { items, clearCart } = useCartStore();
  const clearAddRound = useOrderStore((state) => state.clearAddRound);
  const { submit, submitting, error } = useAddRound({
    target,
    items,
    onAdded: () => {
      clearCart();
      clearAddRound();
      onDone();
    },
    onClosed: clearAddRound,
  });

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Menu ini ditambahkan ke pesanan #{target.orderNumber} dan dibayar bersama di kasir.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center">
          {error}
        </p>
      )}
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full bg-primary text-white py-4 rounded-2xl font-bold tap-scale shadow-lg shadow-primary/20 disabled:opacity-60"
      >
        {submitting ? "Menambahkan..." : `Tambahkan ke Pesanan #${target.orderNumber}`}
      </button>
      <button onClick={clearAddRound} className="w-full text-primary font-bold text-sm">
        Buat pesanan terpisah saja
      </button>
    </div>
  );
};

export default AddRoundCta;

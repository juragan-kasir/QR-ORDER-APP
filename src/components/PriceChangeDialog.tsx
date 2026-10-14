import React from "react";

export interface PriceChangeLine {
  name: string;
  quantity: number;
  expectedPrice: number;
  currentPrice: number;
}

interface PriceChangeDialogProps {
  open: boolean;
  changes: PriceChangeLine[];
  // True while a confirmed resubmission is in flight — blocks double confirm.
  confirming: boolean;
  // True when the cart no longer matches the submit-time snapshot — the
  // confirm action is withheld and the customer reviews the cart instead.
  stale: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}

// DR-11: explicit customer confirmation after a 409 PRICE_CHANGED. Never
// submits anything itself — the parent owns confirm/decline behavior.
const PriceChangeDialog: React.FC<PriceChangeDialogProps> = ({
  open,
  changes,
  confirming,
  stale,
  onConfirm,
  onDecline,
}) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Konfirmasi perubahan harga"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Harga berubah
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {stale
            ? "Keranjang berubah setelah harga diperbarui. Silakan periksa kembali keranjang dan kirim ulang pesanan."
            : "Satu atau lebih harga berubah sejak kamu melihat menu. Periksa harga terbaru di bawah ini sebelum melanjutkan."}
        </p>
        <ul className="space-y-2">
          {changes.map((change, i) => (
            <li
              key={`${change.name}-${i}`}
              className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                  {change.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {change.quantity}x
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400 dark:text-gray-500 line-through">
                  Rp{change.expectedPrice.toLocaleString()}
                </p>
                <p className="font-bold text-sm text-primary">
                  Rp{change.currentPrice.toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
          >
            Batal
          </button>
          {!stale && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              className="flex-1 px-4 py-3 rounded-2xl font-bold text-sm bg-primary text-white disabled:opacity-50"
            >
              {confirming ? "Mengirim..." : "Konfirmasi & Lanjut"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceChangeDialog;

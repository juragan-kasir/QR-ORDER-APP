import React, { useState, useEffect } from "react";
import { useCartStore } from "../store/useCartStore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Trash2, ShoppingBag } from "lucide-react";
import CartSummary from "../components/CartSummary";
import Skeleton from "../components/Skeleton";
import BundleBadge from "../components/BundleBadge";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { useStoreConfig } from "../hooks/useStoreConfig";

const CartPage: React.FC = () => {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { config } = useStoreConfig(searchParams.get("store"));
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const closeClearConfirm = () => setShowClearConfirm(false);
  const clearConfirmTitleId = React.useId();
  const clearConfirmPanelRef = useDialogA11y<HTMLDivElement>(
    showClearConfirm,
    closeClearConfirm,
  );

  const href = (path: string) => {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}table=${searchParams.get("table") || ""}&store=${searchParams.get("store") || ""}&session=${searchParams.get("session") || ""}`;
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (items.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
          <ShoppingBag size={36} className="text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
          Keranjang masih kosong nih.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Yuk pilih menu favoritmu!
        </p>
        <button
          onClick={() => navigate(href("/"))}
          className="mt-6 bg-primary text-white px-8 py-3 rounded-2xl font-bold tap-scale shadow-lg shadow-primary/20"
        >
          Mulai Pesan
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <Skeleton width="40%" height="2rem" borderRadius="0.75rem" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 p-4 rounded-2xl flex items-center gap-4 border border-gray-50 dark:border-gray-700/50"
            >
              <Skeleton width="4rem" height="4rem" borderRadius="0.75rem" />
              <div className="flex-1 space-y-2">
                <Skeleton width="60%" height="1rem" borderRadius="0.5rem" />
                <Skeleton width="40%" height="0.8rem" borderRadius="0.5rem" />
              </div>
              <Skeleton width="5rem" height="2rem" borderRadius="0.5rem" />
            </div>
          ))}
        </div>
        <Skeleton width="100%" height="12rem" borderRadius="1.5rem" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-40 md:pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Keranjang Anda
        </h2>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="text-sm text-red-500 font-medium hover:text-red-600 px-3 py-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          Kosongkan
        </button>
      </div>

      {showClearConfirm && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            closeClearConfirm();
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            ref={clearConfirmPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={clearConfirmTitleId}
            tabIndex={-1}
            className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 space-y-4 outline-none"
          >
            <h3
              id={clearConfirmTitleId}
              className="text-lg font-bold text-gray-900 dark:text-gray-100"
            >
              Kosongkan Keranjang?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Semua item di keranjang akan dihapus. Tindakan ini bisa
              dibatalkan sebelum kamu menekan "Ya, Hapus".
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={closeClearConfirm}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  clearCart();
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-3 rounded-2xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {searchParams.get("table") && (
          <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
            Meja {searchParams.get("table")}
          </span>
        )}
        {searchParams.get("store") && (
          <span className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full font-medium">
            {config.storeName || "Toko"}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 p-4 rounded-2xl flex items-center gap-4 border border-gray-50 dark:border-gray-700/50 shadow-sm"
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-16 h-16 rounded-xl object-cover"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h4 className="font-bold truncate text-gray-900 dark:text-gray-100">
                  {item.name}
                </h4>
                {item.bundleId && <BundleBadge />}
              </div>
              {item.bundleItems && item.bundleItems.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  Isi:{" "}
                  {item.bundleItems
                    .map((b) => (b.quantity > 1 ? `${b.name} x${b.quantity}` : b.name))
                    .join(", ")}
                </p>
              )}
              {item.customization?.size && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {item.customization.size}
                </p>
              )}
              {item.customization?.selectedOptions && item.customization.selectedOptions.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  {item.customization.selectedOptions
                    .map((o) => `${o.groupName}: ${o.choiceName}`)
                    .join(", ")}
                </p>
              )}
              {item.customization?.addOns && item.customization.addOns.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  {item.customization.addOns.map((a) => a.name).join(", ")}
                </p>
              )}
              {item.customization?.spiciness && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Pedas: {item.customization.spiciness}
                </p>
              )}
              {item.customization?.notes && (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic truncate">
                  "{item.customization.notes}"
                </p>
              )}
              <p className="text-sm font-medium text-primary mt-0.5">
                Rp{item.price.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                aria-label="Kurangi jumlah"
                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                −
              </button>
              <span className="font-bold w-6 text-center text-gray-900 dark:text-gray-100">
                {item.quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                aria-label="Tambah jumlah"
                className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold hover:bg-primary hover:text-white transition-colors"
              >
                +
              </button>
              <button
                onClick={() => removeItem(item.id)}
                aria-label="Hapus item"
                className="w-10 h-10 flex items-center justify-center rounded-full text-gray-300 dark:text-gray-600 ml-2 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <CartSummary />

      {/* Fixed on mobile so the primary action stays reachable without
          scrolling through the whole cart; bottom-[64px] clears the fixed
          mobile bottom nav (Layout.tsx), which sits below it. Reverts to a
          normal in-flow button on desktop (md:), where there is no bottom
          nav and the page is short enough not to need this. */}
      <div className="fixed inset-x-0 bottom-[64px] z-40 bg-secondary/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-100 dark:border-gray-700/50 px-4 py-3 md:static md:inset-auto md:z-auto md:bg-transparent md:dark:bg-transparent md:backdrop-blur-none md:border-0 md:px-0 md:py-0">
        <button
          onClick={() => navigate(href("/checkout"))}
          className="w-full bg-primary text-white py-4 rounded-2xl font-bold tap-scale shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
        >
          Lanjut ke Checkout
        </button>
      </div>
    </div>
  );
};

export default CartPage;

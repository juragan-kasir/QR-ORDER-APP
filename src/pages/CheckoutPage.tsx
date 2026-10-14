import React, { useState } from "react";
import { useCartStore } from "../store/useCartStore";
import { useNavigate, useSearchParams } from "react-router-dom";
import CartSummary from "../components/CartSummary";
import BundleBadge from "../components/BundleBadge";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { useCheckoutStore } from "../store/useCheckoutStore";
import { useStoreConfig } from "../hooks/useStoreConfig";

const CheckoutPage: React.FC = () => {
  const { items, subtotal } = useCartStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setCheckoutData } = useCheckoutStore();
  const { config, error: configError } = useStoreConfig(searchParams.get("store"));

  const href = (path: string) => {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}table=${searchParams.get("table") || ""}&store=${searchParams.get("store") || ""}&session=${searchParams.get("session") || ""}`;
  };
  // Table identity must come from the QR-derived URL context, not a
  // customer-editable field — see Layout.tsx, which already refuses to
  // render this page at all unless `table` is present in the URL.
  const tableNumber = searchParams.get("table") || "";
  const [customerName, setCustomerName] = useState("");

  if (items.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
          <ShoppingCart
            size={36}
            className="text-gray-400 dark:text-gray-500"
          />
        </div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Keranjang kosong.
        </p>
        <button
          onClick={() => navigate(href("/"))}
          className="mt-4 text-primary font-bold text-sm"
        >
          Kembali ke Menu
        </button>
      </div>
    );
  }

  const handleSubmit = () => {
    const checkoutData = {
      tableNumber,
      customerName: customerName.trim() || undefined,
      subtotal: subtotal(),
    };
    setCheckoutData(checkoutData);
    navigate(href("/payment"));
  };

  return (
    <div className="space-y-6 pb-40 md:pb-20">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Kembali"
          className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Checkout
        </h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 space-y-5 border border-gray-50 dark:border-gray-700/50 shadow-sm">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100">
            Informasi Meja
          </h3>
          {config.storeName && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {config.storeName}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Nomor Meja
          </label>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary px-4 py-2.5 rounded-2xl text-sm font-bold">
              Meja {tableNumber || "-"}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Sesuai QR yang kamu scan
            </span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Nama Pelanggan
            <span className="text-gray-400 dark:text-gray-500">
              {" "}
              (opsional)
            </span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nama kamu"
            className="w-full p-3.5 border-2 border-gray-200 dark:border-gray-600 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
          />
          {/* DR-16: free text never unlocks member benefits — the name is
              only a table label for the staff. Staff attach a verified
              member at settlement instead. */}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            Nama hanya label pesanan, bukan member.
          </p>
        </div>
      </div>

      <CartSummary />

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 space-y-2 border border-gray-50 dark:border-gray-700/50 shadow-sm">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm gap-2">
            <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5 min-w-0 truncate">
              {item.name} x{item.quantity}
              {item.bundleId && <BundleBadge />}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100 shrink-0">
              Rp{item.totalPrice.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Fixed on mobile so the primary action stays reachable without
          scrolling past the item list; bottom-[64px] clears the fixed
          mobile bottom nav (Layout.tsx), which sits below it. Reverts to a
          normal in-flow button on desktop (md:), where there is no bottom
          nav. */}
      <div className="fixed inset-x-0 bottom-[64px] z-40 bg-secondary/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-100 dark:border-gray-700/50 px-4 py-3 md:static md:inset-auto md:z-auto md:bg-transparent md:dark:bg-transparent md:backdrop-blur-none md:border-0 md:px-0 md:py-0">
        {/* DR-17: totals cannot be committed while authoritative rates are
            unavailable — the payment step blocks too, but stopping here
            avoids a dead-end trip through the flow. */}
        <button
          onClick={handleSubmit}
          disabled={!!configError}
          className="w-full bg-primary text-white py-4 rounded-2xl font-bold tap-scale disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
        >
          Lanjut ke Pembayaran
        </button>
      </div>
    </div>
  );
};

export default CheckoutPage;

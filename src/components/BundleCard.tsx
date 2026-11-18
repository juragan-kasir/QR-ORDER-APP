import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "../store/useCartStore";
import { Package, X, Plus } from "lucide-react";
import type { Bundle } from "../types";
import { bundleToCartProduct } from "../utils/bundleToProduct";
import { useDialogA11y } from "../hooks/useDialogA11y";

interface BundleCardProps {
  bundle: Bundle;
}

const BundleCard: React.FC<BundleCardProps> = ({ bundle }) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const titleId = React.useId();
  const closeDetail = () => setDetailOpen(false);
  const panelRef = useDialogA11y<HTMLDivElement>(detailOpen, closeDetail);

  const firstItemImage =
    bundle.image ||
    bundle.items[0]?.productImage ||
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=500&auto=format&fit=crop";

  const handleAddToCart = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    addItem(bundleToCartProduct(bundle));
    setDetailOpen(false);
  };

  return (
    <>
      <div
        onClick={() => setDetailOpen(true)}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm dark:shadow-gray-900/30 overflow-hidden tap-scale cursor-pointer border border-gray-50 dark:border-gray-700/50 transition-colors"
      >
        <div className="relative">
          <img
            src={firstItemImage}
            alt={bundle.name}
            className="w-full h-44 object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <span className="absolute top-3 left-3 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            Bundle
          </span>
          {bundle.discountAmount > 0 && (
            <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
              Hemat Rp{bundle.discountAmount.toLocaleString()}
            </span>
          )}
          {!bundle.isAvailable && (
            <span className="absolute top-3 right-3 bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
              Tidak Tersedia
            </span>
          )}
        </div>
        <div className="p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base line-clamp-1 text-gray-900 dark:text-gray-100">
              {bundle.name}
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
            {bundle.description}
          </p>

          {/* Item list */}
          <div className="space-y-1">
            {bundle.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
              >
                <span className="flex items-center gap-1">
                  <Package size={10} />
                  {item.productName} x{item.quantity}
                </span>
                <span>
                  Rp{item.unitPrice.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary text-lg">
                Rp{bundle.bundlePrice.toLocaleString()}
              </span>
              {bundle.originalPrice > bundle.bundlePrice && (
                <span className="text-xs text-gray-400 dark:text-gray-500 line-through">
                  Rp{bundle.originalPrice.toLocaleString()}
                </span>
              )}
            </div>
            {bundle.isAvailable ? (
              <button
                onClick={(e) => handleAddToCart(e)}
                aria-label="Tambahkan"
                className="bg-primary/10 text-primary p-2.5 rounded-full hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                <Package size={18} strokeWidth={2.5} />
              </button>
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-3 py-2">
                Tidak tersedia
              </span>
            )}
          </div>
        </div>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {detailOpen && (
              <motion.div
                key="bundle-preview-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDetailOpen(false)}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-6"
              >
                <motion.div
                  key="bundle-preview-panel"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  transition={{ type: "spring", damping: 26, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  tabIndex={-1}
                  className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl outline-none"
                >
                  <div className="relative">
                    <img
                      src={firstItemImage}
                      alt={bundle.name}
                      className="w-full h-56 sm:h-64 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <span className="absolute top-3 left-3 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                      Bundle Spesial
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailOpen(false)}
                      aria-label="Tutup detail bundle"
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-200 shadow-sm hover:bg-white dark:hover:bg-gray-800 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <h2
                        id={titleId}
                        className="text-2xl font-display font-bold text-gray-900 dark:text-gray-100"
                      >
                        {bundle.name}
                      </h2>
                      {bundle.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
                          {bundle.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
                        <Package size={16} className="text-primary" />
                        Isi Paket Bundle ({bundle.items.length} item)
                      </h4>
                      <div className="space-y-2.5">
                        {bundle.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
                          >
                            <div className="flex items-center gap-3">
                              {item.productImage && (
                                <img
                                  src={item.productImage}
                                  alt={item.productName}
                                  className="w-11 h-11 rounded-xl object-cover"
                                />
                              )}
                              <div>
                                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Qty: {item.quantity}
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                              Rp{item.unitPrice.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Harga Paket
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-2xl text-primary">
                            Rp{bundle.bundlePrice.toLocaleString()}
                          </span>
                          {bundle.originalPrice > bundle.bundlePrice && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 line-through">
                              Rp{bundle.originalPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {bundle.isAvailable ? (
                        <button
                          type="button"
                          onClick={() => handleAddToCart()}
                          className="bg-primary text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
                        >
                          <Plus size={18} strokeWidth={2.5} />
                          Tambah ke Keranjang
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500 font-medium px-3 py-2">
                          Tidak tersedia
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

export default BundleCard;

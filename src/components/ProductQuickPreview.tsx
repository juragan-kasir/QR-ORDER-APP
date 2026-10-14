import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Star, Plus, ChevronRight } from "lucide-react";
import type { Product } from "../types";
import { hasCustomizationOptions } from "../utils/productCustomization";
import { resolveDisplayPrice } from "../utils/resolveDisplayPrice";
import { useDialogA11y } from "../hooks/useDialogA11y";
import { transformCloudinaryImage, PRODUCT_IMAGE_WIDTH_SMALL } from "../utils/cloudinaryImage";

interface ProductQuickPreviewProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onAdd: (e: React.MouseEvent) => void;
}

const ProductQuickPreview: React.FC<ProductQuickPreviewProps> = ({
  product,
  open,
  onClose,
  onAdd,
}) => {
  const ingredients = product.ingredients || [];
  const sizes = product.sizes || [];
  const addOns = product.addOns || [];
  const optionGroups = product.optionGroups || [];
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const needsCustomization = hasCustomizationOptions(product);

  const [activeImage, setActiveImage] = useState(0);
  useEffect(() => {
    setActiveImage(0);
  }, [product.id]);

  const titleId = React.useId();
  const panelRef = useDialogA11y<HTMLDivElement>(open, onClose);

  const galleryImages =
    product.images.length > 0 ? product.images : [product.image];
  const safeIndex = Math.min(activeImage, galleryImages.length - 1);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="preview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            // Without this, the click bubbles through the React tree (portal
            // content bubbles via its React ancestors, not its DOM ancestors)
            // up to MenuCard's own onClick, which navigates to the product
            // detail page — closing the preview would also unintentionally
            // "click through" to the card underneath it.
            e.stopPropagation();
            onClose();
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6"
        >
          <motion.div
            key="preview-panel"
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
                src={transformCloudinaryImage(galleryImages.at(safeIndex), PRODUCT_IMAGE_WIDTH_SMALL)}
                alt={product.name}
                className="w-full h-60 sm:h-64 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              {product.isPromo && (
                <span className="absolute top-3 left-3 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  Promo
                </span>
              )}
              {outOfStock && (
                <span className="absolute top-3 left-3 bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  Habis
                </span>
              )}
              {galleryImages.length > 1 && (
                <span className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                  {safeIndex + 1} / {galleryImages.length}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup preview"
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm flex items-center justify-center text-gray-700 dark:text-gray-200 shadow-sm hover:bg-white dark:hover:bg-gray-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {galleryImages.length > 1 && (
              <div className="flex gap-2 px-5 pt-3 overflow-x-auto">
                {galleryImages.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    onClick={() => {
                      setActiveImage(i);
                    }}
                    className={`shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                      i === safeIndex
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-gray-200 dark:border-gray-700 opacity-70"
                    }`}
                  >
                    <img
                      src={transformCloudinaryImage(src, PRODUCT_IMAGE_WIDTH_SMALL)}
                      alt={`${product.name} ${i + 1}`}
                      className="w-14 h-14 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-2">
                      {product.category}
                    </span>
                    <h2
                      id={titleId}
                      className="text-2xl font-display font-bold text-gray-900 dark:text-gray-100"
                    >
                      {product.name}
                    </h2>
                  </div>
                  {product.reviewsCount > 0 ? (
                    <div className="flex items-center gap-1.5 text-accent text-sm font-bold bg-accent/10 px-3 py-1.5 rounded-full shrink-0">
                      <Star size={14} fill="currentColor" />
                      <span>{product.rating}</span>
                      <span className="text-gray-400 dark:text-gray-500 font-normal">
                        ({product.reviewsCount})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-sm font-medium bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full shrink-0">
                      <Star size={14} fill="none" />
                      <span>0 ulasan</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-3">
                  {product.description}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full">
                  <Clock size={14} />
                  Estimasi {product.estimatedTime} menit
                </span>
                {lowStock && (
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full font-semibold">
                    Sisa {product.stock}
                  </span>
                )}
                {product.isVegetarian && (
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-full font-semibold">
                    Vegetarian
                  </span>
                )}
              </div>

              {ingredients.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Bahan-bahan
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {ingredients.slice(0, 10).map((ing) => (
                      <span
                        key={ing}
                        className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {sizes.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Pilih Ukuran
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {optionGroups.map((group) => (
                <div key={group.id}>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {group.name}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {group.choices.map((choice) => (
                      <span
                        key={choice.name}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                      >
                        {choice.name}
                        {choice.price > 0 && (
                          <span className="opacity-70"> +Rp{choice.price.toLocaleString()}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {addOns.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Extra Topping
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {addOns.map((a) => (
                      <span
                        key={a.id}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border-2 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"
                      >
                        {a.name}{" "}
                        <span className="opacity-70">
                          +Rp{a.price.toLocaleString()}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {needsCustomization ? "Mulai dari" : "Harga"}
                  </p>
                  <span className="font-bold text-2xl text-primary">
                    Rp{resolveDisplayPrice(product).toLocaleString()}
                  </span>
                </div>
                {!outOfStock ? (
                  <button
                    type="button"
                    onClick={onAdd}
                    className="bg-primary text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
                  >
                    {needsCustomization ? (
                      <>
                        Pilih Opsi
                        <ChevronRight size={18} strokeWidth={2.5} />
                      </>
                    ) : (
                      <>
                        <Plus size={18} strokeWidth={2.5} />
                        Tambah ke Keranjang
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-medium px-3 py-2">
                    Stok habis
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default ProductQuickPreview;
import React, { useRef, useState } from 'react';
import { Star, Plus, Eye, Check } from 'lucide-react';
import type { Product } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import ProductQuickPreview from './ProductQuickPreview';
import { hasCustomizationOptions } from '../utils/productCustomization';
import { resolveDisplayPrice } from '../utils/resolveDisplayPrice';
import { transformCloudinaryImage, PRODUCT_IMAGE_WIDTH_SMALL } from '../utils/cloudinaryImage';

interface MenuCardProps {
  product: Product;
}

type AddStatus = 'idle' | 'added' | 'limit';

const MenuCard: React.FC<MenuCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [addStatus, setAddStatus] = useState<AddStatus>('idle');
  const addStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addItem = useCartStore((state) => state.addItem);
  const needsCustomization = hasCustomizationOptions(product);

  const href = (path: string) => {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}table=${searchParams.get('table') || ''}&store=${searchParams.get('store') || ''}&session=${searchParams.get('session') || ''}`;
  };

  const flashStatus = (status: AddStatus) => {
    if (addStatusTimer.current) clearTimeout(addStatusTimer.current);
    setAddStatus(status);
    addStatusTimer.current = setTimeout(() => setAddStatus('idle'), 1400);
  };

  // A product with any size/spiciness/add-on choice must go through the
  // customization flow (product detail page) — quick-adding it here would
  // silently skip those choices. Products with none can still be added in
  // one tap.
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (needsCustomization) {
      navigate(href(`/product/${product.id}`));
      return;
    }
    flashStatus(addItem(product) ? 'added' : 'limit');
  };

  const openPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewOpen(true);
  };

  const addFromPreview = () => {
    if (needsCustomization) {
      setPreviewOpen(false);
      navigate(href(`/product/${product.id}`));
      return;
    }
    addItem(product);
    setPreviewOpen(false);
  };

  return (
    <div
      onClick={() => navigate(href(`/product/${product.id}`))}
      className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm dark:shadow-gray-900/30 overflow-hidden tap-scale cursor-pointer border border-gray-50 dark:border-gray-700/50 transition-colors"
    >
      <div className="relative">
        <img
          src={transformCloudinaryImage(product.image, PRODUCT_IMAGE_WIDTH_SMALL)}
          alt={product.name}
          className="w-full h-44 object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        {product.isPromo && (
          <span className="absolute top-3 left-3 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            Promo
          </span>
        )}
        {product.stock <= 5 && product.stock > 0 && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            Sisa {product.stock}
          </span>
        )}
        {product.stock === 0 && (
          <span className="absolute top-3 right-3 bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            Habis
          </span>
        )}
        <button
          type="button"
          onClick={openPreview}
          aria-label="Lihat detail"
          className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center shadow-sm hover:bg-white dark:hover:bg-gray-800 transition-colors"
        >
          <Eye size={16} />
        </button>
      </div>
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-base line-clamp-1 text-gray-900 dark:text-gray-100">{product.name}</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{product.description}</p>
        {product.reviewsCount > 0 ? (
          <div className="flex items-center gap-1.5 text-accent text-xs font-bold">
            <Star size={12} fill="currentColor" />
            <span>{product.rating}</span>
            <span className="text-gray-400 dark:text-gray-500 font-normal">({product.reviewsCount})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-xs font-medium">
            <Star size={12} fill="none" />
            <span>0 ulasan</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="font-bold text-primary text-lg">
            Rp{resolveDisplayPrice(product).toLocaleString()}
          </span>
          {product.stock > 0 ? (
            <button
              onClick={handleAddToCart}
              aria-label={needsCustomization ? 'Pilih opsi' : 'Tambahkan'}
              className={`p-2.5 rounded-full transition-all shadow-sm ${
                addStatus === 'added'
                  ? 'bg-green-500 text-white'
                  : addStatus === 'limit'
                    ? 'bg-red-500 text-white'
                    : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
              }`}
            >
              {addStatus === 'added' ? (
                <Check size={18} strokeWidth={2.5} />
              ) : (
                <Plus size={18} strokeWidth={2.5} />
              )}
            </button>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium px-3 py-2">
              Stok habis
            </span>
          )}
        </div>
        {addStatus === 'limit' && (
          <p className="text-[11px] text-red-500 font-medium -mt-1">
            Jumlah maksimum di keranjang sudah tercapai.
          </p>
        )}
      </div>

      <ProductQuickPreview
        product={product}
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
        }}
        onAdd={addFromPreview}
      />
    </div>
  );
};

export default MenuCard;

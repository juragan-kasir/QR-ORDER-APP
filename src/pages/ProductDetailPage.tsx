import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useProduct } from "../hooks/useProduct";
import { useCartStore } from "../store/useCartStore";
import {
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Send,
  Clock,
  MessageSquare,
} from "lucide-react";
import CustomizationPanel from "../components/CustomizationPanel";
import { resolveDisplayPrice } from "../utils/resolveDisplayPrice";
import Skeleton from "../components/Skeleton";
import type { Size, Spiciness, Review } from "../types";
import { fetchProductReviews } from "../services/reviewService";
import {
  transformCloudinaryImage,
  PRODUCT_IMAGE_WIDTH_SMALL,
  PRODUCT_IMAGE_WIDTH_LARGE,
} from "../utils/cloudinaryImage";

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const store = searchParams.get("store");

  const { product, loading, error } = useProduct(id || null, store);
  const addItem = useCartStore((state) => state.addItem);

  const href = (path: string) => {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}table=${searchParams.get("table") || ""}&store=${searchParams.get("store") || ""}&session=${searchParams.get("session") || ""}`;
  };

  const [selectedSize, setSelectedSize] = useState<Size | undefined>();
  const [selectedSpiciness, setSelectedSpiciness] = useState<
    Spiciness | undefined
  >();
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [selectedOptionChoices, setSelectedOptionChoices] = useState<
    Record<string, string>
  >({});
  const [notes, setNotes] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewSort, setReviewSort] = useState<"terbaru" | "terlama" | "bintang">(
    "terbaru",
  );
  const [visibleReviews, setVisibleReviews] = useState(5);
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveImage(0);
    setVisibleReviews(5);
    setSelectedOptionChoices({});
    if (carouselRef.current) carouselRef.current.scrollTo({ left: 0 });
  }, [product?.id]);

  const galleryImages =
    product && product.images.length > 0
      ? product.images
      : product
        ? [product.image]
        : [];
  const safeIndex = Math.min(activeImage, galleryImages.length - 1);

  const scrollToIndex = (i: number) => {
    const el = carouselRef.current;
    if (!el || galleryImages.length === 0) return;
    const target = Math.min(Math.max(i, 0), galleryImages.length - 1);
    const slideWidth = el.scrollWidth / galleryImages.length;
    el.scrollTo({ left: target * slideWidth, behavior: "smooth" });
    setActiveImage(target);
  };

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || galleryImages.length === 0) return;
    const idx = Math.round(el.scrollLeft / (el.scrollWidth / galleryImages.length));
    setActiveImage(Math.min(Math.max(idx, 0), galleryImages.length - 1));
  };

  useEffect(() => {
    let cancelled = false;
    if (product && store) {
      setReviewError(null);
      fetchProductReviews(product.id, store)
        .then((result) => {
          if (cancelled) return;
          setReviews(result.reviews);
          setAverageRating(result.averageRating);
          setTotalReviews(result.totalReviews);
        })
        .catch(() => {
          if (cancelled) return;
          setReviews([]);
          setAverageRating(0);
          setTotalReviews(0);
          setReviewError("Gagal memuat ulasan. Coba lagi nanti.");
        });
      return () => {
        cancelled = true;
      };
    }
  }, [product, store]);

  const sortedReviews = useMemo(() => {
    const sorted = [...reviews];
    if (reviewSort === "terlama") {
      sorted.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    } else if (reviewSort === "bintang") {
      sorted.sort(
        (a, b) =>
          Number(b.rating) - Number(a.rating) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return sorted;
  }, [reviews, reviewSort]);

  const visibleList = sortedReviews.slice(0, visibleReviews);

  if (loading) {
    return (
      <div className="pb-20 space-y-6">
        <Skeleton width="3rem" height="3rem" borderRadius="50%" />
        <Skeleton width="100%" height="16rem" borderRadius="1.5rem" />
        <div className="space-y-4 px-4">
          <Skeleton width="70%" height="2rem" borderRadius="0.5rem" />
          <Skeleton width="100%" height="0.8rem" borderRadius="0.5rem" />
          <Skeleton width="60%" height="0.8rem" borderRadius="0.5rem" />
          <div className="flex gap-4 mt-4">
            <Skeleton width="5rem" height="2.5rem" borderRadius="9999px" />
            <Skeleton width="5rem" height="2.5rem" borderRadius="9999px" />
            <Skeleton width="5rem" height="2.5rem" borderRadius="9999px" />
          </div>
          <Skeleton width="100%" height="10rem" borderRadius="1.5rem" />
          <Skeleton width="100%" height="8rem" borderRadius="1.5rem" />
        </div>
      </div>
    );
  }

  if (error || !product)
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">😕</p>
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          {error || "Produk tidak ditemukan"}
        </p>
        <button
          onClick={() => navigate(href("/"))}
          className="mt-4 text-primary font-bold text-sm"
        >
          Kembali ke Menu
        </button>
      </div>
    );

  const handleAddOnToggle = (addOnId: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(addOnId)
        ? prev.filter((a) => a !== addOnId)
        : [...prev, addOnId],
    );
  };

  const handleOptionChoiceChange = (groupId: string, choiceName: string | undefined) => {
    setSelectedOptionChoices((prev) => {
      const next = { ...prev };
      if (choiceName) {
        next[groupId] = choiceName;
      } else {
        delete next[groupId];
      }
      return next;
    });
  };

  const selectedOptions = (product.optionGroups || []).flatMap((group) => {
    const choiceName = selectedOptionChoices[group.id];
    if (!choiceName) return [];
    const choice = group.choices.find((c) => c.name === choiceName);
    return choice
      ? [{ groupId: group.id, groupName: group.name, choiceName, price: choice.price }]
      : [];
  });

  const handleAddToCart = () => {
    const customization = {
      size: selectedSize,
      spiciness: selectedSpiciness,
      addOns: product.addOns?.filter((a) => selectedAddOns.includes(a.id)),
      selectedOptions: selectedOptions.length > 0 ? selectedOptions : undefined,
      notes: notes || undefined,
    };
    addItem(product, customization);
    navigate(href("/cart"));
  };

  const addOnTotal = selectedAddOns.reduce((sum, addOnId) => {
    const addOn = product.addOns?.find((a) => a.id === addOnId);
    return sum + (addOn?.price || 0);
  }, 0);

  const optionGroupsTotal = selectedOptions.reduce((sum, o) => sum + o.price, 0);

  const finalPrice =
    resolveDisplayPrice(product) + addOnTotal + optionGroupsTotal;

  const handleReviewSubmit = async () => {
    if (reviewRating === 0 || !reviewComment.trim() || !reviewName.trim())
      return;
    setReviewSubmitting(true);
    try {
      const { createReview } = await import("../services/reviewService");
      await createReview({
        name: reviewName.trim(),
        productId: product.id,
        storeId: store || "",
        rating: reviewRating,
        comment: reviewComment.trim(),
        orderId: "",
      });
      setReviews((prev) => [
        {
          id: Date.now().toString(),
          userId: "",
          userName: reviewName.trim(),
          rating: reviewRating,
          comment: reviewComment.trim(),
          createdAt: new Date().toISOString(),
          orderId: "",
          productId: product.id,
        },
        ...prev,
      ]);
      setAverageRating(
        (prev) => (prev * totalReviews + reviewRating) / (totalReviews + 1),
      );
      setTotalReviews((prev) => prev + 1);
      setReviewName("");
      setReviewRating(0);
      setReviewComment("");
      setShowReviewForm(false);
    } catch (err) {
      setReviewError(
        err instanceof Error
          ? err.message
          : "Gagal mengirim ulasan. Coba lagi.",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const formatReviewTime = (iso: string) => {
    const date = new Date(iso);
    const day = date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const time = date
      .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      .replace(".", ":");
    return `${day} • ${time}`;
  };

  const displayRating = averageRating > 0 ? averageRating : product.rating;
  const displayReviewCount =
    totalReviews > 0 ? totalReviews : product.reviewsCount;

  const ratingCounts = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    const s = Math.min(Math.max(Math.round(r.rating), 1), 5);
    ratingCounts[5 - s] += 1;
  });

  return (
    <div className="pb-20">
      <div className="-mx-4 mb-6">
        <div className="relative overflow-hidden">
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {galleryImages.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={transformCloudinaryImage(src, PRODUCT_IMAGE_WIDTH_LARGE)}
                alt={`${product.name} ${i + 1}`}
                draggable={false}
                className="w-full h-72 sm:h-96 object-cover shrink-0 snap-center"
              />
            ))}
          </div>
          <button
            onClick={() => navigate(-1)}
            aria-label="Kembali"
            className="absolute top-3 left-3 z-30 p-2.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-md border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent pointer-events-none" />
          {product.isPromo && (
            <span className="absolute top-3 right-3 bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
              Promo
            </span>
          )}
          {galleryImages.length > 1 && (
            <>
              <span className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                {safeIndex + 1} / {galleryImages.length}
              </span>
              <button
                onClick={() => {
                  scrollToIndex(safeIndex - 1);
                }}
                aria-label="Foto sebelumnya"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => {
                  scrollToIndex(safeIndex + 1);
                }}
                aria-label="Foto berikutnya"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
              >
                <ChevronRight size={20} />
              </button>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {galleryImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      scrollToIndex(i);
                    }}
                    aria-label={`Lihat foto ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === safeIndex
                        ? "w-5 bg-white"
                        : "w-1.5 bg-white/60 hover:bg-white/80"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        {galleryImages.length > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {galleryImages.map((src, i) => (
              <button
                key={`${src}-${i}`}
                onClick={() => {
                  scrollToIndex(i);
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
                  className="w-16 h-16 object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {product.name}
          </h1>
          {displayReviewCount > 0 ? (
            <div className="flex items-center gap-1.5 text-accent text-sm font-bold bg-accent/10 px-3 py-1.5 rounded-full">
              <Star size={14} fill="currentColor" />
              {averageRating > 0 ? averageRating.toFixed(1) : product.rating}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-sm font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
              <Star size={14} fill="none" />
              0 ulasan
            </div>
          )}
        </div>

        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          {product.description}
        </p>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
            ⏱ Estimasi {product.estimatedTime} menit
          </span>
          <span
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${product.stock > 0 ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-500"}`}
          >
            {product.stock > 0 ? `✅ Stok: ${product.stock}` : "❌ Habis"}
          </span>
        </div>

        {product.ingredients.length > 0 && (
          <div>
            <h4 className="font-bold text-sm mb-3 text-gray-900 dark:text-gray-100">
              Bahan-bahan
            </h4>
            <div className="flex gap-2 flex-wrap">
              {product.ingredients.map((ing) => (
                <span
                  key={ing}
                  className="bg-secondary dark:bg-gray-700 px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-600"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>
        )}

        <CustomizationPanel
          product={product}
          selectedSize={selectedSize}
          selectedSpiciness={selectedSpiciness}
          selectedAddOns={selectedAddOns}
          selectedOptionChoices={selectedOptionChoices}
          notes={notes}
          onSizeChange={setSelectedSize}
          onSpicinessChange={setSelectedSpiciness}
          onAddOnToggle={handleAddOnToggle}
          onOptionChoiceChange={handleOptionChoiceChange}
          onNotesChange={setNotes}
        />

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 space-y-4 border border-gray-50 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400 font-medium">
              Harga
            </span>
            <span className="font-bold text-2xl text-primary">
              Rp{finalPrice.toLocaleString()}
            </span>
          </div>
          {addOnTotal > 0 && (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              (+ Rp{addOnTotal.toLocaleString()} topping)
            </div>
          )}
          {optionGroupsTotal > 0 && (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              (+ Rp{optionGroupsTotal.toLocaleString()} opsi)
            </div>
          )}
          <button
            onClick={handleAddToCart}
            disabled={product.stock <= 0}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold tap-scale shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {product.stock > 0 ? "Tambah ke Keranjang" : "Stok Habis"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 space-y-5 border border-gray-50 dark:border-gray-700/50 shadow-sm mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare size={18} className="text-primary" />
            Ulasan Pembeli
          </h3>
          <div className="relative shrink-0">
            <select
              value={reviewSort}
              onChange={(e) => {
                setReviewSort(
                  e.target.value as "terbaru" | "terlama" | "bintang",
                );
              }}
              aria-label="Urutkan ulasan"
              className="appearance-none pl-3.5 pr-8 py-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="terbaru">Terbaru</option>
              <option value="terlama">Paling Lama</option>
              <option value="bintang">Bintang Terbanyak</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-center shrink-0">
            <p className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 leading-none">
              {Number(displayRating).toFixed(1)}
            </p>
            <div className="flex justify-center gap-0.5 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  fill={i < Math.round(displayRating) ? "#f59e0b" : "none"}
                  stroke={i < Math.round(displayRating) ? "#f59e0b" : "#d1d5db"}
                />
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              {displayReviewCount} ulasan
            </p>
          </div>

          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((value) => {
              const count = ratingCounts[5 - value];
              const pct =
                displayReviewCount > 0 ? (count / displayReviewCount) * 100 : 0;
              return (
                <div key={value} className="flex items-center gap-2">
                  <span className="w-7 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                    {value}
                    <Star size={10} fill="currentColor" className="text-accent" />
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-gray-400 dark:text-gray-500">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-700/60" />

        {reviewError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4">
            <p className="text-destructive text-sm font-medium">
              {reviewError}
            </p>
          </div>
        )}

        {reviews.length > 0 ? (
          <>
            <div className="space-y-4">
              {visibleList.map((review) => (
              <div
                key={review.id}
                className="border border-gray-100 dark:border-gray-700 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold uppercase">
                      {(review.userName || "?").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                        {review.userName}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock size={11} />
                        {formatReviewTime(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={13}
                        fill={i < review.rating ? "#f59e0b" : "none"}
                        stroke={i < review.rating ? "#f59e0b" : "#d1d5db"}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {review.comment}
                </p>
              </div>
            ))}
          </div>
          {sortedReviews.length > visibleReviews && (
            <div className="space-y-2 pt-1">
              <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                Menampilkan {Math.min(visibleReviews, sortedReviews.length)} dari{" "}
                {sortedReviews.length} ulasan
              </p>
              <button
                onClick={() => {
                  setVisibleReviews((c) => c + 5);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 tap-scale hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronDown size={16} />
                Muat Lebih Banyak
              </button>
            </div>
          )}
          </>
        ) : reviewError ? null : (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2">
              <MessageSquare size={20} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Belum ada ulasan — jadilah yang pertama menilai produk ini!
            </p>
          </div>
        )}

        {!showReviewForm ? (
          <button
            onClick={() => setShowReviewForm(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary py-3 rounded-2xl font-bold text-sm tap-scale hover:bg-primary hover:text-white transition-colors"
          >
            <Star size={16} />
            Tulis Ulasan
          </button>
        ) : (
          <div className="space-y-3 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 bg-gray-50/60 dark:bg-gray-900/40">
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nama
              </p>
              <input
                value={reviewName}
                onChange={(e) => {
                  setReviewName(e.target.value);
                }}
                placeholder="Tulis namamu..."
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rating
              </p>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setReviewRating(i + 1)}
                    className="p-1"
                  >
                    <Star
                      size={20}
                      fill={i < reviewRating ? "#f59e0b" : "none"}
                      stroke={i < reviewRating ? "#f59e0b" : "#d1d5db"}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Komentar
              </p>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Tulis pengalamanmu..."
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowReviewForm(false);
                  setReviewName("");
                  setReviewRating(0);
                  setReviewComment("");
                }}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-2xl font-bold text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleReviewSubmit}
                disabled={reviewSubmitting}
                className="flex-1 bg-primary text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <Send size={14} />
                {reviewSubmitting ? "Mengirim..." : "Kirim"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;
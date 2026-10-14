import React, { useState, useEffect, useCallback } from "react";
import { useCartStore } from "../store/useCartStore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RotateCcw, History, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import type { Order, Product } from "../types";
import { fetchCustomerOrders } from "../services/orderService";
import { fetchProductById, fetchBundles } from "../services/productService";
import Skeleton from "../components/Skeleton";
import BundleBadge from "../components/BundleBadge";
import { bundleToCartProduct } from "../utils/bundleToProduct";

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "completed", label: "Selesai" },
  { id: "cancelled", label: "Dibatalkan" },
  { id: "rejected", label: "Ditolak" },
];

const COMPLETED_STATUSES = new Set(["Sudah Diantar"]);

// The customer-orders endpoint has no status filter, so a status tab has to
// filter client-side. Pull a bounded window (not an unbounded fetch-all) of
// the most recent orders and paginate the filtered result locally; "Semua"
// keeps server-side pagination at `limit`.
const FILTERED_WINDOW = 100;

const OrderHistoryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const store = searchParams.get("store");
  const table = searchParams.get("table") || undefined;
  const session = searchParams.get("session") || undefined;

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const limit = 10;

  const href = (path: string) => {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}table=${searchParams.get("table") || ""}&store=${searchParams.get("store") || ""}&session=${searchParams.get("session") || ""}`;
  };

  const fetchOrders = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const filteredMode = statusFilter !== "all";
      const result = await fetchCustomerOrders(store, {
        page: filteredMode ? 1 : page,
        limit: filteredMode ? FILTERED_WINDOW : limit,
        tableId: table,
        session,
      });
      const filtered = result.orders.filter((o) => {
        if (statusFilter === "completed") {
          return COMPLETED_STATUSES.has(o.status);
        }
        if (statusFilter === "cancelled") {
          return o.status === "Dibatalkan";
        }
        if (statusFilter === "rejected") {
          return o.status === "Ditolak";
        }
        return true;
      });
      if (filteredMode) {
        // Filtered view: paginate the client-side-filtered window so both
        // the list and the page counter reflect the selected status.
        const start = (page - 1) * limit;
        setOrders(filtered.slice(start, start + limit));
        setTotal(filtered.length);
      } else {
        setOrders(filtered);
        setTotal(result.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat riwayat");
    } finally {
      setLoading(false);
    }
  }, [store, table, session, page, limit, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders();
  }, [fetchOrders]);

  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const handleReorder = async (order: Order) => {
    setReorderLoading(true);
    setReorderError(null);
    const unavailableItems: string[] = [];
    const entries: {
      product: Product;
      customization?: Order["items"][number]["customization"];
      quantity: number;
    }[] = [];

    // Only fetched when needed — getCustomerOrders now returns bundleId per
    // item (BE-POS-App order.js), so a bundle line is identified by that,
    // never guessed from productName.
    const bundles = order.items.some((item) => item.bundleId)
      ? await fetchBundles(store || undefined).catch(() => [])
      : [];

    for (const item of order.items) {
      if (item.bundleId) {
        const bundle = bundles.find((b) => b.id === item.bundleId);
        if (!bundle) {
          unavailableItems.push(item.bundleName || item.name);
          continue;
        }
        entries.push({ product: bundleToCartProduct(bundle), quantity: item.quantity });
        continue;
      }

      try {
        const product = await fetchProductById(item.productId, store || undefined);
        if (product && product.stock > 0) {
          entries.push({ product, customization: item.customization, quantity: item.quantity });
        } else {
          unavailableItems.push(item.name);
        }
      } catch {
        // DR-11/DR-14: availability and price cannot be verified (network
        // error) — the item is reported as unverifiable rather than
        // re-added with a guessed price/stock, which would commit a total
        // the server never quoted and stock it never confirmed.
        unavailableItems.push(`${item.name} (tidak dapat diverifikasi)`);
      }
    }

    if (entries.length === 0) {
      setReorderError(
        `Semua item dalam pesanan ini tidak tersedia lagi.${unavailableItems.length > 0 ? ` ${unavailableItems.join(", ")}.` : ""}`,
      );
      setReorderLoading(false);
      return;
    }

    for (const entry of entries) {
      // addItem always adds one unit — repeat per original quantity so a
      // reorder doesn't silently drop back to qty 1 for every line.
      for (let i = 0; i < entry.quantity; i++) {
        addItem(entry.product, entry.customization);
      }
    }

    setReorderLoading(false);

    if (unavailableItems.length > 0) {
      setReorderError(
        `Tidak dapat memesan ulang: ${unavailableItems.join(", ")}. Item tidak tersedia.`
      );
    }

    navigate(href("/cart"));
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Riwayat Pesanan
      </h2>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setStatusFilter(f.id);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === f.id
                ? "bg-primary text-white"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {reorderError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{reorderError}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-3xl p-6 space-y-4 border border-gray-50 dark:border-gray-700/50"
            >
              <div className="flex justify-between">
                <Skeleton width="30%" height="1.2rem" borderRadius="0.5rem" />
                <Skeleton width="5rem" height="2rem" borderRadius="9999px" />
              </div>
              <Skeleton width="100%" height="4rem" borderRadius="1rem" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-gray-500 dark:text-gray-400 font-medium">{error}</p>
          <button
            onClick={fetchOrders}
            className="mt-4 text-primary font-bold text-sm flex items-center gap-1.5 mx-auto"
          >
            <RotateCcw size={14} /> Coba Lagi
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
            <History size={36} className="text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {statusFilter === "all"
              ? "Tidak ada riwayat pesanan."
              : `Tidak ada pesanan berstatus ${STATUS_FILTERS.find((f) => f.id === statusFilter)?.label}.`}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm dark:shadow-gray-900/30 overflow-hidden border border-gray-50 dark:border-gray-700/50"
              >
                <div className="p-5 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">
                      #
                      {(order.orderNumber || order.id).slice(0, 10).toUpperCase()}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
                    {order.status}
                  </span>
                </div>

                <div className="p-5 space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm gap-2">
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5 min-w-0 truncate">
                        {item.bundleName || item.name} x{item.quantity}
                        {item.bundleId && <BundleBadge />}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 shrink-0">
                        Rp{item.totalPrice.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between font-bold">
                    <span className="text-gray-900 dark:text-gray-100">Total</span>
                    <span className="text-primary">
                      Rp{order.total.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <button
                    onClick={() => handleReorder(order)}
                    disabled={reorderLoading}
                    className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary py-3 rounded-2xl font-bold text-sm tap-scale hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={16} />
                    {reorderLoading ? "Memeriksa..." : "Pesan Ulang"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium disabled:opacity-30"
              >
                <ChevronLeft size={16} /> Sebelumnya
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Halaman {page} dari {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium disabled:opacity-30"
              >
                Selanjutnya <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OrderHistoryPage;
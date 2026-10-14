import React from "react";
import { useOrders } from "../hooks/useOrders";
import { useSearchParams, useNavigate } from "react-router-dom";
import OrderStatusTracker from "../components/OrderStatusTracker";
import { ListOrdered, RefreshCw } from "lucide-react";
import Skeleton from "../components/Skeleton";
import BundleBadge from "../components/BundleBadge";
import { bareTableDesignator } from "../utils/tableDisplay";

function statusBadgeClass(status: string) {
  if (status === "Ditolak" || status === "Dibatalkan")
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (status === "Menunggu Konfirmasi")
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  if (status === "Sedang Dimasak" || status === "Diproses")
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (status === "Siap Diantar")
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
  if (status === "Sudah Diantar")
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  return "bg-primary/10 text-primary";
}

function statusMessage(status: string) {
  switch (status) {
    case "Menunggu Konfirmasi":
      return "Pesananmu sedang menunggu konfirmasi dari kasir.";
    case "Ditolak":
      return "Pesananmu ditolak oleh kasir.";
    case "Dibatalkan":
      return "Pesananmu dibatalkan.";
    case "Diproses":
      return "Pesananmu sudah dikonfirmasi dan sedang diproses.";
    case "Sedang Dimasak":
      return "Pesananmu sedang diproses di dapur.";
    case "Siap Diantar":
      return "Pesananmu sudah siap diantar.";
    case "Sudah Diantar":
      return "Pesananmu sudah sampai. Terima kasih!";
    default:
      return "";
  }
}

const ACTIVE_STATUSES = new Set([
  "Menunggu Konfirmasi",
  "Diproses",
  "Sedang Dimasak",
  "Siap Diantar",
]);

// DR-08: payment is independent of fulfilment — a served-but-unpaid order
// (pay-after-eat) stays visible with its payment badge instead of vanishing
// into history looking completed.
function isOrderActive(o: { status: string; paymentStatus?: string }): boolean {
  if (ACTIVE_STATUSES.has(o.status)) return true;
  return o.paymentStatus != null && o.paymentStatus !== "paid" && o.paymentStatus !== "refunded";
}

function paymentBadgeClass(paymentStatus?: string): string {
  if (paymentStatus === "paid")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
}

function paymentBadgeLabel(paymentStatus?: string): string {
  if (paymentStatus === "paid") return "Lunas";
  if (paymentStatus === "partial") return "Dibayar sebagian";
  if (paymentStatus === "refunded") return "Dana dikembalikan";
  return "Belum dibayar • Bayar di kasir";
}

const OrdersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const store = searchParams.get("store");
  const table = searchParams.get("table");
  const session = searchParams.get("session") || undefined;
  const { orders, loading, error, refetch, lastFetchedAt } = useOrders(store, table ? { tableId: table, session } : undefined);

  const href = (path: string) => {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}table=${searchParams.get("table") || ""}&store=${searchParams.get("store") || ""}&session=${searchParams.get("session") || ""}`;
  };

  const activeOrders = table
    ? orders.filter((o) => isOrderActive(o))
    : orders;

  // A real order for this table already carries the backend's actual
  // table.name (see orderService.ts) — prefer that friendly name over the
  // raw QR table id used for authority/API calls, falling back to the raw
  // id only when no order has loaded yet to source a friendly name from.
  // This does NOT change what tableId is used for (table stays the URL
  // authority for polling/API params above) — display only.
  const displayTable = bareTableDesignator(orders[0]?.tableNumber) ?? table;

  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <Skeleton width="30%" height="2rem" borderRadius="0.75rem" />
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-3xl p-6 space-y-4 border border-gray-50 dark:border-gray-700/50"
            >
              <div className="flex justify-between">
                <Skeleton width="30%" height="1.2rem" borderRadius="0.5rem" />
                <Skeleton width="5rem" height="2rem" borderRadius="9999px" />
              </div>
              <Skeleton width="100%" height="4rem" borderRadius="1rem" />
              <div className="space-y-2">
                <Skeleton width="80%" height="0.8rem" borderRadius="0.5rem" />
                <Skeleton width="60%" height="0.8rem" borderRadius="0.5rem" />
              </div>
              <Skeleton width="40%" height="1.5rem" borderRadius="0.5rem" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-5xl mb-4">⚠️</p>
        <p className="text-gray-500 dark:text-gray-400 font-medium">{error}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 text-primary font-bold text-sm flex items-center gap-1.5 mx-auto"
        >
          <RefreshCw size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  if (table && activeOrders.length === 0 && orders.length > 0) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
          <ListOrdered size={36} className="text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Meja {displayTable}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Tidak ada pesanan aktif untuk meja ini.
        </p>
        <button
          onClick={() => navigate(href("/"))}
          className="mt-6 bg-primary text-white px-8 py-3 rounded-2xl font-bold tap-scale shadow-lg shadow-primary/20"
        >
          Mulai Pesanan Baru
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
          <ListOrdered size={36} className="text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
          Belum ada pesanan nih.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Pesan menu favoritmu dulu yuk!
        </p>
        <button
          onClick={() => navigate(href("/"))}
          className="mt-6 bg-primary text-white px-8 py-3 rounded-2xl font-bold tap-scale shadow-lg shadow-primary/20"
        >
          Lihat Menu
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {table ? `Meja ${displayTable}` : "Status Pesanan"}
        </h2>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-primary transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {/* DR-10: polling backs off up to 60s and pauses while hidden — show
          when the list was last refreshed so stale data is visibly stale. */}
      {lastFetchedAt != null && (
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-3">
          Diperbarui{" "}
          {new Date(lastFetchedAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      )}

      <div className="space-y-4">
        {activeOrders.map((order) => (
          <div
            key={order.id}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm dark:shadow-gray-900/30 overflow-hidden border border-gray-50 dark:border-gray-700/50"
          >
            <div className="p-5 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">
                  Pesanan #
                  {(order.orderNumber || order.id).slice(0, 10).toUpperCase()}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Meja {bareTableDesignator(order.tableNumber) ?? order.tableNumber}
                  {order.customerName && ` • ${order.customerName}`}
                </p>
                {/* DR-08: payment state is independent of fulfilment — an
                    unpaid order must never look fully completed. */}
                <span
                  className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${paymentBadgeClass(order.paymentStatus)}`}
                >
                  {paymentBadgeLabel(order.paymentStatus)}
                </span>
              </div>
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusBadgeClass(order.status)}`}
              >
                {order.status}
              </span>
            </div>

            {statusMessage(order.status) && (
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {statusMessage(order.status)}
                </p>
              </div>
            )}

            <div className="p-5 space-y-4">
              <OrderStatusTracker currentStatus={order.status} compact />

              <div className="space-y-2">
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
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between font-bold">
                <span className="text-gray-900 dark:text-gray-100">Total</span>
                <span className="text-primary">
                  Rp{order.total.toLocaleString()}
                </span>
              </div>

              <div className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(order.createdAt).toLocaleString("id-ID")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrdersPage;

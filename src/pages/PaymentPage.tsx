import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCartStore } from "../store/useCartStore";
import { useOrderStore } from "../store/useOrderStore";
import { useCheckoutStore } from "../store/useCheckoutStore";
import { useStoreConfig } from "../hooks/useStoreConfig";
import { usePromos } from "../hooks/usePromos";
import type { Order, PaymentMethod } from "../types";
import PaymentMethods from "../components/PaymentMethods";
import { ChevronLeft, PartyPopper } from "lucide-react";
import Skeleton from "../components/Skeleton";
import { buildOrderItemsPayload } from "../utils/buildOrderItemsPayload";
import type { OrderItemPayload } from "../utils/buildOrderItemsPayload";
import {
  isSnapshotCurrent,
  matchChangedLines,
  parsePriceChangedData,
  snapshotCartLines,
  type MatchedChange,
  type SubmittedLine,
} from "../utils/priceChange";
import PriceChangeDialog from "../components/PriceChangeDialog";
import { ApiError } from "../services/apiClient";
import { bareTableDesignator } from "../utils/tableDisplay";
import { createIdempotencyKey } from "../utils/idempotencyKey";

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, clearCart, subtotal } = useCartStore();
  const { applyServerPrices } = useCartStore();
  const createOrder = useOrderStore((state) => state.createOrder);
  const { data: checkoutData, clearCheckoutData } = useCheckoutStore();
  const store = searchParams.get("store");
  const {
    config,
    loading: configLoading,
    error: configError,
    refetch: refetchConfig,
  } = useStoreConfig(store);
  const { promos } = usePromos(store);

  const href = (path: string) => {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}table=${searchParams.get("table") || ""}&store=${searchParams.get("store") || ""}&session=${searchParams.get("session") || ""}`;
  };

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("QRIS");
  const [splitCount, setSplitCount] = useState(2);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // DR-11: pending price-change confirmation. Holds the submit-time cart
  // snapshot plus the matched backend mismatches. Never triggers a submit
  // on its own — only an explicit confirm does, and only while the live
  // cart still matches the snapshot.
  const [priceConflict, setPriceConflict] = useState<{
    snapshot: string;
    submitted: SubmittedLine[];
    changes: MatchedChange[];
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  // The page is the checkout attempt: a fresh mount is a fresh attempt, and a
  // retry after failure reuses this same component instance. So one ref per
  // mount gives P5-02's contract exactly — same key across retries of the
  // same attempt (backend dedupes on (store, idempotencyKey)), fresh key for a
  // genuinely new attempt. Mirrors FE-POS-App CheckoutModal's proven pattern.
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());
  // Synchronous re-entry guard on order submission: prevents a fast
  // double-tap (before React re-renders with `processing` true and the
  // button disabled) from issuing two orders. Reset on failure so the
  // customer can retry after a genuine error.
  const submitAttemptedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Checked before the missing-checkout-data guard below: a successful
  // handlePayment() clears the cart and checkout snapshot as part of
  // finishing the order, which would otherwise make that guard fire on the
  // very next render and permanently hide this screen — the customer would
  // never see their own successful order's confirmation. Only genuinely
  // invalid entry to this page (no checkout data, success never set)
  // should fall through to the guard below.
  if (success) {
    return (
      <div className="text-center py-20 space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
          <PartyPopper size={48} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Pesanan Berhasil!
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Pesananmu sedang diproses. Tunggu ya!
        </p>

        {confirmedOrder && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 space-y-3 border border-gray-50 dark:border-gray-700/50 shadow-sm mx-auto max-w-sm text-left">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                Nomor Pesanan
              </span>
              <span className="font-bold text-primary text-lg">
                {confirmedOrder.orderNumber || confirmedOrder.id}
              </span>
            </div>
            {confirmedOrder.tableNumber && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  Meja
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {bareTableDesignator(confirmedOrder.tableNumber) ?? confirmedOrder.tableNumber}
                </span>
              </div>
            )}
            {config.storeName && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  Restoran
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {config.storeName}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-4">
          <button
            onClick={() => navigate(href("/orders"))}
            className="bg-primary text-white px-8 py-3.5 rounded-2xl font-bold tap-scale shadow-lg shadow-primary/20"
          >
            Lihat Pesanan
          </button>
          <button
            onClick={() => navigate(href("/"))}
            className="text-primary font-bold text-sm"
          >
            Pesan Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!checkoutData || items.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-5xl mb-4">📋</p>
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Tidak ada data pembayaran.
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

  const { tableNumber, customerName } = checkoutData;
  // Derived from the live cart, not the subtotal snapshotted at checkout —
  // the submitted order payload below is also built from the live cart, so
  // this keeps what the customer is shown in sync with what they're
  // actually charged, even if the cart changed after Checkout (e.g. back
  // button + quantity edit).
  const subtotalValue = subtotal();
  // DR-17: meaningful only while the backend tax quote is valid
  // (status "ok"). Any other status renders placeholders/an error state
  // and blocks submission below — never a zero-tax total.
  const taxReady = config.status === "ok";
  const tax = Math.round(subtotalValue * config.taxRate);
  const serviceCharge = Math.round(
    subtotalValue * (config.serviceChargeRate ?? 0),
  );
  const total = subtotalValue + tax + serviceCharge;

  // DR-11: one guarded submission. Captures the cart snapshot the 409
  // indexes refer to; a PRICE_CHANGED mismatch opens the confirmation
  // dialog instead of retrying. Returns true on success.
  const submitOrder = async (
    payloadItems: OrderItemPayload[],
    snapshot: string,
    submitted: SubmittedLine[],
  ): Promise<boolean> => {
    const urlTable = searchParams.get("table");
    const urlStore = searchParams.get("store");
    try {
      const order = await createOrder({
        store: Number(urlStore),
        tableId: urlTable ? Number(urlTable) : undefined,
        customerName: customerName || undefined,
        paymentMethod: selectedMethod,
        session: searchParams.get("session") || undefined,
        idempotencyKey: idempotencyKeyRef.current,
        splitCount: selectedMethod === "Split Bill" ? splitCount : undefined,
        items: payloadItems,
      });
      clearCart();
      clearCheckoutData();
      setPriceConflict(null);
      setConfirmedOrder(order);
      setSuccess(true);
      return true;
    } catch (err) {
      // DR-11: a price mismatch must never auto-retry. Park the
      // snapshot-bound mismatches for explicit customer confirmation.
      if (err instanceof ApiError && err.status === 409 && err.code === "PRICE_CHANGED") {
        const mismatches = parsePriceChangedData(err.data);
        const changes =
          mismatches === null
            ? []
            : matchChangedLines(submitted, mismatches);
        if (changes.length > 0) {
          setPriceConflict({ snapshot, submitted, changes });
          return false;
        }
      }
      setPaymentError(
        err instanceof Error ? err.message : "Gagal membuat pesanan. Coba lagi.",
      );
      return false;
    }
  };

  const handlePayment = async () => {
    // DR-17: without a valid backend tax quote the displayed total cannot
    // match what the backend would charge — refuse to submit. The cart and
    // checkout data are untouched, so nothing is lost.
    if (!taxReady) return;
    if (submitAttemptedRef.current) return;
    submitAttemptedRef.current = true;
    setProcessing(true);
    setPaymentError(null);
    try {
      // Table AND store binding must come from the QR-derived URL context,
      // not from checkout state a customer could have edited — the QR link
      // already encodes the real table/store ids (see FE-POS-App
      // TableQRModal), and the backend looks orders up by exactly those ids.
      const payloadItems = buildOrderItemsPayload(items);
      const snapshot = snapshotCartLines(items);
      const submitted: SubmittedLine[] = items.map((item, i) => ({
        key: item.id,
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        productId: payloadItems[i]?.productId,
        bundleId: payloadItems[i]?.bundleId ?? undefined,
      }));
      await submitOrder(payloadItems, snapshot, submitted);
    } finally {
      // Allow a retry attempt on failure — the duplicate-flag is only meant
      // to stop an accidental double-tap from issuing two orders, not to
      // trap the customer out of trying again after a genuine failure.
      submitAttemptedRef.current = false;
      setProcessing(false);
    }
  };

  // DR-11: explicit customer confirmation. Resubmits only while the live
  // cart still matches the snapshot the 409 indexes were verified against,
  // with the accepted server prices and the SAME idempotency key (the 409
  // wrote nothing, so the key cannot replay a stale order).
  const handleConfirmPriceChange = async () => {
    if (!priceConflict || confirming) return;
    setConfirming(true);
    try {
      const liveItems = useCartStore.getState().items;
      if (!isSnapshotCurrent(liveItems, priceConflict.snapshot)) return;
      // Position-precise (F1): each change carries its submit-time cart
      // position — the backend `index` counts submitted lines in order, and
      // the snapshot check above guarantees the live cart still has that
      // exact order (same length, ids, customizations, prices). Reference
      // lookup recovers the position; product ID alone would hit every
      // same-product sibling sharing customizations/prices.
      const submitOrderLines = priceConflict.submitted;
      applyServerPrices(
        priceConflict.changes.map((c) => ({
          index: submitOrderLines.indexOf(c.line),
          price: c.currentPrice,
        })),
      );
      const updated = useCartStore.getState().items;
      const payloadItems = buildOrderItemsPayload(updated);
      const snapshot = snapshotCartLines(updated);
      const submitted: SubmittedLine[] = updated.map((item, i) => ({
        key: item.id,
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        productId: payloadItems[i]?.productId,
        bundleId: payloadItems[i]?.bundleId ?? undefined,
      }));
      await submitOrder(payloadItems, snapshot, submitted);
    } finally {
      setConfirming(false);
    }
  };

  const handleDeclinePriceChange = () => {
    setPriceConflict(null);
  };

  // Live staleness: the cart changed after the 409 (or while the dialog is
  // open) — withhold confirm and send the customer back to the cart.
  const conflictStale =
    priceConflict !== null &&
    !isSnapshotCurrent(items, priceConflict.snapshot);

  if (loading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3">
          <Skeleton width="2rem" height="2rem" borderRadius="50%" />
          <Skeleton width="30%" height="2rem" borderRadius="0.5rem" />
        </div>
        <Skeleton width="100%" height="14rem" borderRadius="1.5rem" />
        <Skeleton width="100%" height="12rem" borderRadius="1.5rem" />
        <Skeleton width="100%" height="3rem" borderRadius="1rem" />
      </div>
    );
  }

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
          Pembayaran
        </h2>
      </div>

      {paymentError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">
            {paymentError}
          </p>
        </div>
      )}

      {/* DR-17: tax-quote status. A missing/invalid quote blocks checkout
          with an explicit message — the summary below never presents a
          zero-tax total as final, and the pay button stays disabled. */}
      {configError && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
          <p className="text-amber-700 dark:text-amber-300 text-sm font-medium">
            {configError}
          </p>
          <button
            type="button"
            onClick={refetchConfig}
            className="px-4 py-2 rounded-xl font-bold text-sm bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
          >
            Coba lagi
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 space-y-3 border border-gray-50 dark:border-gray-700/50 shadow-sm">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">
          Ringkasan Pesanan
        </h3>
        {config.storeName && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Restoran</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {config.storeName}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Meja</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {bareTableDesignator(tableNumber) ?? tableNumber}
          </span>
        </div>
        {customerName && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Pelanggan</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {customerName}
            </span>
          </div>
        )}
        <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
            <span className="text-gray-700 dark:text-gray-300">
              Rp{subtotalValue.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Pajak ({taxReady ? `${Math.round(config.taxRate * 100)}%` : "…"})
            </span>
            <span className="text-gray-700 dark:text-gray-300">
              {taxReady ? `Rp${tax.toLocaleString()}` : "…"}
            </span>
          </div>
          {/* DR-17: QR service charge is not applicable when the quote
              marks it null — the row is hidden and nothing is added to the
              total. A numeric 0 is shown as 0% and adds nothing. */}
          {config.serviceChargeRate !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Service (
                {taxReady
                  ? `${Math.round(config.serviceChargeRate * 100)}%`
                  : "…"}
                )
              </span>
              <span className="text-gray-700 dark:text-gray-300">
                {taxReady ? `Rp${serviceCharge.toLocaleString()}` : "…"}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-gray-900 dark:text-gray-100">Total</span>
          <span className="text-primary">
            {taxReady ? `Rp${total.toLocaleString()}` : "…"}
          </span>
        </div>
      </div>

      {promos.length > 0 && (
        <div className="bg-primary/5 dark:bg-primary/10 rounded-3xl p-5 space-y-3 border border-primary/15 dark:border-primary/20">
          <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">
            🎁 Promo Berjalan
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Promo diproses oleh kasir saat pembayaran. Sebutkan kode promo
            berikut ke kasir untuk mendapatkan penawaran.
          </p>
          <div className="space-y-2">
            {promos.slice(0, 3).map((promo) => (
              <div
                key={promo.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300 min-w-0 truncate">
                  {promo.name}
                </span>
                {promo.code && (
                  <span className="bg-white dark:bg-gray-800 border border-primary/20 text-primary text-xs font-mono font-bold px-2.5 py-1 rounded-lg shrink-0">
                    {promo.code}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <PaymentMethods
        selectedMethod={selectedMethod}
        onSelect={setSelectedMethod}
        splitCount={splitCount}
        onSplitChange={setSplitCount}
        // DR-17 (F1): the split-bill amount must come from the verified
        // total only — null withholds it while the quote is not valid.
        total={taxReady ? total : null}
      />

      {/* Fixed on mobile so the primary action stays reachable without
          scrolling past the order summary; bottom-[64px] clears the fixed
          mobile bottom nav (Layout.tsx), which sits below it. Reverts to a
          normal in-flow button on desktop (md:), where there is no bottom
          nav. */}
      <div className="fixed inset-x-0 bottom-[64px] z-40 bg-secondary/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-100 dark:border-gray-700/50 px-4 py-3 md:static md:inset-auto md:z-auto md:bg-transparent md:dark:bg-transparent md:backdrop-blur-none md:border-0 md:px-0 md:py-0">
        <button
          onClick={handlePayment}
          disabled={processing || !taxReady}
          className="w-full bg-primary text-white py-4 rounded-2xl font-bold tap-scale disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Memproses...
            </span>
          ) : taxReady ? (
            `Bayar Sekarang — Rp${total.toLocaleString()}`
          ) : configLoading ? (
            "Memuat…"
          ) : (
            "Bayar Sekarang"
          )}
        </button>
      </div>

      <PriceChangeDialog
        open={priceConflict !== null}
        changes={(priceConflict?.changes || []).map((c) => ({
          name: c.line.name,
          quantity: c.line.quantity,
          expectedPrice: c.expectedPrice,
          currentPrice: c.currentPrice,
        }))}
        confirming={confirming}
        stale={conflictStale}
        onConfirm={handleConfirmPriceChange}
        onDecline={handleDeclinePriceChange}
      />
    </div>
  );
};

export default PaymentPage;

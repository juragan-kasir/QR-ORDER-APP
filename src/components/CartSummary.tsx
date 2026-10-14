import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useStoreConfig } from '../hooks/useStoreConfig';

interface CartSummaryProps {
  showDetails?: boolean;
}

const CartSummary: React.FC<CartSummaryProps> = ({ showDetails = true }) => {
  const { subtotal, totalItems } = useCartStore();
  const [searchParams] = useSearchParams();
  const store = searchParams.get('store');
  const { config, error: configError, refetch: refetchConfig } = useStoreConfig(store);

  const base = subtotal();
  // DR-17: amounts are only meaningful with a valid backend tax quote.
  // Otherwise the summary shows placeholders/an error — never a zero-tax
  // total that the backend would not honor.
  const taxReady = config.status === "ok";
  const tax = Math.round(base * config.taxRate);
  const serviceCharge = Math.round(base * (config.serviceChargeRate ?? 0));
  const total = base + tax + serviceCharge;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 space-y-4 border border-gray-50 dark:border-gray-700/50 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-600 dark:text-gray-400 font-medium">Total Item</span>
        <span className="font-bold text-gray-900 dark:text-gray-100">{totalItems()}</span>
      </div>
      {showDetails && (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
            <span className="text-gray-700 dark:text-gray-300">Rp{base.toLocaleString()}</span>
          </div>
          {configError ? (
            <div className="space-y-2 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {configError}
              </p>
              <button
                type="button"
                onClick={refetchConfig}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
              >
                Coba lagi
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Pajak ({taxReady ? `${Math.round(config.taxRate * 100)}%` : "…"})
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {taxReady ? `Rp${tax.toLocaleString()}` : "…"}
                </span>
              </div>
              {/* DR-17: hidden when the QR quote marks service charge not
                  applicable (null); a numeric 0 is shown and adds nothing. */}
              {config.serviceChargeRate !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Service Charge (
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
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between font-bold text-lg">
                <span className="text-gray-900 dark:text-gray-100">Total</span>
                <span className="text-primary">
                  {taxReady ? `Rp${total.toLocaleString()}` : "…"}
                </span>
              </div>
            </>
          )}
        </>
      )}
      {!showDetails && (
        <div className="flex justify-between font-bold text-lg">
          <span className="text-gray-900 dark:text-gray-100">Total</span>
          <span className="text-primary">
            {/* DR-17 (N1): same rule as the detailed view — no zero-tax
                total while the quote is idle/loading/missing/error. */}
            {taxReady ? `Rp${total.toLocaleString()}` : "…"}
          </span>
        </div>
      )}
    </div>
  );
};

export default CartSummary;
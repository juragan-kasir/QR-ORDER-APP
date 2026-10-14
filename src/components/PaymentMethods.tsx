import React from 'react';
import type { PaymentMethod } from '../types';

interface PaymentMethodsProps {
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  splitCount: number;
  onSplitChange: (count: number) => void;
  // DR-17 (F1): null while the backend tax quote is idle/loading/missing/
  // error — the split amount must not be derived from an unverified total.
  total: number | null;
}

const paymentOptions: { id: PaymentMethod; label: string; icon: string; description: string }[] = [
  { id: 'QRIS', label: 'QRIS', icon: '📱', description: 'Scan QR untuk bayar' },
  { id: 'E-Wallet', label: 'E-Wallet', icon: '👛', description: 'GoPay, OVO, Dana, dll.' },
  { id: 'Kartu Kredit', label: 'Kartu Kredit', icon: '💳', description: 'Visa, Mastercard, dll.' },
  { id: 'Tunai', label: 'Tunai', icon: '💵', description: 'Bayar tunai di kasir' },
  { id: 'Postpaid', label: 'Postpaid', icon: '🧾', description: 'Bayar setelah makan' },
  { id: 'Split Bill', label: 'Split Bill', icon: '✂️', description: 'Bagi tagihan' },
];

const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  selectedMethod,
  onSelect,
  splitCount,
  onSplitChange,
  total,
}) => {
  return (
    <div className="space-y-4">
      <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">Pilih Metode Pembayaran</h4>
      <div className="grid grid-cols-2 gap-3">
        {paymentOptions.map((option) => {
          const isSelected = selectedMethod === option.id;
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-md shadow-primary/10'
                  : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="text-2xl mb-2">{option.icon}</div>
              <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{option.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.description}</div>
            </button>
          );
        })}
      </div>
      {selectedMethod === 'Split Bill' && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 space-y-3 border border-gray-100 dark:border-gray-700">
          <h5 className="font-bold text-sm text-gray-900 dark:text-gray-100">Jumlah Pembagi</h5>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onSplitChange(Math.max(2, splitCount - 1))}
              className="w-11 h-11 rounded-full bg-white dark:bg-gray-700 font-bold text-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm"
            >
              −
            </button>
            <span className="text-2xl font-bold flex-1 text-center text-gray-900 dark:text-gray-100">
              {splitCount}
            </span>
            <button
              onClick={() => onSplitChange(splitCount + 1)}
              className="w-11 h-11 rounded-full bg-white dark:bg-gray-700 font-bold text-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm"
            >
              +
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Setiap orang membayar:{' '}
            <span className="font-bold text-primary">
              {/* DR-17 (F1): never derive a per-person amount from an
                  unverified total — withhold it until the tax quote is
                  valid, exactly like the main checkout total. */}
              {total === null ? "…" : `Rp${(total / splitCount).toLocaleString()}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentMethods;

import React from 'react';
import { CheckCircle2, Clock, ChefHat, Bike, MapPin, XCircle, Ban, TimerOff } from 'lucide-react';
import type { OrderStatus } from '../types';

interface OrderStatusTrackerProps {
  currentStatus: OrderStatus;
  compact?: boolean;
}

const standardSteps: { id: OrderStatus; label: string; icon: React.FC<{size?: number}> }[] = [
  { id: 'Menunggu Konfirmasi', label: 'Menunggu', icon: Clock },
  { id: 'Diproses', label: 'Diproses', icon: CheckCircle2 },
  { id: 'Sedang Dimasak', label: 'Dimasak', icon: ChefHat },
  { id: 'Siap Diantar', label: 'Siap', icon: Bike },
  { id: 'Sudah Diantar', label: 'Sampai', icon: MapPin },
];

const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = ({
  currentStatus,
  compact = false,
}) => {
  const isRejected = currentStatus === 'Ditolak';
  const isCancelled = currentStatus === 'Dibatalkan';
  const isExpired = currentStatus === 'Kedaluwarsa';
  const isTerminalNegative = isRejected || isCancelled || isExpired;

  if (isTerminalNegative) {
    const NegativeIcon = isRejected ? XCircle : isExpired ? TimerOff : Ban;
    const label = isRejected
      ? 'Pesanan Ditolak'
      : isExpired
        ? 'Pesanan Kedaluwarsa'
        : 'Pesanan Dibatalkan';
    const subtext = isRejected
      ? 'Pesanan ini tidak dapat diproses oleh restoran.'
      : isExpired
        ? 'Pesanan tidak dibayar dalam batas waktu, jadi dibatalkan otomatis. Silakan pesan lagi.'
        : 'Pesanan ini telah dibatalkan.';

    return (
      <div
        className={`${compact ? 'py-4 px-5' : 'p-6'} bg-red-50/70 dark:bg-red-950/20 rounded-3xl border border-red-200 dark:border-red-900/40 text-center space-y-2`}
      >
        <div className="inline-flex p-3 rounded-full bg-destructive text-white shadow-md shadow-destructive/20">
          <NegativeIcon size={compact ? 22 : 28} />
        </div>
        <div>
          <h4 className="font-bold text-sm text-destructive">{label}</h4>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{subtext}</p>
        </div>
      </div>
    );
  }

  const currentIndex = standardSteps.findIndex((s) => s.id === currentStatus);

  return (
    <div
      className={`${compact ? 'py-4' : 'p-6'} bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-700/50`}
    >
      <div className="relative flex justify-between">
        <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-0" />
        {standardSteps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = currentIndex >= 0 && index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div
              key={step.id}
              className={`flex flex-col items-center gap-2 z-10 ${compact ? 'scale-75' : ''}`}
            >
              <div
                className={`p-3 rounded-full transition-all ${
                  isCompleted
                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <Icon size={compact ? 16 : 20} />
              </div>
              <span
                className={`text-[10px] font-bold text-center ${
                  isCompleted || isCurrent
                    ? 'text-primary'
                    : 'text-gray-400 dark:text-gray-600'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mt-4">
        Status: {currentStatus}
      </p>
    </div>
  );
};

export default OrderStatusTracker;

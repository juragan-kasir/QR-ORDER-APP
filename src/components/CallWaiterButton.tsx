import React, { useState, useRef, useId } from 'react';
import { Headphones } from 'lucide-react';
import { useOrderStore } from '../store/useOrderStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSearchParams } from 'react-router-dom';
import LengthCounter from './LengthCounter';
import { FIELD_LIMITS, limitBorder } from '../utils/fieldLimits';

interface CallWaiterButtonProps {
  orderId?: string;
}

const waiterRequestTypes: { key: string; label: string; icon: string }[] = [
  { key: 'sendok', label: 'Sendok', icon: '🥄' },
  { key: 'tisu', label: 'Tisu', icon: '🧻' },
  { key: 'refill', label: 'Refill', icon: '🥤' },
  { key: 'bill', label: 'Bill', icon: '🧾' },
  { key: 'call', label: 'Panggil Pelayan', icon: '🧑‍🍳' },
];

const CallWaiterButton: React.FC<CallWaiterButtonProps> = ({ orderId: orderIdProp }) => {
  const submitWaiterRequest = useOrderStore((state) => state.submitWaiterRequest);
  const activeOrderId = useOrderStore((state) => state.activeOrderId);
  const activeOrderStoreId = useOrderStore((state) => state.activeOrderStoreId);
  const activeOrderTableId = useOrderStore((state) => state.activeOrderTableId);
  const { settings } = useSettingsStore();
  const [searchParams] = useSearchParams();
  const [showMenu, setShowMenu] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const notesCounterId = useId();
  const [lastRequest, setLastRequest] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous re-entry guard: a fast second tap before React re-renders
  // with `submitting` true could otherwise send two identical requests.
  const submitInFlight = useRef(false);

  const handleSubmit = async () => {
    if (!selectedType || submitInFlight.current) return;
    submitInFlight.current = true;
    setSubmitting(true);
    setRequestError(null);
    try {
      const urlStore = searchParams.get('store');
      const urlTable = searchParams.get('table');
      const storeId = urlStore || settings.storeId || '1';
      const tableId = urlTable
        ? Number(urlTable)
        : settings.tableNumber
          ? Number(settings.tableNumber)
          : undefined;
      const label = waiterRequestTypes.find((t) => t.key === selectedType)?.label || selectedType;
      // An explicit orderId prop is a deliberate, caller-owned reference and
      // always trusted. The ambient activeOrderId is only trusted when it
      // was actually set for THIS table/store — otherwise a customer who
      // scanned a different QR after placing an earlier order elsewhere
      // could silently attach this request to that unrelated order.
      const activeOrderMatchesContext =
        activeOrderStoreId === urlStore && activeOrderTableId === urlTable;
      const rawOrderId =
        orderIdProp ||
        (activeOrderMatchesContext ? (activeOrderId ?? undefined) : undefined);
      const validOrderId =
        rawOrderId != null && /^\d+$/.test(String(rawOrderId).trim())
          ? String(rawOrderId).trim()
          : undefined;
      await submitWaiterRequest({
        store: Number(storeId),
        type: selectedType,
        tableId,
        orderId: validOrderId,
        notes: notes.trim() || undefined,
      });
      setLastRequest(label);
      setSelectedType(null);
      setNotes('');
      setShowMenu(false);
      submitInFlight.current = false;
      setTimeout(() => setLastRequest(null), 3000);
    } catch (err) {
      submitInFlight.current = false;
      setLastRequest(null);
      setRequestError(
        err instanceof Error
          ? err.message
          : 'Permintaan gagal dikirim. Coba lagi.',
      );
      setTimeout(() => setRequestError(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {lastRequest && (
        <div className="bg-green-500 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 text-sm font-bold">
          <span>✅</span> Permintaan "{lastRequest}" terkirim!
        </div>
      )}
      {requestError && (
        <div className="bg-destructive/10 border border-destructive/25 px-4 py-3 rounded-2xl text-destructive text-sm font-medium">
          {requestError}
        </div>
      )}
      <button
        onClick={() => {
          setShowMenu(!showMenu);
          setSelectedType(null);
        }}
        disabled={submitting}
        className="w-full bg-primary text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow tap-scale disabled:opacity-50"
      >
        <Headphones size={20} />
        {submitting ? 'Mengirim...' : 'Pilih Permintaan'}
      </button>
      {showMenu && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3 space-y-3 border border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            {waiterRequestTypes.map((t) => (
              <button
                key={t.key}
                onClick={() => setSelectedType(t.key)}
                disabled={submitting}
                className={`w-full text-left px-3 py-3 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 ${
                  selectedType === t.key
                    ? 'bg-primary/10 text-primary border-primary/40'
                    : 'text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-700 hover:bg-primary/5'
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan (opsional), mis. bawa 2 sendok"
              rows={2}
              maxLength={FIELD_LIMITS.DESCRIPTION}
              aria-describedby={notesCounterId}
              className={`w-full px-3 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-gray-700/50 border ${limitBorder(notes, FIELD_LIMITS.DESCRIPTION, 'border-gray-100 dark:border-gray-700 focus:ring-primary/40')} text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2`}
            />
            <LengthCounter id={notesCounterId} length={notes.length} max={FIELD_LIMITS.DESCRIPTION} />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!selectedType || submitting}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Headphones size={16} />
            {selectedType ? `Kirim ${waiterRequestTypes.find((t) => t.key === selectedType)?.label || ''}` : 'Pilih jenis permintaan'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CallWaiterButton;

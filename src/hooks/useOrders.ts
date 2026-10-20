import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { fetchCustomerOrders } from "../services/orderService";
import { ApiError } from "../services/apiClient";
import type { Order } from "../types";

interface UseOrdersResult {
  orders: Order[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  // DR-10: when the last successful poll completed — consumers render it so
  // backed-off or cached data is visibly stale, never silently authoritative.
  lastFetchedAt: number | null;
}

const BASE_POLL_INTERVAL = 10000;
const MAX_POLL_INTERVAL = 60000;
const POLL_BACKOFF_MULTIPLIER = 1.5;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 1000;

// Errors that must NOT be auto-retried: the backend's authorization/tenant
// boundary (401/403/404) and rate-limit responses (429) indicate a state
// change is not going to happen by retrying — hammering a 403 retries an
// unauthorized call, and hammering a 429 makes the rate limiting worse.
// Only transient failures (network/timeout/5xx) get the bounded backoff
// retry below.
function isTransientError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return err.status === 0 || (err.status >= 500 && err.status < 600);
}

export function useOrders(
  storeId: string | null,
  options?: { tableId?: string; session?: string; page?: number; limit?: number },
): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [trigger, setTrigger] = useState(0);
  const [, startTransition] = useTransition();
  const prevStatusesRef = useRef<Map<string, string>>(new Map());
  const pollIntervalRef = useRef<number>(BASE_POLL_INTERVAL);
  const retryCountRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // Self-scheduling: reads pollIntervalRef.current fresh every time it
  // fires, instead of a setInterval whose delay is fixed at creation time —
  // that fixed-delay approach is what previously defeated the backoff
  // below (the computed interval was updated but the already-running timer
  // never picked up the new value, so polling stayed at a flat 10s
  // cadence). Skips scheduling entirely while the tab is hidden; the
  // visibility handler resumes polling (and, via the fetch it triggers,
  // scheduling) when the tab becomes visible again.
  const clearScheduledPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const scheduleNextPoll = useCallback(() => {
    clearScheduledPoll();
    if (document.hidden) return;
    pollTimerRef.current = setTimeout(() => {
      setTrigger((t) => t + 1);
    }, pollIntervalRef.current);
  }, [clearScheduledPoll]);

  useEffect(() => {
    let cancelled = false;

    startTransition(async () => {
      if (!storeId) {
        setLoading(false);
        return;
      }
      setLoading(false);
      setError(null);
      try {
        const result = await fetchCustomerOrders(storeId, optionsRef.current);
        if (cancelled) return;
        const newOrders = result.orders;
        const newStatuses = new Map<string, string>();
        for (const o of newOrders) {
          newStatuses.set(o.id, o.status);
        }
        let hasChange = false;
        for (const [id, status] of newStatuses) {
          const prev = prevStatusesRef.current.get(id);
          if (prev && prev !== status) {
            hasChange = true;
            const label =
              status === "Ditolak"
                ? "Ditolak oleh kasir"
                : status === "Dibatalkan"
                  ? "Dibatalkan"
                  : status === "Kedaluwarsa"
                    ? "Pesanan kedaluwarsa: belum dibayar dalam batas waktu"
                    : `Status berubah: ${status}`;
            if ("Notification" in window) {
              Notification.requestPermission()
                .then(() => {
                  new Notification("BISA-MAKAN", { body: label, tag: id });
                })
                .catch(() => {
                  /* ignore */
                });
            }
          }
        }
        prevStatusesRef.current = newStatuses;
        setOrders(newOrders);
        setTotal(result.total);
        setLastFetchedAt(Date.now());
        retryCountRef.current = 0;
        if (hasChange) {
          pollIntervalRef.current = BASE_POLL_INTERVAL;
        } else {
          pollIntervalRef.current = Math.min(
            pollIntervalRef.current * POLL_BACKOFF_MULTIPLIER,
            MAX_POLL_INTERVAL,
          );
        }
        scheduleNextPoll();
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Gagal memuat pesanan";
        setError(msg);
        if (!isTransientError(err)) return;
        retryCountRef.current += 1;
        if (retryCountRef.current <= MAX_RETRY_ATTEMPTS) {
          const delay =
            RETRY_BASE_DELAY * Math.pow(2, retryCountRef.current - 1);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            setTrigger((t) => t + 1);
          }, delay);
        }
      }
    });

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [
    storeId,
    options?.tableId,
    options?.session,
    options?.page,
    options?.limit,
    trigger,
    scheduleNextPoll,
  ]);

  useEffect(() => {
    if (!storeId) return;

    const handleVisibility = () => {
      if (!document.hidden) {
        setTrigger((t) => t + 1);
      } else {
        clearScheduledPoll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearScheduledPoll();
    };
  }, [storeId, clearScheduledPoll]);

  const refetch = useCallback(() => { setTrigger((t) => t + 1); }, []);

  return { orders, total, loading, error, refetch, lastFetchedAt };
}

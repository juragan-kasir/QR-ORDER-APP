import { useState } from "react";
import { fetchStoreConfig } from "../services/storeService";
import type { StoreConfig, TaxQuoteStatus } from "../services/storeService";
import { useFetchEffect } from "./useFetch";

interface UseStoreConfigResult {
  config: StoreConfig;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const DEFAULT_CONFIG: StoreConfig = {
  taxRate: 0,
  serviceChargeRate: null,
  storeName: "",
  status: "idle",
};

// DR-17: user-facing messages keyed by quote status. Neither message
// exposes internal server details; both are safe to render verbatim.
// "idle"/"ok" carry no error.
const STATUS_ERROR_MESSAGE: Record<TaxQuoteStatus, string | null> = {
  idle: null,
  ok: null,
  missing:
    "Konfigurasi pajak outlet ini belum lengkap. Pesanan tidak dapat dilanjutkan. Silakan hubungi staf.",
  error: "Gagal memuat konfigurasi pajak. Periksa koneksi internet, lalu coba lagi.",
};

export function useStoreConfig(storeId: string | null): UseStoreConfigResult {
  const [config, setConfig] = useState<StoreConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isPending, refetch } = useFetchEffect(async (cancelled) => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStoreConfig(storeId);
      if (cancelled()) return;
      setConfig(result);
      // DR-17: only "ok" carries usable rates. "missing"/"error" surface
      // as a blocking message — never as a silent zero-tax config.
      setError(STATUS_ERROR_MESSAGE[result.status]);
    } catch (err) {
      if (!cancelled()) {
        setError(err instanceof Error ? err.message : "Gagal memuat konfigurasi");
        setConfig({ ...DEFAULT_CONFIG, status: "error" });
      }
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, [storeId]);

  return { config, loading: loading || isPending, error, refetch };
}

import apiClient, { ApiError } from "./apiClient";

interface TaxQuoteData {
  rate: unknown;
  serviceChargeRate: unknown;
}

interface TaxQuoteResponse {
  success: boolean;
  message: string;
  data?: TaxQuoteData | null;
}

interface LocationPublicItem {
  id: number;
  store: number;
  name: string;
  city: string;
  province: string;
  detailLocation: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

interface LocationPublicResponse {
  success: boolean;
  message: string;
  data: LocationPublicItem[];
}

export type TaxQuoteStatus = "idle" | "ok" | "missing" | "error";

export interface StoreConfig {
  // DR-17: fraction (backend percent / 100); meaningful only when
  // status === "ok". Never a silent default — unknown/failed quotes
  // resolve to "missing"/"error" instead of zero.
  taxRate: number;
  // DR-17: null = not applicable on QR (hide the row, exclude from the
  // total). A numeric 0 is shown as 0% and adds nothing. Never derive this
  // from store tax rows; the quote already resolved store/global config.
  serviceChargeRate: number | null;
  storeName: string;
  status: TaxQuoteStatus;
}

const DEFAULT_STORE_CONFIG: StoreConfig = {
  taxRate: 0,
  serviceChargeRate: null,
  storeName: "",
  status: "idle",
};

// In-memory only (module-scoped, never persisted to localStorage/
// sessionStorage — lost on reload, exactly like every other unmounted
// hook's state was before this cache existed). Keyed by storeId so two
// stores can never share a config. Holds the *raw* (throwing) request
// promise, not a resolved value — a failed request is evicted immediately
// (see the .catch below) rather than cached, so it can never be mistaken
// for a successful config on a later call; only a genuinely successful
// response is ever reused across callers/pages for the same storeId.
const storeConfigCache = new Map<string, Promise<StoreConfig>>();

// DR-17: resolves the QR tax quote through the backend's channel-aware
// endpoint (store-or-global PPN already resolved server-side, QR service
// charge marked not applicable). Returns a status the UI must honor:
// "ok" (explicit rate, including 0), "missing" (documented setup error),
// or "error" (anything else). Never resolves an unknown/failed quote to a
// valid zero-tax config.
async function fetchTaxQuote(storeId: string): Promise<StoreConfig> {
  let rate: number;
  let serviceChargeRate: number | null;
  try {
    const quoteRes = await apiClient.get<TaxQuoteResponse>(
      "/order/customer-tax-rate",
      { params: { store: storeId, channel: "qr" } },
    );
    const data = quoteRes.data?.data;
    // The contract guarantees a numeric percent rate. Anything else —
    // absent body, wrong types, negatives — is unusable, never zero.
    if (
      !data ||
      typeof data.rate !== "number" ||
      !Number.isFinite(data.rate) ||
      data.rate < 0
    ) {
      return { ...DEFAULT_STORE_CONFIG, status: "error" };
    }
    rate = data.rate / 100;
    // The QR contract fixes serviceChargeRate to null (not charged). A
    // numeric 0 is equivalent in the total and shown as 0%. A nonzero
    // value contradicts the contract — the backend never charges it on QR
    // orders, so adopting it would invent a fee: fail safe instead.
    if (data.serviceChargeRate === null || data.serviceChargeRate === 0) {
      serviceChargeRate = data.serviceChargeRate;
    } else if (
      typeof data.serviceChargeRate === "number" &&
      Number.isFinite(data.serviceChargeRate) &&
      data.serviceChargeRate > 0
    ) {
      return { ...DEFAULT_STORE_CONFIG, status: "error" };
    } else {
      return { ...DEFAULT_STORE_CONFIG, status: "error" };
    }
  } catch (err) {
    // The backend distinguishes client/setup problems with machine-readable
    // codes. Only PPN_MISSING (or a legacy codeless 400 from backends that
    // predate the code) means the outlet has no usable PPN configuration;
    // any other non-empty code (e.g. INVALID_STORE, INVALID_CHANNEL) is a
    // different problem and must use the transient error state instead.
    if (err instanceof ApiError && err.status === 400) {
      if (!err.code || err.code === "PPN_MISSING") {
        return { ...DEFAULT_STORE_CONFIG, status: "missing" };
      }
      return { ...DEFAULT_STORE_CONFIG, status: "error" };
    }
    return { ...DEFAULT_STORE_CONFIG, status: "error" };
  }
  return {
    taxRate: rate,
    serviceChargeRate,
    storeName: "",
    status: "ok",
  };
}

async function fetchStoreName(storeId: string): Promise<string> {
  try {
    const locRes = await apiClient.get<LocationPublicResponse>(
      "/location/get-location-public",
    );
    const locations = locRes.data.data || [];
    const store = locations.find(
      (l) => l.store === Number(storeId) || l.id === Number(storeId),
    );
    return store?.name || "";
  } catch {
    return "";
  }
}

async function fetchStoreConfigFromApi(storeId: string): Promise<StoreConfig> {
  // Store name and tax quote resolve independently: a failed quote must
  // not hide the store name, and a failed location lookup must not mask
  // a valid (or invalid) tax quote.
  const [quote, storeName] = await Promise.all([
    fetchTaxQuote(storeId),
    fetchStoreName(storeId),
  ]);
  return { ...quote, storeName };
}

export async function fetchStoreConfig(storeId: string): Promise<StoreConfig> {
  try {
    let pending = storeConfigCache.get(storeId);
    if (!pending) {
      pending = fetchStoreConfigFromApi(storeId);
      storeConfigCache.set(storeId, pending);
      // Never cache a failure as if it were data: if this request fails,
      // drop it from the cache so the next call (for this storeId, from any
      // consumer) retries fresh instead of reusing a broken result.
      pending.catch(() => {
        if (storeConfigCache.get(storeId) === pending) {
          storeConfigCache.delete(storeId);
        }
      });
    }
    const result = await pending;
    // DR-17: failures resolve as values ("missing"/"error"), never as
    // rejections — so the catch-evict above cannot see them. Evict
    // non-ok results here instead: a retry (hook refetch, "Coba lagi",
    // or remount) must issue a fresh quote request, and a stale
    // non-ok entry must never pin a store to a broken state.
    if (result.status !== "ok" && storeConfigCache.get(storeId) === pending) {
      storeConfigCache.delete(storeId);
    }
    return result;
  } catch {
    // Preserves the exact pre-existing external contract: fetchStoreConfig
    // itself never rejects, it always resolves — to a status-bearing config
    // on success, to a "missing"/"error" status on failure. Callers must
    // branch on status; only "ok" carries usable rates.
    return { ...DEFAULT_STORE_CONFIG, status: "error" as const };
  }
}

export interface StoreLocation {
  id: number;
  store: number;
  name: string;
  city: string;
  province: string;
}

export async function fetchPublicStores(): Promise<StoreLocation[]> {
  try {
    const { data } = await apiClient.get<LocationPublicResponse>(
      "/location/get-location-public",
    );
    return data.data || [];
  } catch {
    return [];
  }
}

// DR-23 K: the idempotency key must survive a reload/timeout-after-success,
// otherwise retrying the same logical checkout attempt mints a fresh key and
// the backend creates a SECOND order. Keys are scoped per cart signature
// (store + table + exact lines) in sessionStorage: same cart after a reload
// reuses the key (backend dedupes on (store, idempotencyKey)); any cart
// change yields a fresh key for what is genuinely a new attempt. Tab-scoped
// sessionStorage (not localStorage) so two tabs can't share an attempt.
const PREFIX = "bisa-makan-attempt-key:";

export interface AttemptLine {
  id: string;
  quantity: number;
  // Stable discriminator for the line's customization (add-ons, options).
  // Unit price is deliberately EXCLUDED: a server-confirmed price update
  // (409 PRICE_CHANGED → confirm) must resubmit under the SAME key — the
  // 409 wrote nothing, so the key cannot replay a stale order, while a
  // fresh key is unnecessary. Quantity/identity/customization changes yield
  // a fresh key for what is genuinely a new attempt.
  customizationKey?: string;
}

function hashSignature(raw: string): string {
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function cartSignature(
  items: AttemptLine[],
  store: string | null,
  table: string | null,
): string {
  const lines = [...items]
    .map((i) => `${i.id}x${i.quantity}#${i.customizationKey ?? ""}`)
    .sort()
    .join(",");
  return hashSignature(`${store || ""}|${table || ""}|${lines}`);
}

function storage(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function mintKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getAttemptKey(signature: string): string {
  const store = storage();
  const storageKey = `${PREFIX}${signature}`;
  if (store) {
    try {
      const existing = store.getItem(storageKey);
      if (existing) return existing;
      const fresh = mintKey();
      store.setItem(storageKey, fresh);
      return fresh;
    } catch {
      // Storage unavailable (private mode/SSR) — fall through to ephemeral.
    }
  }
  return mintKey();
}

export function clearAttemptKey(signature: string): void {
  try {
    storage()?.removeItem(`${PREFIX}${signature}`);
  } catch {
    // Best-effort cleanup only.
  }
}

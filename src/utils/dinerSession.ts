// D-10 (DR-24): a diner sees only their own orders. The identity is a
// random token created on THIS device the first time it orders at a store
// and kept in localStorage — never the `session` printed in the table QR,
// which every diner who scans that table shares.
//
// The backend accepts [A-Za-z0-9_-]{8,128}; a UUID fits.

const KEY_PREFIX = "bisamakan-diner-session:";
const VALID = /^[A-Za-z0-9_-]{8,128}$/;

const newToken = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const storage = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

// In-memory fallback when storage is blocked (private mode): stable for
// this page's lifetime, so the diner still sees the order they just placed.
const memory = new Map<string, string>();

export function getDinerSession(storeId: string | null | undefined): string | undefined {
  if (!storeId) return undefined;
  const key = `${KEY_PREFIX}${storeId}`;
  const store = storage();
  let existing: string | null | undefined;
  try {
    existing = store?.getItem(key);
  } catch {
    existing = null; // storage blocked: use this page's in-memory token
  }
  existing = existing || memory.get(key);
  if (existing && VALID.test(existing)) return existing;
  const token = newToken();
  memory.set(key, token);
  try {
    store?.setItem(key, token);
  } catch {
    // storage full/blocked: the in-memory token still works for this visit
  }
  return token;
}

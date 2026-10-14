import type { CartItem } from "../types";

// DR-11: guarded PRICE_CHANGED confirmation support. AllLine identity and
// snapshot logic lives here (pure, tested) so PaymentPage stays thin.

// One validated backend mismatch entry (wire shape: response `items`).
export interface PriceMismatch {
  index: number;
  productId?: number | string;
  bundleId?: number | string;
  expectedPrice: number;
  currentPrice: number;
}

// One submitted cart line, captured at submit time for identity checks.
export interface SubmittedLine {
  key: string;
  name: string;
  unitPrice: number;
  quantity: number;
  productId?: number;
  bundleId?: number;
}

export interface MatchedChange {
  line: SubmittedLine;
  expectedPrice: number;
  currentPrice: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseMismatch(entry: unknown): PriceMismatch | null {
  if (!isRecord(entry)) return null;
  if (!isNonNegativeInteger(entry.index)) return null;
  if (!isNonNegativeInteger(entry.expectedPrice)) return null;
  if (!isNonNegativeInteger(entry.currentPrice)) return null;
  const { productId, bundleId } = entry;
  const hasProduct =
    typeof productId === "number" || typeof productId === "string";
  const hasBundle =
    typeof bundleId === "number" || typeof bundleId === "string";
  if (!hasProduct && !hasBundle) return null;
  return {
    index: entry.index,
    ...(hasProduct ? { productId: productId as number | string } : {}),
    ...(hasBundle ? { bundleId: bundleId as number | string } : {}),
    expectedPrice: entry.expectedPrice,
    currentPrice: entry.currentPrice,
  };
}

// Defensively parses a 409 PRICE_CHANGED response body. Returns the valid
// mismatches, or null when nothing usable survived (callers then fall back
// to the generic error path — never auto-retry, never crash).
export function parsePriceChangedData(data: unknown): PriceMismatch[] | null {
  if (!isRecord(data)) return null;
  if (!Array.isArray(data.items)) return null;
  const valid = data.items
    .map(parseMismatch)
    .filter((m): m is PriceMismatch => m !== null);
  return valid.length > 0 ? valid : null;
}

function sameId(a: number | string | undefined, b: number | string | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  return String(a) === String(b);
}

// Maps backend mismatches to submitted lines by request order (`index`),
// verifying product/bundle identity so a shifted payload can never retarget
// a price onto the wrong line. Unmatched entries are dropped; a repeated
// index resolves to its first occurrence so malformed duplicates can never
// produce duplicate dialog rows or double-apply one mismatch.
export function matchChangedLines(
  submitted: SubmittedLine[],
  mismatches: PriceMismatch[],
): MatchedChange[] {
  const matched: MatchedChange[] = [];
  const seen = new Set<number>();
  for (const m of mismatches) {
    if (seen.has(m.index)) continue;
    seen.add(m.index);
    const line = submitted[m.index];
    if (!line) continue;
    const identityOk =
      (m.productId !== undefined && sameId(m.productId, line.productId)) ||
      (m.bundleId !== undefined && sameId(m.bundleId, line.bundleId));
    if (!identityOk) continue;
    matched.push({
      line,
      expectedPrice: m.expectedPrice,
      currentPrice: m.currentPrice,
    });
  }
  return matched;
}

// Stable, serializable snapshot of the cart at submit time. Compared with
// JSON so key order and structurally-identical customizations compare equal.
export function snapshotCartLines(items: CartItem[]): string {
  return JSON.stringify(
    items.map((item) => ({
      id: item.id,
      customization: item.customization ?? null,
      price: item.price,
      quantity: item.quantity,
    })),
  );
}

// True when the live cart still matches the submit-time snapshot — the only
// condition under which confirming a 409 may resubmit.
export function isSnapshotCurrent(
  current: CartItem[],
  snapshot: string,
): boolean {
  return snapshotCartLines(current) === snapshot;
}

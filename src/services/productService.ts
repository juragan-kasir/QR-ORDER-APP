import apiClient, { ApiError } from "./apiClient";
import type { Product, Category, AddOn, Review, Bundle, PromoCampaign, ProductOptionGroup } from "../types";

interface CustomerMenuResponse {
  message: string;
  data: {
    products: BackendProduct[];
    categories: BackendCategory[];
  };
}

interface BackendProduct {
  id: number;
  nameProduct: string;
  sku: string;
  image: string | null;
  images?: string[] | null;
  barcode: string | null;
  brand: string | null;
  category: number;
  description: string | null;
  price: number;
  // DR-11: outlet-resolved catalog price (getEffectivePriceMap semantics —
  // outlet row wins, otherwise base price). Null when no valid store is
  // pinned. Absent on older backends.
  effectivePrice?: number | null;
  costPrice: number;
  isOption: boolean;
  options: unknown[];
  hasModifiers: boolean;
  modifiers: unknown[];
  stock: number;
  minStock: number;
  unit: string;
  baseUnit: string;
  conversionFactor: number;
  status: string;
  isAvailable: boolean;
  // F4-03: authoritative per-store stock for the requested store
  // (getEffectiveStock semantics — a present store row wins, including an
  // explicit 0; otherwise the base product.stock). Absent on older backends.
  effectiveStock?: number | null;
  // F4-03: fulfillment strategy — 'stocked' (default) | 'make_to_order' |
  // 'hybrid'. Absent on older backends (defaults to 'stocked').
  inventoryMode?: string | null;
  isBestSeller?: boolean;
  isPromo?: boolean;
  isVegetarian?: boolean;
  point: number;
  redeemPoints: number;
  tax: { id: number; name: string; rate: number } | null;
  priceTiers: unknown[];
  currencyId: number | null;
  currencyCode: string | null;
  createdBy: number | null;
  modifiedBy: number | null;
  tipeProduk: string;
  hppPerPorsi: number;
  foodCostPersen: number;
  marginPersen: number;
  isAvailableHariIni: boolean;
  composition: (string | { name: string; qty?: number; unit?: string })[];
  estimationTime: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  categoryData: { name: string } | null;
  reviews?: BackendReview[];
  averageRating?: number;
  totalReviews?: number;
}

interface BackendReview {
  id: number;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface BackendCategory {
  id: number;
  name: string;
  description: string | null;
  value: string;
  image: string | null;
  status: string;
  createdBy: number | null;
  modifiedBy: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const CATEGORY_ICONS: ReadonlyArray<readonly [string, string]> = [
  ["Makanan", "🍚"],
  ["Minuman", "🥤"],
  ["Dessert", "🍰"],
  ["Snack", "🍟"],
  ["Special", "⭐"],
];

const safeIcon = (catName: string): string =>
  CATEGORY_ICONS.find(([key]) => key === catName)?.[1] ?? "🍽️";

const CATEGORY_MAP: Record<string, Category> = {
  Makanan: "Makanan",
  Minuman: "Minuman",
  Dessert: "Dessert",
  Snack: "Snack",
  Special: "Special",
  "Makanan Berat": "Makanan Berat",
  "Minuman Dingin": "Minuman Dingin",
  makanan: "Makanan",
  minuman: "Minuman",
  dessert: "Dessert",
  snack: "Snack",
  special: "Special",
};

function mapCategoryName(name: string): Category {
  return CATEGORY_MAP[name] || "Makanan";
}

function mapBackendOptionsToFrontend(options: unknown[]): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter(
      (opt): opt is { name: string; value: string } =>
        typeof opt === "object" &&
        opt !== null &&
        "name" in opt &&
        "value" in opt,
    )
    .map((opt) => opt.value || opt.name);
}

// The shape BE-POS-App actually returns for product.options: a group
// ({id, name, options: [...]}) whose own `options` array holds the real
// choices ({name, price, stock}). This does not overlap with
// mapBackendOptionsToFrontend above (a flat {name, value} shape that never
// occurs in the real seeded data) — that function already safely returns []
// for this input since none of its entries have a `value` key, so both can
// coexist without conflict. Malformed groups/choices (missing a name) are
// skipped rather than accepted as-is.
function mapBackendOptionGroupsToFrontend(options: unknown[]): ProductOptionGroup[] {
  if (!Array.isArray(options)) return [];
  const groups: ProductOptionGroup[] = [];
  options.forEach((entry, groupIdx) => {
    if (typeof entry !== "object" || entry === null) return;
    const group = entry as { id?: string | number; name?: string; options?: unknown };
    if (!group.name || !Array.isArray(group.options)) return;
    const choices = group.options
      .filter(
        (choice): choice is { name: string; price?: number } =>
          typeof choice === "object" && choice !== null && "name" in choice && !!choice.name,
      )
      .map((choice) => ({
        name: choice.name,
        price: Number(choice.price) || 0,
      }));
    if (choices.length === 0) return;
    groups.push({
      id: String(group.id ?? groupIdx),
      name: group.name,
      choices,
    });
  });
  return groups;
}

function mapBackendModifiersToFrontend(modifiers: unknown[]): AddOn[] {
  if (!Array.isArray(modifiers)) return [];
  return modifiers
    .filter(
      (mod): mod is { id: string | number; name: string; price: number } =>
        typeof mod === "object" &&
        mod !== null &&
        "name" in mod &&
        "price" in mod,
    )
    .map((mod, idx) => ({
      id: String(mod.id || idx),
      name: mod.name,
      price: mod.price,
    }));
}

function mapBackendReviewToFrontend(br: BackendReview, productId: string): Review {
  return {
    id: String(br.id),
    userId: "",
    userName: br.userName,
    rating: br.rating,
    comment: br.comment,
    createdAt: br.createdAt,
    orderId: "",
    productId,
  };
}

// F4-03: customer-facing availability must reflect the backend's authoritative
// per-store effective stock (a present store row wins — including an explicit
// 0 — otherwise base product.stock), NOT the raw/global product.stock. The one
// exception mirrors backend order validation (BE-POS-App order.js): a
// make_to_order product's finished-good stock is not authoritative (its
// ingredients are resolved at deduction time), so a store-resolved 0 must
// NEVER render such a product unavailable — its existing (raw-stock) display
// behavior is preserved unchanged.
function computeCustomerStock(bp: BackendProduct): number {
  if (!bp.isAvailable) return 0;
  if ((bp.inventoryMode ?? "stocked") === "make_to_order") {
    return bp.stock;
  }
  return bp.effectiveStock ?? bp.stock;
}

export function mapBackendProductToFrontend(
  bp: BackendProduct,
  storeId?: string,
): Product {
  const sizes = mapBackendOptionsToFrontend(bp.options);
  const optionGroups = mapBackendOptionGroupsToFrontend(bp.options);
  const addOns = mapBackendModifiersToFrontend(bp.modifiers);
  const ingredients = Array.isArray(bp.composition)
    ? bp.composition
        .map((c) => (typeof c === "string" ? c : c.name).trim())
        .filter(Boolean)
    : [];
  const categoryName = bp.categoryData?.name || "Makanan";

  return {
    id: String(bp.id),
    name: bp.nameProduct,
    description: bp.description || "",
    price: bp.price,
    // DR-11: carried verbatim (null when unpinned/absent) — display
    // resolution happens in resolveDisplayPrice, never here.
    effectivePrice: bp.effectivePrice ?? null,
    images:
      bp.images?.length
        ? bp.images
        : bp.image
          ? [bp.image]
          : [],
    image:
      bp.images?.[0] ||
      bp.image ||
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=500&auto=format&fit=crop",
    category: mapCategoryName(categoryName),
    rating: bp.averageRating ?? 0,
    reviewsCount: bp.totalReviews ?? bp.reviews?.length ?? 0,
    reviews: bp.reviews?.map((r) => mapBackendReviewToFrontend(r, String(bp.id))),
    isBestSeller: !!bp.isBestSeller,
    isPromo: !!bp.isPromo,
    isVegetarian: !!bp.isVegetarian,
    estimatedTime: bp.estimationTime || 15,
    stock: computeCustomerStock(bp),
    storeId: storeId || String(bp.category),
    sizes: sizes.length > 0 ? (sizes as Product["sizes"]) : undefined,
    spicinessLevels: undefined,
    addOns: addOns.length > 0 ? addOns : undefined,
    optionGroups: optionGroups.length > 0 ? optionGroups : undefined,
    ingredients,
  };
}

export interface MenuCategoryUI {
  id: string;
  name: string;
  icon: string;
}

interface CustomerMenuResult {
  products: Product[];
  categories: MenuCategoryUI[];
}

// In-memory only (module-scoped, lost on reload), keyed by storeId — same
// proven pattern as storeService.ts's store-config cache: holds the raw
// (throwing) request promise, shared across every caller for that storeId,
// and a failed request is evicted immediately (see the .catch below)
// rather than cached, so a later call always retries fresh instead of
// reusing a broken result. This is the single shared source for the
// customer menu — fetchProductById below reuses it instead of issuing its
// own independent full-menu request, so a product detail page opened
// after the menu was already fetched (e.g. from Home) costs zero
// additional network requests.
const customerMenuCache = new Map<string, Promise<CustomerMenuResult>>();

async function fetchCustomerMenuFromApi(
  storeId: string,
): Promise<CustomerMenuResult> {
  try {
    const { data } = await apiClient.get<CustomerMenuResponse>(
      "/order/customer-menu",
      {
        params: { store: storeId },
      },
    );

    const categoriesMap = new Map<string, MenuCategoryUI>();

    data.data.categories.forEach((cat) => {
      const catName = cat.name || cat.value;
      if (!catName || cat.status === "inactive") return;
      if (categoriesMap.has(catName)) return;
      categoriesMap.set(catName, {
        id: catName,
        name: catName,
        icon: cat.image || safeIcon(catName),
      });
    });

    const products = data.data.products.map((bp) => {
      const catName = bp.categoryData?.name || "Makanan";
      if (!categoriesMap.has(catName)) {
        categoriesMap.set(catName, {
          id: catName,
          name: catName,
          icon: safeIcon(catName),
        });
      }
      return mapBackendProductToFrontend(bp, storeId);
    });

    return {
      products,
      categories: Array.from(categoriesMap.values()),
    };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError("Gagal memuat menu. Coba lagi nanti.", 0);
  }
}

export async function fetchCustomerMenu(
  storeId: string,
): Promise<CustomerMenuResult> {
  let pending = customerMenuCache.get(storeId);
  if (!pending) {
    pending = fetchCustomerMenuFromApi(storeId).catch((err) => {
      if (err instanceof ApiError) throw err;
      throw new ApiError("Gagal memuat menu. Coba lagi nanti.", 0);
    });
    customerMenuCache.set(storeId, pending);
    pending.catch(() => {
      if (customerMenuCache.get(storeId) === pending) {
        customerMenuCache.delete(storeId);
      }
    });
  }
  return pending;
}

export async function fetchProductById(
  productId: string,
  storeId?: string,
): Promise<Product | null> {
  try {
    if (!storeId) return null;
    const { products } = await fetchCustomerMenu(storeId);
    return (
      products.find((p) => String(p.id) === String(productId)) ?? null
    );
  } catch {
    return null;
  }
}

// ─── Product Bundles ─────────────────────────────────────────────

interface BackendBundleItem {
  id: number;
  bundleId: number;
  product: number;
  quantity: number;
  unitPrice: number;
  isOptional: boolean;
  productData: {
    id: number;
    nameProduct: string;
    price: number;
    image: string | null;
    stock: number;
  } | null;
}

interface BackendBundle {
  id: number;
  store: number[] | null;
  name: string;
  sku: string;
  description: string | null;
  image: string | null;
  bundlePrice: number;
  originalPrice: number;
  discountAmount: number;
  discountPercentage: string;
  minQuantity: number;
  maxQuantity: number | null;
  isAvailable: boolean;
  status: string;
  validFrom: string;
  validUntil: string;
  items: BackendBundleItem[];
}

interface BundleListResponse {
  message: string;
  data: {
    items: BackendBundle[];
  };
}

function mapBackendBundleToFrontend(bb: BackendBundle): Bundle {
  const items = bb.items.map((bi) => ({
    id: String(bi.id),
    bundleId: String(bi.bundleId),
    productId: String(bi.product),
    productName: bi.productData?.nameProduct || "",
    productImage: bi.productData?.image || "",
    quantity: bi.quantity,
    unitPrice: bi.unitPrice,
    isOptional: bi.isOptional,
  }));

  return {
    id: String(bb.id),
    name: bb.name,
    sku: bb.sku,
    description: bb.description || "",
    image: bb.image,
    bundlePrice: bb.bundlePrice,
    originalPrice: bb.originalPrice,
    discountAmount: bb.discountAmount,
    discountPercentage: parseFloat(bb.discountPercentage) || 0,
    minQuantity: bb.minQuantity,
    maxQuantity: bb.maxQuantity,
    isAvailable: bb.isAvailable,
    status: bb.status,
    validFrom: bb.validFrom,
    validUntil: bb.validUntil,
    items,
  };
}

// In-memory only (module-scoped, lost on reload), keyed by storeId — same
// proven pattern as storeService.ts's store-config cache and this file's
// own fetchCustomerMenu cache (Phase 4C.1): holds the raw (throwing)
// request promise, shared across every caller for that storeId, and a
// failed request is evicted immediately (see the .catch below) rather
// than cached, so a later call always retries fresh instead of reusing a
// broken result. HomePage remounting (e.g. navigating away and back) was
// measured, live, to re-fetch bundles on every mount with no reuse — this
// cache eliminates that redundant repeat request within one session.
const bundlesCache = new Map<string, Promise<Bundle[]>>();

// F-1: was "/product-bundle/get-all" — an authenticated (JWT) admin route.
// BISA-MAKAN-APP has no login flow, so every call unconditionally 401'd and
// the "Bundle Promo" section never displayed anything. "/customer-active" is
// the public, store-scoped counterpart (mirrors "/promo/customer-active",
// already used by fetchCustomerPromosFromApi below) — the backend still
// enforces store-ownership and active/available/validity filtering itself,
// so nothing here is trusted client-side.
async function fetchBundlesFromApi(storeId?: string): Promise<Bundle[]> {
  try {
    const { data } = await apiClient.get<BundleListResponse>(
      "/product-bundle/customer-active",
      {
        params: storeId ? { store: storeId } : {},
      },
    );
    const bundles = data.data.items as BackendBundle[];
    return bundles
      .filter((b) => b.status === "active" && b.isAvailable)
      .map(mapBackendBundleToFrontend);
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError("Gagal memuat bundle. Coba lagi nanti.", 0);
  }
}

export async function fetchBundles(storeId?: string): Promise<Bundle[]> {
  const key = storeId ?? "__no_store__";
  let pending = bundlesCache.get(key);
  if (!pending) {
    pending = fetchBundlesFromApi(storeId).catch((err) => {
      if (err instanceof ApiError) throw err;
      throw new ApiError("Gagal memuat bundle. Coba lagi nanti.", 0);
    });
    bundlesCache.set(key, pending);
    pending.catch(() => {
      if (bundlesCache.get(key) === pending) {
        bundlesCache.delete(key);
      }
    });
  }
  return pending;
}

interface CustomerPromoResponse {
  success: boolean;
  message: string;
  data: Array<{
    id: number;
    name: string;
    description: string | null;
    code: string | null;
    type: string;
    discountType: string;
    discountValue: number;
    maxDiscount: number | null;
    minPurchase: number;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    daysOfWeek: string[] | null;
    applicableTo: string;
    priority: number;
  }>;
}

function mapBackendPromoToFrontend(bp: CustomerPromoResponse["data"][number]): PromoCampaign {
  return {
    id: String(bp.id),
    name: bp.name,
    description: bp.description || "",
    code: bp.code || "",
    type: bp.type,
    discountType: bp.discountType,
    discountValue: bp.discountValue,
    maxDiscount: bp.maxDiscount,
    minPurchase: bp.minPurchase,
    startDate: bp.startDate,
    endDate: bp.endDate,
    startTime: bp.startTime,
    endTime: bp.endTime,
    daysOfWeek: bp.daysOfWeek,
    applicableTo: bp.applicableTo,
    priority: bp.priority,
  };
}

// Same cache pattern as bundlesCache above — HomePage remounting was
// measured, live, to re-fetch promos on every mount with no reuse.
const promosCache = new Map<string, Promise<PromoCampaign[]>>();

async function fetchCustomerPromosFromApi(
  storeId?: string,
): Promise<PromoCampaign[]> {
  try {
    const { data } = await apiClient.get<CustomerPromoResponse>(
      "/promo/customer-active",
      {
        params: storeId ? { store: storeId } : {},
      },
    );
    return data.data.map(mapBackendPromoToFrontend);
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError("Gagal memuat promo. Coba lagi nanti.", 0);
  }
}

export async function fetchCustomerPromos(
  storeId?: string,
): Promise<PromoCampaign[]> {
  const key = storeId ?? "__no_store__";
  let pending = promosCache.get(key);
  if (!pending) {
    pending = fetchCustomerPromosFromApi(storeId).catch((err) => {
      if (err instanceof ApiError) throw err;
      throw new ApiError("Gagal memuat promo. Coba lagi nanti.", 0);
    });
    promosCache.set(key, pending);
    pending.catch(() => {
      if (promosCache.get(key) === pending) {
        promosCache.delete(key);
      }
    });
  }
  return pending;
}

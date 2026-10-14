export type Category =
  | "Makanan"
  | "Minuman"
  | "Dessert"
  | "Snack"
  | "Special"
  | "Makanan Berat"
  | "Minuman Dingin";

export type Size = "Small" | "Medium" | "Large";

export type Spiciness = "Mild" | "Medium" | "Spicy" | "Extra Spicy";

export type OrderStatus =
  | "Menunggu Konfirmasi"
  | "Diproses"
  | "Sedang Dimasak"
  | "Siap Diantar"
  | "Sudah Diantar"
  | "Ditolak"
  | "Dibatalkan";

export type PaymentMethod =
  | "QRIS"
  | "E-Wallet"
  | "Kartu Kredit"
  | "Tunai"
  | "Postpaid"
  | "Split Bill";

export interface AddOn {
  id: string;
  name: string;
  price: number;
}

export interface ProductOptionChoice {
  name: string;
  price: number;
}

// The real BE-POS-App product-options contract: a named group (e.g.
// "Ukuran") containing its own independent choices (e.g. Reguler/Large),
// each with its own price delta. A product can have several such groups,
// each requiring its own selection — this is distinct from the flat
// `sizes`/`Size` field below, which only ever matches a single-choice,
// ungrouped shape that real seeded products don't actually use.
export interface ProductOptionGroup {
  id: string;
  name: string;
  choices: ProductOptionChoice[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  // DR-11: backend-resolved outlet price (customer-menu `effectivePrice`).
  // Null when no store is pinned or on older backends; 0 is a valid price.
  effectivePrice?: number | null;
  image: string;
  images: string[];
  category: Category;
  rating: number;
  reviewsCount: number;
  reviews?: Review[];
  isBestSeller: boolean;
  isPromo: boolean;
  isVegetarian: boolean;
  estimatedTime: number;
  stock: number;
  storeId: string;
  sizes?: Size[];
  spicinessLevels?: Spiciness[];
  addOns?: AddOn[];
  // Grouped option choices as BE-POS-App actually returns them (see
  // ProductOptionGroup) — populated alongside `sizes` rather than
  // replacing it, since `sizes` is left in place for whatever legacy flat
  // shape it was originally written for.
  optionGroups?: ProductOptionGroup[];
  ingredients: string[];
  // Set only when this "product" is a synthetic cart entry representing a
  // whole bundle purchase — carries the real product-bundle id through to
  // order creation instead of a per-component productId.
  bundleId?: string;
  // Component breakdown for a bundle entry (name/quantity only, for display)
  // — captured from the bundle data already on hand at add-to-cart time.
  bundleItems?: { name: string; quantity: number }[];
}

export interface CartItemCustomization {
  size?: Size;
  spiciness?: Spiciness;
  addOns?: AddOn[];
  // One chosen choice per selected ProductOptionGroup (a product can have
  // several independent groups, e.g. "Ukuran" AND "Piring" — this can carry
  // more than one entry, unlike the single-value `size` field above).
  selectedOptions?: { groupId: string; groupName: string; choiceName: string; price: number }[];
  notes?: string;
}

export interface CartItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  price: number;
  image: string;
  category: Category;
  quantity: number;
  customization?: CartItemCustomization;
  totalPrice: number;
  // Present when this cart line is a bundle purchase — the real
  // product-bundle id, forwarded to order creation as `bundleId` instead of
  // a per-component `productId`.
  bundleId?: string;
  bundleItems?: { name: string; quantity: number }[];
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  customization?: CartItemCustomization;
  totalPrice: number;
  image: string;
  // Present when this historical order line was a bundle purchase — lets
  // OrderHistoryPage identify and correctly reorder it via `bundleId`
  // instead of misreading it as a single component product.
  bundleId?: string;
  bundleName?: string;
}

export interface Order {
  id: string;
  // Opaque per-order token required to look this order up via the
  // unauthenticated tracking/receipt endpoints — never the raw id, which
  // is guessable/enumerable across every store.
  publicToken?: string;
  orderNumber?: string;
  tableNumber: string;
  storeId?: string;
  customerName?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  paymentMethod: PaymentMethod;
  splitCount?: number;
  status: OrderStatus;
  createdAt: string;
  statusHistory: { status: OrderStatus; timestamp: string }[];
}

export interface WaiterRequest {
  id: string;
  requestNumber: string;
  type: "Sendok" | "Tisu" | "Refill" | "Bill" | "Panggil Pelayan";
  tableName?: string;
  notes?: string | null;
  orderId?: string;
  createdAt: string;
  status: "Pending" | "Approved" | "Rejected" | "Done";
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  productId: string;
  rating: number;
  comment: string;
  createdAt: string;
  orderId: string;
}

export interface BundleItem {
  id: string;
  bundleId: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
  isOptional: boolean;
}

export interface Bundle {
  id: string;
  name: string;
  sku: string;
  description: string;
  image: string | null;
  bundlePrice: number;
  originalPrice: number;
  discountAmount: number;
  discountPercentage: number;
  minQuantity: number;
  maxQuantity: number | null;
  isAvailable: boolean;
  status: string;
  validFrom: string;
  validUntil: string;
  items: BundleItem[];
}

export interface AppSettings {
  tableNumber: string;
  storeId: string;
}

// ponytail: promo campaign untuk banner customer app
export interface PromoCampaign {
  id: string;
  name: string;
  description: string;
  code: string;
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
}

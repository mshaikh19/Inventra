export const INVENTORY_PRODUCTS_STORAGE_KEY = "inventra_inventory_products";

export const INVENTORY_PRODUCT_SEED = [
  { id: 1, name: "Fresh Bread 400g", category: "Bakery", stock: 8, price: 40, sold: 120, expiryDate: "2026-05-24", reorderLevel: 15, barcode: "8901234567890" },
  { id: 2, name: "Organic Milk 1L", category: "Dairy", stock: 12, price: 60, sold: 240, expiryDate: "2026-05-23", reorderLevel: 20, barcode: "8901234567891" },
  { id: 3, name: "Coke 500ml", category: "Beverages", stock: 85, price: 40, sold: 310, expiryDate: "2026-11-12", reorderLevel: 10, barcode: "8901234567892" },
  { id: 4, name: "Potato Chips 150g", category: "Snacks", stock: 4, price: 20, sold: 480, expiryDate: "2026-09-08", reorderLevel: 25, barcode: "8901234567893" },
  { id: 5, name: "Amul Butter 500g", category: "Dairy", stock: 32, price: 250, sold: 85, expiryDate: "2026-06-15", reorderLevel: 12, barcode: "8901234567894" },
  { id: 6, name: "Dark Chocolate 100g", category: "Snacks", stock: 55, price: 80, sold: 150, expiryDate: "2026-10-30", reorderLevel: 15, barcode: "8901234567895" },
];

export function loadInventoryProducts(fallback = INVENTORY_PRODUCT_SEED) {
  return loadScopedInventoryProducts(fallback, null);
}

function getInventoryStorageKey(branchName) {
  if (!branchName) return INVENTORY_PRODUCTS_STORAGE_KEY;
  const slug = String(branchName)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${INVENTORY_PRODUCTS_STORAGE_KEY}__${slug || "default"}`;
}

export function loadScopedInventoryProducts(fallback = INVENTORY_PRODUCT_SEED, branchName = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(getInventoryStorageKey(branchName));
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveInventoryProducts(products) {
  saveScopedInventoryProducts(products, null);
}

export function saveScopedInventoryProducts(products, branchName = null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getInventoryStorageKey(branchName), JSON.stringify(products));
  } catch {
    // ignore persistence errors in the browser cache
  }
}

export function normalizeInventoryItem(item, index = 0) {
  const fallbackId = item?._id || item?.product_id || item?.sku || item?.barcode || `inventory-${index + 1}`;
  const barcode = String(item?.barcode ?? item?.sku ?? fallbackId).trim();

  return {
    id: fallbackId,
    name: String(item?.product_name || item?.name || `Product ${index + 1}`).trim(),
    category: String(item?.category || "Uncategorized").trim(),
    stock: Number(item?.quantity ?? item?.stock ?? 0) || 0,
    price: Number(item?.selling_price ?? item?.price ?? 0) || 0,
    sold: Number(item?.total_sales ?? item?.sold ?? 0) || 0,
    expiryDate: String(item?.expiry_date || item?.expiryDate || "").trim(),
    reorderLevel: Number(item?.minimum_stock ?? item?.reorderLevel ?? 0) || 0,
    barcode,
    sku: item?.sku || "",
    branchId: item?.branch_id || "",
    productId: item?.product_id || "",
  };
}

export function normalizeInventoryProducts(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => normalizeInventoryItem(item, index));
}

export function extractInventoryItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.inventory?.items)) return payload.inventory.items;
  return [];
}

export function hydrateInventoryProducts(payload, fallback = INVENTORY_PRODUCT_SEED) {
  const items = extractInventoryItems(payload);
  const normalized = normalizeInventoryProducts(items);
  return normalized.length > 0 ? normalized : fallback;
}
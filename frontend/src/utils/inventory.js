export const INVENTORY_PRODUCTS_STORAGE_KEY = "inventra_inventory_products";

export const INVENTORY_PRODUCT_SEED = [
  {
    id: 1,
    name: "Fresh Bread 400g",
    category: "Bakery",
    stock: 8,
    price: 40,
    sold: 120,
    expiryDate: "2026-05-24",
    reorderLevel: 15,
    barcode: "8901234567890",
  },
  {
    id: 2,
    name: "Organic Milk 1L",
    category: "Dairy",
    stock: 12,
    price: 60,
    sold: 240,
    expiryDate: "2026-05-23",
    reorderLevel: 20,
    barcode: "8901234567891",
  },
  {
    id: 3,
    name: "Coke 500ml",
    category: "Beverages",
    stock: 85,
    price: 40,
    sold: 310,
    expiryDate: "2026-11-12",
    reorderLevel: 10,
    barcode: "8901234567892",
  },
  {
    id: 4,
    name: "Potato Chips 150g",
    category: "Snacks",
    stock: 4,
    price: 20,
    sold: 480,
    expiryDate: "2026-09-08",
    reorderLevel: 25,
    barcode: "8901234567893",
  },
  {
    id: 5,
    name: "Amul Butter 500g",
    category: "Dairy",
    stock: 32,
    price: 250,
    sold: 85,
    expiryDate: "2026-06-15",
    reorderLevel: 12,
    barcode: "8901234567894",
  },
  {
    id: 6,
    name: "Dark Chocolate 100g",
    category: "Snacks",
    stock: 55,
    price: 80,
    sold: 150,
    expiryDate: "2026-10-30",
    reorderLevel: 15,
    barcode: "8901234567895",
  },
];

export const GST_CATEGORY_RATES = {
  Books: 0,
  Dairy: 5,
  Grocery: 5,
  Pharmacy: 5,
  Bakery: 18,
  Snacks: 18,
  Beverages: 18,
  Produce: 0,
  "Meat & Seafood": 5,
  "Frozen Foods": 18,
  Pantry: 5,
  Medicine: 5,
  Wellness: 18,
  "Personal Care": 18,
  "First Aid": 12,
  "Baby Care": 12,
  Tops: 18,
  Bottoms: 18,
  Outerwear: 18,
  Footwear: 18,
  Accessories: 18,
  "Home & Living": 18,
  Stationery: 12,
  "Tools & Hardware": 18,
  Toys: 12,
  Other: 18,
  Apparel: 18,
  Electronics: 18,
  Luxury: 40,
  Uncategorized: 18,
};

const EXPIRY_TRACKING_KEYWORDS = [
  "grocery",
  "supermarket",
  "market",
  "mart",
  "pharmacy",
  "medicine",
  "medical",
  "health",
  "bakery",
  "food",
  "dairy",
  "fresh",
  "produce",
  "convenience",
];

const EXPIRY_TRACKING_CATEGORY_KEYWORDS = [
  "bakery",
  "dairy",
  "beverages",
  "food",
  "grocery",
  "medicine",
  "pharmacy",
  "produce",
  "meat",
  "seafood",
  "frozen",
  "fresh",
];

export function shouldTrackExpiryForBusiness(...values) {
  const haystack = values
    .flat()
    .map((value) =>
      String(value || "")
        .toLowerCase()
        .trim(),
    )
    .filter(Boolean)
    .join(" ");

  if (!haystack) return false;
  return EXPIRY_TRACKING_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export function shouldCollectExpiryForCategory(category) {
  const normalizedCategory = String(category || "")
    .toLowerCase()
    .trim();
  if (!normalizedCategory) return false;
  return EXPIRY_TRACKING_CATEGORY_KEYWORDS.some((keyword) =>
    normalizedCategory.includes(keyword),
  );
}

export function getLowStockAlertBand(stock, minimumStock) {
  const stockValue = Number(stock || 0);
  const minimumValue = Math.max(1, Number(minimumStock || 0));

  if (stockValue <= 0 || stockValue <= minimumValue * 0.25) {
    return {
      tone: "red",
      label: "Red",
      title: "Critical low stock alert",
      message: `Stock is at ${stockValue} units, far below the reorder level of ${minimumValue}.`,
    };
  }

  if (stockValue <= minimumValue * 0.5) {
    return {
      tone: "orange",
      label: "Orange",
      title: "High priority low stock alert",
      message: `Stock is at ${stockValue} units, below half of the reorder level (${minimumValue}).`,
    };
  }

  if (stockValue <= minimumValue) {
    return {
      tone: "yellow",
      label: "Yellow",
      title: "Low stock watch alert",
      message: `Stock is at ${stockValue} units and has reached the reorder level of ${minimumValue}.`,
    };
  }

  return null;
}

export function getCategoryGstRate(category) {
  return (
    GST_CATEGORY_RATES[String(category || "").trim()] ??
    GST_CATEGORY_RATES.Uncategorized
  );
}

// DEPRECATED: Do NOT use loadInventoryProducts() or saveInventoryProducts()
// Always use saveScopedInventoryProducts(products, branchName) with explicit branch name

function getInventoryStorageKey(branchName) {
  // branchName is required - always pass explicit branch name to prevent product leakage
  if (!branchName) {
    console.error(
      "❌ CRITICAL: getInventoryStorageKey called without branchName! Products WILL leak across branches.",
    );
    return INVENTORY_PRODUCTS_STORAGE_KEY;
  }
  const slug = String(branchName)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${INVENTORY_PRODUCTS_STORAGE_KEY}__${slug || "default"}`;
}

export function loadScopedInventoryProducts(
  fallback = INVENTORY_PRODUCT_SEED,
  branchName = null,
) {
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

export function saveScopedInventoryProducts(products, branchName = null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getInventoryStorageKey(branchName),
      JSON.stringify(products),
    );
  } catch {
    // ignore persistence errors in the browser cache
  }
}

export function normalizeInventoryItem(item, index = 0) {
  const fallbackId =
    item?._id ||
    item?.product_id ||
    item?.sku ||
    item?.barcode ||
    `inventory-${index + 1}`;
  const barcode = String(item?.barcode ?? item?.sku ?? fallbackId).trim();
  const sellingPrice = Number(item?.selling_price ?? item?.price ?? 0) || 0;
  const mrp =
    Number(
      item?.mrp ??
        item?.maximum_retail_price ??
        item?.retail_price ??
        sellingPrice,
    ) || sellingPrice;
  const category = String(item?.category || "Uncategorized").trim();
  const gstRate =
    Number(
      item?.gst_rate ?? item?.gst_percentage ?? getCategoryGstRate(category),
    ) || 0;
  const discountPercent =
    Number(
      item?.discount_percent ??
        item?.discountPercentage ??
        item?.default_discount_percent ??
        0,
    ) || 0;

  return {
    id: fallbackId,
    name: String(
      item?.product_name || item?.name || `Product ${index + 1}`,
    ).trim(),
    category,
    stock: Number(item?.quantity ?? item?.stock ?? 0) || 0,
    price: sellingPrice,
    sellingPrice,
    mrp,
    gstPercentage: gstRate,
    gstRate,
    hsnCode: item?.hsn_code || "",
    discountPercent,
    discountAmount:
      Number(item?.discount_amount ?? item?.discountAmount ?? 0) || 0,
    sellOnMrp: discountPercent <= 0,
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

export function hydrateInventoryProducts(
  payload,
  fallback = INVENTORY_PRODUCT_SEED,
) {
  const items = extractInventoryItems(payload);
  const normalized = normalizeInventoryProducts(items);
  return normalized.length > 0 ? normalized : fallback;
}

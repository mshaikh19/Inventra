import React from "react";
import { toast } from "react-toastify";
import PureBarcodeScanner from "../components/pureBarcodeScanner";
import CustomDropdown from "../components/CustomDropdown";
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from "@zxing/library";
import {
  getDashboardTierFromUser,
  getTierBadgeLabel,
  getUserDisplayName,
  normalizeBusinessTier,
  getBillingPosTab,
  userHasOwnerAccess,
} from "../utils/dashboard";
import {
  createBranchInventoryItem,
  deleteBranchInventoryItem,
  getBranchInventory,
  getBranchNetwork,
  getUserBranches,
  updateBranchInventoryItem,
} from "../utils/branches";
import {
  getCategoryGstRate,
  hydrateInventoryProducts,
  loadScopedInventoryProducts,
  normalizeInventoryProducts,
  saveScopedInventoryProducts,
} from "../utils/inventory";

const showIntakeToast = (tone, title, message) => {
  let icon = "🛈";
  if (tone === "success") icon = "✓";
  if (tone === "error") icon = "⚠️";

  const fullText = title ? `${title} ${message}` : message;

  const content = (
    <div className="flex items-center gap-2.5 py-1">
      <span className="text-sm font-black shrink-0">{icon}</span>
      <span className="text-[11px] font-black uppercase tracking-wider leading-relaxed">
        {fullText}
      </span>
    </div>
  );
  
  const toastOptions = {
    className: `inventra-toast inventra-toast--${tone}`,
    bodyClassName: "inventra-toast__body",
    autoClose: 3000,
  };

  if (tone === "success") {
    toast.success(content, toastOptions);
  } else if (tone === "error") {
    toast.error(content, toastOptions);
  } else {
    toast.info(content, toastOptions);
  }
};

const getStatus = (stock, reorderLevel) => {
  if (stock <= Math.max(1, reorderLevel * 0.3)) return "Critical";
  if (stock <= reorderLevel) return "Low Stock";
  if (stock >= reorderLevel * 5) return "Overstock";
  return "Healthy";
};

const summarizeInventoryItems = (items = []) => {
  const normalizedItems = normalizeInventoryProducts(items);
  const stock = normalizedItems.reduce(
    (sum, item) => sum + Number(item.stock || 0),
    0,
  );
  const lowItems = normalizedItems.filter(
    (item) =>
      Number(item.stock || 0) <= Math.max(1, Number(item.reorderLevel || 10)),
  ).length;
  return { stock, lowItems };
};

const normalizeBarcode = (value) => String(value ?? "").replace(/\s+/g, "").trim();

const playScanSound = (isSuccess) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (isSuccess) {
      // Success Beep: nice 1000Hz pure sine wave for 100ms
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else {
      // Error Buzz: low-pitch dual-tone square wave at 120Hz for 250ms
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.warn("Web Audio API not supported or blocked: ", e);
  }
};

const getBusinessCategories = (userSession) => {
  const bizType = String(
    userSession?.user?.businessType || 
    userSession?.user?.businessMetrics?.bizType || 
    userSession?.user?.businessName || 
    "grocery"
  ).toLowerCase();

  if (bizType.includes("pharmacy") || bizType.includes("medicine") || bizType.includes("health")) {
    return {
      type: "pharmacy",
      categories: ["Medicine", "Wellness", "Personal Care", "First Aid", "Baby Care", "Other"],
      default: "Medicine"
    };
  }
  if (bizType.includes("apparel") || bizType.includes("fashion") || bizType.includes("clothing") || bizType.includes("boutique")) {
    return {
      type: "apparel",
      categories: ["Tops", "Bottoms", "Outerwear", "Footwear", "Accessories", "Other"],
      default: "Tops"
    };
  }
  if (bizType.includes("grocery") || bizType.includes("supermarket") || bizType.includes("mart") || bizType.includes("food") || bizType.includes("dairy") || bizType.includes("store") || bizType.includes("intake") || bizType.includes("inventra")) {
    return {
      type: "grocery",
      categories: ["Dairy", "Bakery", "Snacks", "Beverages", "Produce", "Meat & Seafood", "Frozen Foods", "Pantry", "Other"],
      default: "Dairy"
    };
  }
  // Default to General Retail / Other
  return {
    type: "retail",
    categories: ["Electronics", "Home & Living", "Stationery", "Tools & Hardware", "Apparel", "Toys", "Other"],
    default: "Electronics"
  };
};

const classifyProductCategoryByName = (name, allowedCategories) => {
  if (!name || typeof name !== "string") return "";
  
  const cleanName = name.toLowerCase().trim();
  if (cleanName.length === 0) return "";

  // Grocery keywords
  const groceryRules = [
    { cat: "Dairy", keywords: ["milk", "cheese", "yogurt", "butter", "ghee", "cream", "paneer", "curd", "lassi", "soya milk", "almond milk", "dairy", "yakult", "margarine", "buttermilk", "whipped cream", "mozzarella", "cheddar", "gouda", "parmesan", "tofu", "condensed milk", "cottage cheese", "ricotta", "custard"] },
    { cat: "Bakery", keywords: ["bread", "bun", "croissant", "bagel", "toast", "rusk", "biscuit", "cookie", "cake", "muffin", "pastry", "loaf", "doughnut", "bakery", "baguette", "tortilla", "pita", "naan", "cracker", "sourdough", "pancake", "waffle", "puff", "tarts", "danish", "garlic bread"] },
    { cat: "Snacks", keywords: ["chip", "crisp", "popcorn", "nacho", "pretzel", "chocolate", "candy", "sweet", "nuts", "almond", "cashew", "pistachio", "wafer", "snack", "fryum", "namkeen", "peanut", "marshmallow", "gummy", "jelly", "chocolate bar", "kurkure", "lays", "doritos", "pringles", "cheetos", "puffcorn", "raisin", "granola"] },
    { cat: "Beverages", keywords: ["drink", "soda", "coke", "pepsi", "sprite", "fanta", "juice", "water", "tea", "coffee", "cola", "beverage", "beer", "wine", "spirit", "shake", "smoothie", "mocktail", "red bull", "energy drink", "monster", "espresso", "latte", "cappuccino", "green tea", "iced tea", "soda water", "tonic water", "bourbon", "whiskey", "vodka", "rum", "tequila", "liquor"] },
    { cat: "Produce", keywords: ["apple", "banana", "orange", "grape", "tomato", "potato", "onion", "garlic", "lemon", "lime", "fruit", "vegetable", "berry", "spinach", "lettuce", "carrot", "ginger", "chili", "chilly", "mushroom", "mango", "strawberry", "blueberry", "watermelon", "broccoli", "cabbage", "cauliflower", "cucumber", "cilantro", "mint", "avocado", "pear", "peach", "pineapple", "potato", "onion", "garlic", "beans", "okra", "eggplant", "pumpkin"] },
    { cat: "Meat & Seafood", keywords: ["chicken", "beef", "pork", "mutton", "fish", "shrimp", "prawn", "crab", "meat", "salmon", "tuna", "egg", "seafood", "turkey", "bacon", "ham", "sausage", "pepperoni", "lobster", "oyster", "lamb", "steak", "salami", "meatball"] },
    { cat: "Frozen Foods", keywords: ["frozen", "ice cream", "nuggets", "waffle", "gelato", "sorbet", "frozen pizza", "frozen fries", "frozen veggies", "frozen meal", "ice pack", "frozen hashbrowns", "frozen peas", "frozen snack"] },
    { cat: "Pantry", keywords: ["flour", "rice", "wheat", "oil", "salt", "sugar", "spice", "class", "sauce", "ketchup", "pasta", "noodle", "cereal", "oats", "pulses", "lentil", "honey", "jam", "vinegar", "mayo", "mustard", "soy sauce", "olive oil", "canola oil", "baking powder", "baking soda", "yeast", "cornstarch", "pepper", "turmeric", "cardamom", "cinnamon", "cloves", "cumin", "masala", "pickle"] }
  ];

  // Pharmacy keywords
  const pharmacyRules = [
    { cat: "Medicine", keywords: ["tablet", "capsule", "syrup", "pill", "paracetamol", "aspirin", "ibuprofen", "antibiotic", "ointment", "cream", "gel", "injection", "vaccine", "medicine", "cough", "cold", "drops", "inhaler", "spray", "patch", "antacid", "laxative", "painkiller", "insulin", "antiseptic cream", "lozenges"] },
    { cat: "Wellness", keywords: ["vitamin", "multivitamin", "supplement", "protein powder", "omega", "calcium", "zinc", "herbal", "wellness", "detox", "tea", "essential oil", "probiotics", "collagen", "biotin", "iron", "magnesium", "fish oil", "protein bar", "mass gainer", "whey", "creatine", "antioxidant", "ginseng"] },
    { cat: "Personal Care", keywords: ["soap", "shampoo", "conditioner", "body wash", "toothpaste", "toothbrush", "mouthwash", "deodorant", "perfume", "lotion", "moisturizer", "facewash", "sunscreen", "razor", "shaving", "face wash", "hand wash", "hair oil", "hair gel", "lip balm", "talcum", "trimmer", "comb", "body spray", "sanitary pad", "tampons", "face mask"] },
    { cat: "First Aid", keywords: ["bandage", "bandaid", "tape", "antiseptic", "dettol", "savlon", "cotton", "gauze", "scissor", "thermometer", "mask", "gloves", "sanitizer", "alcohol swab", "hot water bag", "ice pack", "knee cap", "crepe bandage", "tweezers", "burn relief"] },
    { cat: "Baby Care", keywords: ["diaper", "baby wipe", "baby powder", "baby lotion", "baby shampoo", "cerelac", "formula", "pacifier", "baby bottle", "baby oil", "baby wash", "rash cream", "baby food", "teether", "baby cot"] }
  ];

  // Apparel keywords
  const apparelRules = [
    { cat: "Tops", keywords: ["shirt", "t-shirt", "tee", "blouse", "top", "hoodie", "sweatshirt", "sweater", "cardigan", "polos", "tank top", "crop top", "tunic", "jersey", "vest", "kimono"] },
    { cat: "Bottoms", keywords: ["jean", "pant", "trouser", "shorts", "skirt", "leggings", "joggers", "sweatpants", "slacks", "cargo", "chinos", "pajama", "sweat shorts", "tights"] },
    { cat: "Outerwear", keywords: ["jacket", "coat", "blazer", "raincoat", "windbreaker", "parka", "vest", "trench coat", "denim jacket", "leather jacket", "puffer", "hoodie", "cloak", "overcoat"] },
    { cat: "Footwear", keywords: ["shoe", "sneaker", "boot", "sandal", "slipper", "loafers", "heels", "flats", "socks", "trainers", "running shoes", "boots", "crocs", "flip flops", "socks", "oxfords", "wedges", "clogs"] },
    { cat: "Accessories", keywords: ["bag", "backpack", "belt", "hat", "cap", "scarf", "gloves", "wallet", "watch", "sunglasses", "jewelry", "necklace", "ring", "earrings", "bracelet", "tie", "bowtie", "umbrella", "hairband", "purse", "handbag", "keychain", "cufflinks"] }
  ];

  // Retail / Other keywords
  const retailRules = [
    { cat: "Electronics", keywords: ["phone", "laptop", "tablet", "charger", "cable", "headphone", "earphone", "mouse", "keyboard", "monitor", "speaker", "camera", "tv", "battery", "plug", "smart watch", "airpods", "router", "power bank", "adapter", "flash drive", "hard drive", "microphone", "console", "gamepad", "projector"] },
    { cat: "Home & Living", keywords: ["bed", "sheet", "pillow", "blanket", "towel", "curtain", "lamp", "bulb", "chair", "table", "mug", "plate", "spoon", "fork", "knife", "pan", "pot", "vase", "candle", "pillowcase", "cushion", "hanger", "rug", "doormat", "trash can", "mop", "broom", "bucket", "container", "clock", "mirror", "cookware", "bedding", "towel set"] },
    { cat: "Stationery", keywords: ["pen", "pencil", "notebook", "paper", "eraser", "ruler", "glue", "scissors", "marker", "highlighter", "binder", "stapler", "folder", "diary", "sketchbook", "tape", "envelope", "calculator", "file", "sticky notes", "card", "brush", "canvas", "paint", "notepad", "sticky pad"] },
    { cat: "Tools & Hardware", keywords: ["screw", "nail", "hammer", "screwdriver", "wrench", "tape", "drill", "saw", "pliers", "wire", "paint", "brush", "lock", "key", "bolt", "nut", "measuring tape", "leveler", "toolbox", "flashlight", "glue gun", "safety glasses", "hacksaw", "staple gun"] },
    { cat: "Toys", keywords: ["toy", "game", "doll", "action figure", "puzzle", "lego", "blocks", "car", "teddy", "board game", "card game", "playing cards", "chess", "slime", "soft toy", "stuffed animal", "gun", "nerf", "balloon", "plush", "rubik", "boardgame"] }
  ];

  const allRules = [...groceryRules, ...pharmacyRules, ...apparelRules, ...retailRules];

  for (const rule of allRules) {
    if (allowedCategories.includes(rule.cat)) {
      if (rule.keywords.some(kw => cleanName.includes(kw))) {
        return rule.cat;
      }
    }
  }

  for (const cat of allowedCategories) {
    if (cat.toLowerCase() !== "other") {
      if (cleanName.includes(cat.toLowerCase()) || cat.toLowerCase().includes(cleanName)) {
        return cat;
      }
    }
  }

  return "";
};

const mapGlobalCategory = (categoriesHierarchy, allowedCategories) => {
  if (!Array.isArray(categoriesHierarchy)) return allowedCategories.includes("Other") ? "Other" : allowedCategories[0];
  
  const tags = categoriesHierarchy.map((c) => String(c).toLowerCase().trim());
  
  for (const tag of tags) {
    const matched = classifyProductCategoryByName(tag, allowedCategories);
    if (matched) return matched;
  }
  
  return allowedCategories.includes("Other") ? "Other" : allowedCategories[0];
};

const recommendProductCategoryAndGst = (name, allowedCategories, fallbackCategory) => {
  const matchedCategory = classifyProductCategoryByName(name, allowedCategories);
  const category = matchedCategory || fallbackCategory || allowedCategories[0] || "Other";
  return {
    category,
    gstRate: getCategoryGstRate(category),
    matched: Boolean(matchedCategory),
  };
};

export default function InventoryOperations({ tier = "small", setActiveTab }) {
  const normalizedTier = normalizeBusinessTier(tier);
  const [branchNames, setBranchNames] = React.useState(() =>
    getBranchNetwork(normalizedTier),
  );
  const [branchSummariesMap, setBranchSummariesMap] = React.useState({});
  const [isLoadingInventory, setIsLoadingInventory] = React.useState(false);
  const [inventoryNotice, setInventoryNotice] = React.useState(
    "Inventory starts empty for new branches.",
  );
  const [inventoryError, setInventoryError] = React.useState("");
  const tierAccent =
    normalizedTier === "medium"
      ? "#D97706"
      : normalizedTier === "large"
        ? "#059669"
        : "#0284C7";
  const tierBadgeLabel = getTierBadgeLabel(normalizedTier);

  const userSession = (() => {
    if (typeof window === "undefined") return null;
    for (const storage of [localStorage, sessionStorage]) {
      const token = storage.getItem("inventra_token");
      const rawUser = storage.getItem("inventra_user");
      if (token && rawUser) {
        try {
          return { token, user: JSON.parse(rawUser) };
        } catch {
          return { token, user: null };
        }
      }
    }
    return null;
  })();

  const bizConfig = React.useMemo(() => {
    return getBusinessCategories(userSession);
  }, [userSession]);

  const [selectedBranch, setSelectedBranch] = React.useState(() => {
    if (typeof window === "undefined") return branchNames[0];
    const saved = sessionStorage.getItem("inventra_inventory_branch");
    return branchNames.includes(saved) ? saved : branchNames[0];
  });
  const [products, setProducts] = React.useState([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [editingId, setEditingId] = React.useState(null);
  const [editForm, setEditForm] = React.useState({
    quantity: 0,
    selling_price: 0,
    mrp: 0,
    gst_rate: 18,
    discount_percent: 0,
    minimum_stock: 0,
  });
  const [showAddModal, setShowAddModal] = React.useState(() => {
    if (typeof window === "undefined" || !selectedBranch) return false;
    return sessionStorage.getItem(`inventra_inventory_showAddModal__${selectedBranch}`) === "true";
  });
  const [showScannerModal, setShowScannerModal] = React.useState(() => {
    if (typeof window === "undefined" || !selectedBranch) return false;
    return sessionStorage.getItem(`inventra_inventory_showScannerModal__${selectedBranch}`) === "true";
  });
  const [scannerInput, setScannerInput] = React.useState("");
  const [scannerFeedback, setScannerFeedback] = React.useState(null);
  const [newProduct, setNewProduct] = React.useState(() => {
    const defaultProduct = {
      product_name: "",
      category: bizConfig.default,
      quantity: 0,
      purchase_price: 0,
      selling_price: 0,
      mrp: 0,
      gst_rate: getCategoryGstRate(bizConfig.default),
      discount_percent: 0,
      minimum_stock: 0,
      unit: "Units",
      barcode: "",
      sku: "",
      expiry_date: "",
    };
    if (typeof window === "undefined" || !selectedBranch) return defaultProduct;
    try {
      const stored = sessionStorage.getItem(`inventra_inventory_newProduct__${selectedBranch}`);
      return stored ? JSON.parse(stored) : defaultProduct;
    } catch {
      return defaultProduct;
    }
  });
  const scannerInputRef = React.useRef(null);

  const [isLookupLoading, setIsLookupLoading] = React.useState(false);
  const [modalError, setModalError] = React.useState("");


  const [scannerCameraStatus, setScannerCameraStatus] = React.useState("idle");
  const [scannerCameraMessage, setScannerCameraMessage] = React.useState("");
  const [videoDevices, setVideoDevices] = React.useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState("");



  const stopScannerCamera = React.useCallback(() => {
    setScannerCameraStatus("idle");
    setScannerCameraMessage("");
  }, []);

  // Debounce timer for barcode lookup - prevents excessive API calls
  const barcodeLookupTimeoutRef = React.useRef(null);

  const triggerSmartBarcodeLookup = React.useCallback(async (barcodeVal) => {
    const scannedBarcode = normalizeBarcode(barcodeVal);
    if (!scannedBarcode || scannedBarcode.length < 8) return;

    setIsLookupLoading(true);

    try {
      // FAST PATH: Try local cache first (skip network if possible)
      let foundProduct = null;
      let foundBranchName = "";

      // Check only the 2 most recent branches (not all branches)
      const recentBranches = branchNames.slice(0, 2).filter(b => b !== selectedBranch);
      for (const branch of recentBranches) {
        try {
          // Use 2 second timeout for branch search (faster)
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2000);
          
          const payload = await getBranchInventory(branch);
          clearTimeout(timeout);
          
          const otherProducts = hydrateInventoryProducts(payload, []);
          const match = otherProducts.find((p) => normalizeBarcode(p.barcode) === scannedBarcode);
          if (match) {
            foundProduct = match;
            foundBranchName = branch;
            break;
          }
        } catch (err) {
          // Skip this branch and try next one
        }
      }

      if (foundProduct) {
        setNewProduct((prev) => ({
          ...prev,
          product_name: foundProduct.name || prev.product_name,
          category: foundProduct.category || prev.category,
          selling_price: foundProduct.price ?? prev.selling_price,
          mrp: foundProduct.mrp ?? foundProduct.price ?? prev.mrp,
          gst_rate: foundProduct.gstRate ?? foundProduct.gstPercentage ?? getCategoryGstRate(foundProduct.category || prev.category),
          discount_percent: foundProduct.discountPercent ?? prev.discount_percent,
          minimum_stock: foundProduct.reorderLevel ?? prev.minimum_stock,
          purchase_price: foundProduct.purchasePrice ?? Math.round(foundProduct.price * 0.7) ?? prev.purchase_price,
          unit: foundProduct.unit || "Units",
          sku: foundProduct.sku || prev.sku,
        }));
        showIntakeToast("success", "Barcode Auto-Fill", `Found details in ${foundBranchName}`);
        setIsLookupLoading(false);
        return;
      }

      // SLOW PATH: Global Open Food Facts API (only if local search fails)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced from 6s to 3s

      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v2/search?code=${scannedBarcode}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("Service unavailable");

        const data = await res.json();
        if (data.products && data.products.length > 0) {
          const prod = data.products[0];
          const brand = prod.brands ? String(prod.brands).split(",")[0].trim() : "";
          const rawName = prod.product_name || prod.product_name_en || "";
          const name = brand ? `${brand} ${rawName}` : rawName;
          
          const category = mapGlobalCategory(prod.categories_hierarchy || prod.categories_tags, bizConfig.categories);
          const gstRate = getCategoryGstRate(category);
          const qtyStr = prod.quantity ? String(prod.quantity).trim() : "Units";

          setNewProduct((prev) => ({
            ...prev,
            product_name: name.slice(0, 100) || prev.product_name,
            category: category || prev.category,
            gst_rate: gstRate,
            unit: qtyStr || prev.unit,
          }));
          showIntakeToast("success", "Global Catalog Match", `Found ${name.slice(0, 40)}`);
        } else {
          showIntakeToast("info", "Catalog Lookup", "Not found in global catalog. Please enter manually.");
        }
      } catch (err) {
        if (err.name === "AbortError") {
          showIntakeToast("info", "Catalog Lookup", "Lookup timed out. Please enter manually.");
        } else {
          showIntakeToast("info", "Catalog Lookup", "Offline - please enter details manually.");
        }
      }
    } finally {
      setIsLookupLoading(false);
    }
  }, [branchNames, selectedBranch]);

  const debouncedBarcodeLookup = React.useCallback((barcodeVal) => {
    if (barcodeLookupTimeoutRef.current) {
      clearTimeout(barcodeLookupTimeoutRef.current);
    }
    const normalized = normalizeBarcode(barcodeVal);
    if (normalized.length >= 8) {
      barcodeLookupTimeoutRef.current = setTimeout(() => {
        triggerSmartBarcodeLookup(normalized);
      }, 500);
    }
  }, [triggerSmartBarcodeLookup]);

  const handleScanBarcode = React.useCallback((barcodeValue) => {
    const scannedBarcode = normalizeBarcode(barcodeValue);
    if (!scannedBarcode) return false;
    setScannerInput("");

    const product = products.find((item) => normalizeBarcode(item.barcode) === scannedBarcode);
    if (product) {
      setSearchTerm(product.name);
      playScanSound(true);
      setScannerFeedback({
        status: "success",
        message: `Found ${product.name} in inventory.`,
      });
      return true;
    } else {
      playScanSound(false);
      setScannerFeedback({
        status: "error",
        message: `Barcode "${scannedBarcode}" is not registered. Opening intake form…`,
      });

      // Turn off scanner stream and close scanner view
      stopScannerCamera();
      setShowScannerModal(false);

      // Pre-populate barcode on the new product and launch intake form
      setNewProduct((prev) => ({
        ...prev,
        barcode: scannedBarcode,
      }));
      setShowAddModal(true);

      // Auto-trigger lookup for scanned code
      void triggerSmartBarcodeLookup(scannedBarcode);

      return false;
    }
  }, [products, stopScannerCamera, triggerSmartBarcodeLookup]);

  const handleImageCapture = React.useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerCameraStatus("starting");
    setScannerCameraMessage("Processing captured photo...");

    try {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        try {
          // Downscale the image to a max dimension of 900px to speed up ZXing processing by 95%!
          const MAX_DIM = 900;
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Could not get 2D canvas context.");

          ctx.drawImage(img, 0, 0, width, height);

          // Decode directly from the optimized canvas with high-precision hints!
          const reader = new BrowserMultiFormatReader();
          const hints = new Map();
          hints.set(DecodeHintType.TRY_HARDER, true);
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.ITF,
            BarcodeFormat.QR_CODE
          ]);
          reader.hints = hints;
          const result = await reader.decodeFromCanvas(canvas);
          URL.revokeObjectURL(imageUrl);

          if (result) {
            const text = result.text || (typeof result.getText === "function" ? result.getText() : "");
            if (text) {
              handleScanBarcode(text);
            } else {
              throw new Error("No clear barcode text detected in photo.");
            }
          } else {
            throw new Error("Could not find a valid barcode structure.");
          }
        } catch (err) {
          console.warn("ZXing image decode failed:", err);
          URL.revokeObjectURL(imageUrl);
          setScannerCameraStatus("error");
          setScannerCameraMessage("Failed to read barcode from photo. Make sure it is close-up, sharp, and well-lit.");
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        setScannerCameraStatus("error");
        setScannerCameraMessage("Failed to load captured image file.");
      };
      img.src = imageUrl;
    } catch (err) {
      console.warn("Image capture processing failed:", err);
      setScannerCameraStatus("error");
      setScannerCameraMessage("Error opening camera capture file.");
    }
  }, [handleScanBarcode]);

  React.useEffect(() => {
    if (!showScannerModal) {
      setVideoDevices([]);
      setSelectedDeviceId("");
    }
  }, [showScannerModal]);

  const loadBranchInventory = React.useCallback(
    async (branchName) => {
      if (!branchName) return;
      setIsLoadingInventory(true);
      setInventoryError("");
      try {
        const payload = await getBranchInventory(branchName);
        const nextProducts = hydrateInventoryProducts(payload, []);
        setProducts(nextProducts);
        setBranchSummariesMap((current) => ({
          ...current,
          [branchName]: summarizeInventoryItems(nextProducts),
        }));
        setInventoryNotice(
          nextProducts.length > 0
            ? `Loaded ${nextProducts.length} item(s) for ${branchName}.`
            : `${branchName} inventory is empty. Add the first item to begin.`,
        );
      } catch (error) {
        const cachedProducts = loadScopedInventoryProducts([], branchName);
        setProducts(cachedProducts);
        setInventoryError(
          error?.message || "Unable to load branch inventory from the server.",
        );
        setInventoryNotice(
          cachedProducts.length > 0
            ? `Loaded cached inventory for ${branchName}.`
            : `${branchName} inventory is empty.`,
        );
      } finally {
        setIsLoadingInventory(false);
      }
    },
    [
      setBranchSummariesMap,
      setInventoryError,
      setInventoryNotice,
      setIsLoadingInventory,
      setProducts,
    ],
  );

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const data = await getUserBranches();
        if (cancelled || !data || !Array.isArray(data.branches)) return;

        let branches = data.branches;
        const userBranchId = userHasOwnerAccess(userSession?.user) ? null : userSession?.user?.branchId;
        if (userBranchId) {
          const userBranch = branches.find(b => b.branch_id === userBranchId);
          if (userBranch) {
            branches = [userBranch];
          }
        }
        const names = branches.map((branch) => branch.branch_name);
        setBranchNames(names);

        // Determine the initial branch to load
        const saved = sessionStorage.getItem("inventra_inventory_branch");
        const nextBranch = names.includes(saved)
          ? saved
          : names.includes(selectedBranch)
            ? selectedBranch
            : names[0] || selectedBranch;

        if (nextBranch !== selectedBranch) {
          setSelectedBranch(nextBranch);
        }

        // Load the initial branch inventory immediately
        void loadBranchInventory(nextBranch);

      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load branches from DB:", error);
          setInventoryError(error?.message || "Failed to load branch network.");
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [normalizedTier]);

  React.useEffect(() => {
    if (!selectedBranch) return;
    sessionStorage.setItem("inventra_inventory_branch", selectedBranch);
    // Load inventory for the newly selected branch
    void loadBranchInventory(selectedBranch);
  }, [selectedBranch, loadBranchInventory]);

  const userDisplayName = getUserDisplayName(userSession?.user, "Manager");

  const isPerishableBusiness = React.useMemo(() => {
    const bizType = String(
      userSession?.user?.businessType || 
      userSession?.user?.businessMetrics?.bizType || 
      userSession?.user?.businessName || 
      "grocery"
    ).toLowerCase();
    
    return (
      bizType.includes("grocery") ||
      bizType.includes("pharmacy") ||
      bizType.includes("food") ||
      bizType.includes("dairy") ||
      bizType.includes("supermarket") ||
      bizType.includes("mart") ||
      bizType.includes("store") ||
      bizType.includes("intake") ||
      bizType.includes("inventra") // Default true for demo/sandbox
    );
  }, [userSession]);

  const shouldShowExpiryForProduct = React.useCallback((product) => {
    const hasExpiry = product.expiryDate && product.expiryDate !== "N/A" && String(product.expiryDate).trim() !== "";
    if (hasExpiry) return true;

    if (!isPerishableBusiness) return false;

    const perishableCategories = ["dairy", "bakery", "snacks", "beverages", "medicine", "pharmacy", "food"];
    const category = String(product.category || "").toLowerCase();
    return perishableCategories.some(c => category.includes(c));
  }, [isPerishableBusiness]);

  const shouldShowExpiryInput = React.useMemo(() => {
    return isPerishableBusiness;
  }, [isPerishableBusiness]);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "F8") {
        event.preventDefault();
        setShowScannerModal((current) => !current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;

    const handleGlobalKeyDown = (e) => {
      // Ignore if user is typing normally inside focused manual text inputs
      if (document.activeElement?.tagName === "INPUT" && document.activeElement !== scannerInputRef.current) {
        const delta = Date.now() - lastKeyTime;
        if (delta > 40) {
          buffer = "";
          return;
        }
      }

      const currentTime = Date.now();
      const isNumber = /^[0-9]$/.test(e.key);

      if (isNumber) {
        const timeDiff = currentTime - lastKeyTime;
        if (buffer.length === 0 || timeDiff < 40) {
          buffer += e.key;
          lastKeyTime = currentTime;
          if (timeDiff < 40 && buffer.length > 1) {
            e.preventDefault();
          }
        } else {
          buffer = e.key;
          lastKeyTime = currentTime;
        }
        return;
      }

      if (e.key === "Enter" && buffer.length >= 8) {
        const timeDiff = currentTime - lastKeyTime;
        if (timeDiff < 45) {
          e.preventDefault();
          e.stopPropagation();
          const finalBarcode = buffer;
          buffer = "";
          handleScanBarcode(finalBarcode);
        }
      }

      if (!isNumber && e.key !== "Enter") {
        buffer = "";
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [handleScanBarcode]);

  React.useEffect(() => {
    if (!showScannerModal) return undefined;
    const timer = window.setTimeout(() => scannerInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [showScannerModal]);

  React.useEffect(() => {
    if (!scannerFeedback) return undefined;
    const timer = window.setTimeout(() => setScannerFeedback(null), 2500);
    return () => window.clearTimeout(timer);
  }, [scannerFeedback]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !selectedBranch) return;
    try {
      sessionStorage.setItem(`inventra_inventory_showAddModal__${selectedBranch}`, String(showAddModal));
      sessionStorage.setItem(`inventra_inventory_showScannerModal__${selectedBranch}`, String(showScannerModal));
      sessionStorage.setItem(`inventra_inventory_newProduct__${selectedBranch}`, JSON.stringify(newProduct));
    } catch (e) {
      // ignore
    }
  }, [showAddModal, showScannerModal, newProduct, selectedBranch]);

  const productsWithBranchStock = React.useMemo(() => {
    return products.map((product) => {
      const branchStock = Number(product.stock || 0);
      return {
        ...product,
        branchStock,
        status: getStatus(branchStock, product.reorderLevel || 10),
      };
    });
  }, [products]);

  const branchSummaries = React.useMemo(() => {
    return branchNames
      .map((branchName) => {
        if (branchName === selectedBranch) {
          return (
            branchSummariesMap[branchName] ||
            summarizeInventoryItems(productsWithBranchStock)
          );
        }
        return branchSummariesMap[branchName] || { stock: 0, lowItems: 0 };
      })
      .map((summary, index) => ({
        branchName: branchNames[index],
        ...summary,
      }));
  }, [
    branchNames,
    branchSummariesMap,
    productsWithBranchStock,
    selectedBranch,
  ]);

  const activeSummary = branchSummaries.find(
    (summary) => summary.branchName === selectedBranch,
  ) || { stock: 0, lowItems: 0 };
  const categories = [
    "all",
    ...new Set(products.map((product) => product.category)),
  ];
  const filteredProducts = productsWithBranchStock.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const totalValue = filteredProducts.reduce(
    (sum, product) => sum + product.branchStock * product.price,
    0,
  );

  const handleBack = () => {
    sessionStorage.setItem("inventra_dashboard_section", "tasks");
    const fallbackTier = normalizeBusinessTier(
      getDashboardTierFromUser(userSession?.user) || normalizedTier,
    );
    setActiveTab(`dashboard-${fallbackTier}`);
  };

  const handleBranchSelect = (branchName) => {
    setSelectedBranch(branchName);
    setEditingId(null);
    void loadBranchInventory(branchName);

    // Restore state of the newly selected branch from session storage!
    try {
      const storedAddModal = sessionStorage.getItem(`inventra_inventory_showAddModal__${branchName}`) === "true";
      const storedScannerModal = sessionStorage.getItem(`inventra_inventory_showScannerModal__${branchName}`) === "true";
      
      const defaultProduct = {
        product_name: "",
        category: bizConfig.default,
        quantity: 0,
        purchase_price: 0,
        selling_price: 0,
        mrp: 0,
        gst_rate: getCategoryGstRate(bizConfig.default),
        discount_percent: 0,
        minimum_stock: 0,
        unit: "Units",
        barcode: "",
        sku: "",
        expiry_date: "",
      };
      const storedProductStr = sessionStorage.getItem(`inventra_inventory_newProduct__${branchName}`);
      const storedProduct = storedProductStr ? JSON.parse(storedProductStr) : defaultProduct;

      setShowAddModal(storedAddModal);
      setShowScannerModal(storedScannerModal);
      setNewProduct(storedProduct);
    } catch (e) {
      // ignore
    }
  };

  React.useEffect(() => {
    if (!selectedBranch) return;
    
    // Debounce saves to localStorage - wait 500ms after last change before saving
    const timer = setTimeout(() => {
      saveScopedInventoryProducts(products, selectedBranch);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [products, selectedBranch]);

  const handleStartEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      quantity: product.branchStock,
      selling_price: product.price,
      mrp: product.mrp ?? product.price,
      gst_rate: product.gstRate ?? product.gstPercentage ?? getCategoryGstRate(product.category),
      discount_percent: product.discountPercent ?? 0,
      minimum_stock: product.reorderLevel || 10,
    });
  };

  const handleSaveEdit = async (id) => {
    const currentProduct = productsWithBranchStock.find(
      (product) => product.id === id,
    );
    if (!currentProduct) return;

    const nextPayload = {
      product_name: currentProduct.name,
      category: currentProduct.category,
      barcode: currentProduct.barcode || undefined,
      quantity: Number(editForm.quantity),
      selling_price: Number(editForm.selling_price),
      mrp: Number(editForm.mrp || editForm.selling_price || 0),
      gst_rate: Number(editForm.gst_rate || 0),
      gst_percentage: Number(editForm.gst_rate || 0),
      discount_percent: Number(editForm.discount_percent || 0),
      sell_on_mrp: Number(editForm.discount_percent || 0) <= 0,
      minimum_stock: Number(editForm.minimum_stock),
      sku: currentProduct.sku || undefined,
      expiry_date: (currentProduct.expiryDate && currentProduct.expiryDate !== "N/A" && String(currentProduct.expiryDate).trim() !== "") ? currentProduct.expiryDate : null,
    };

    try {
      const response = await updateBranchInventoryItem(
        selectedBranch,
        currentProduct.id,
        nextPayload,
      );
      const nextProducts = hydrateInventoryProducts(
        response.inventory || response.items || [],
        [],
      );
      setProducts(nextProducts);
      setBranchSummariesMap((current) => ({
        ...current,
        [selectedBranch]: summarizeInventoryItems(nextProducts),
      }));
      setInventoryNotice(`Updated ${currentProduct.name}.`);
      setEditingId(null);
    } catch (error) {
      setInventoryError(error?.message || "Unable to update inventory item.");
    }
  };

  const handleAddProduct = async (event) => {
    event.preventDefault();
    const payload = {
      product_name: String(newProduct.product_name || "").trim(),
      category: String(newProduct.category || "Uncategorized").trim(),
      quantity: Number(newProduct.quantity || 0),
      purchase_price: Number(newProduct.purchase_price || 0),
      selling_price: Number(newProduct.selling_price || 0),
      mrp: Number(newProduct.mrp || newProduct.selling_price || 0),
      gst_rate: Number(newProduct.gst_rate || 0),
      gst_percentage: Number(newProduct.gst_rate || 0),
      discount_percent: Number(newProduct.discount_percent || 0),
      sell_on_mrp: Number(newProduct.discount_percent || 0) <= 0,
      minimum_stock: Number(newProduct.minimum_stock || 0),
      unit: String(newProduct.unit || "Units").trim(),
      barcode: String(newProduct.barcode || "").trim() || undefined,
      sku: String(newProduct.sku || "").trim() || undefined,
      expiry_date: (newProduct.expiry_date && String(newProduct.expiry_date).trim() !== "") ? newProduct.expiry_date : null,
    };

    try {
      const response = await createBranchInventoryItem(selectedBranch, payload);
      const nextProducts = hydrateInventoryProducts(
        response.inventory || response.items || [],
        [],
      );
      setProducts(nextProducts);
      setBranchSummariesMap((current) => ({
        ...current,
        [selectedBranch]: summarizeInventoryItems(nextProducts),
      }));
      setNewProduct({
        product_name: "",
        category: bizConfig.default,
        quantity: 0,
        purchase_price: 0,
        selling_price: 0,
        mrp: 0,
        gst_rate: getCategoryGstRate(bizConfig.default),
        discount_percent: 0,
        minimum_stock: 0,
        unit: "Units",
        barcode: "",
        sku: "",
        expiry_date: "",
      });
      setModalError("");
      setShowAddModal(false);
      setInventoryNotice(`Added ${payload.product_name} to ${selectedBranch}.`);
    } catch (error) {
      setModalError(error?.message || "Unable to add inventory item.");
      setInventoryError(error?.message || "Unable to add inventory item.");
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    try {
      const response = await deleteBranchInventoryItem(
        selectedBranch,
        product.id,
      );
      const nextProducts = hydrateInventoryProducts(
        response.inventory || response.items || [],
        [],
      );
      setProducts(nextProducts);
      setBranchSummariesMap((current) => ({
        ...current,
        [selectedBranch]: summarizeInventoryItems(nextProducts),
      }));
      setInventoryNotice(`Deleted ${product.name}.`);
      if (editingId === product.id) {
        setEditingId(null);
      }
    } catch (error) {
      setInventoryError(error?.message || "Unable to delete inventory item.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F6FAF8] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 lg:px-8 py-2 sm:py-2.5">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 sm:gap-2 text-slate-500 hover:text-slate-950 transition-colors shrink-0"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-[0.18em]">
                Dashboard
              </span>
            </button>
            <div className="hidden sm:block w-px h-7 bg-slate-200" />
            <div className="min-w-0">
              <span className="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-700">
                Inventory Operations
              </span>
              <h3 className="text-sm sm:text-base md:text-lg font-black leading-tight truncate">
                {selectedBranch}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">

            <span className="hidden md:inline text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
              {userDisplayName}
            </span>
            <span
              className="rounded-full px-2 sm:px-3 py-1 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.16em] text-white shrink-0"
              style={{ background: tierAccent }}
            >
              {tierBadgeLabel}
            </span>
          </div>
        </div>
      </header>

      <main className={`px-5 lg:px-8 py-4 ${userHasOwnerAccess(userSession?.user) ? "xl:pl-85" : ""}`}>
        {userHasOwnerAccess(userSession?.user) ? (
        <aside className="xl:fixed xl:left-0 xl:top-14.25 xl:h-[calc(100vh-57px)] xl:w-79 xl:flex xl:flex-col xl:overflow-hidden xl:border-r xl:border-slate-200 xl:bg-white xl:px-4 xl:py-4 xl:shadow-[0_1px_3px_rgba(0,0,0,0.05)] mb-5 xl:mb-0">
          <div className="rounded-[28px] border border-slate-100 bg-white px-5 py-5 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Branch Inventory
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5 leading-tight">
                  Inventory Rail
                </h2>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
            </div>
            <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">
              Choose a branch to inspect local stock, reorder pressure, and
              shelf value.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Units
                </div>
                <div className="mt-1 text-[11px] font-black text-slate-800 leading-tight">
                  {activeSummary?.stock || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Low Items
                </div>
                <div
                  className={`mt-1 text-[11px] font-black leading-tight ${(activeSummary?.lowItems || 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}
                >
                  {activeSummary?.lowItems || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            {branchSummaries.map((summary) => {
              const isActive = selectedBranch === summary.branchName;
              return (
                <button
                  key={summary.branchName}
                  onClick={() => handleBranchSelect(summary.branchName)}
                  className={`w-full text-left rounded-2xl border px-4 py-3 transition-all cursor-pointer relative overflow-hidden ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />
                  )}
                  <span className="block text-sm font-black text-slate-950">
                    {summary.branchName}
                  </span>
                  <span
                    className={`block text-[10px] font-black uppercase tracking-wider mt-1 ${summary.lowItems > 0 ? "text-amber-600" : "text-emerald-600"}`}
                  >
                    {summary.stock} units | {summary.lowItems} low
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
        ) : null}

        <section className="space-y-5">
          <div className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-white p-5 md:p-6 shadow-[0_14px_44px_rgba(15,23,42,0.06)]">
            <div className="absolute right-10 top-0 h-1.5 w-24 rounded-b-full bg-emerald-500" />
            <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Inventory Command Desk
                </span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mt-1">
                  {selectedBranch} Stock Ledger
                </h2>
                <p className="text-xs md:text-sm font-semibold text-slate-500 leading-relaxed max-w-2xl mt-3">
                  Branch-specific SKU visibility with local stock counts,
                  threshold status, expiry context, and editable inventory
                  controls.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    {isLoadingInventory
                      ? "Syncing branch inventory"
                      : inventoryNotice}
                  </span>
                  {inventoryError ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-rose-700">
                      {inventoryError}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setModalError("");
                      setShowAddModal(true);
                    }}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    + Add Inventory
                  </button>
                  <button
                    onClick={() => setShowScannerModal(true)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer"
                  >
                    Scan Barcode (F8)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 min-w-0 lg:min-w-107.5">
                {[
                  ["Local Units", activeSummary?.stock || 0],
                  ["Shelf Value", `₹${totalValue.toLocaleString("en-IN")}`],
                  ["Low Signals", activeSummary?.lowItems || 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"
                  >
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {label}
                    </span>
                    <span className="block text-lg font-black mt-1">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-5">
              <div className="relative">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search product or category..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:bg-white"
                />
              </div>
              <CustomDropdown
                value={selectedCategory}
                onChange={setSelectedCategory}
                options={categories.map((category) => ({
                  value: category,
                  label: category === "all" ? "All Categories" : category,
                }))}
                theme="emerald"
                buttonClassName="font-bold"
                className="w-full md:w-[220px]"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {filteredProducts.map((product) => {
                const isEditing = editingId === product.id;
                const gstRate = product.gstRate ?? product.gstPercentage ?? getCategoryGstRate(product.category);
                const statusClass =
                  product.status === "Critical"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : product.status === "Low Stock"
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : product.status === "Overstock"
                        ? "bg-orange-50 border-orange-200 text-orange-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700";

                return (
                  <div key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-slate-950 leading-tight">{product.name}</h3>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
                            {product.category}
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-[10px] font-bold text-slate-400">{product.barcode || "No barcode"}</div>
                        {shouldShowExpiryForProduct(product) && (
                          <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Expires {product.expiryDate || "N/A"}
                          </div>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusClass}`}>
                        {product.status}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          ["Selling Price", "selling_price", "number"],
                          ["MRP", "mrp", "number"],
                          ["GST %", "gst_rate", "number"],
                          ["Discount %", "discount_percent", "number"],
                          ["Quantity", "quantity", "number"],
                          ["Reorder Min", "minimum_stock", "number"],
                        ].map(([label, field, type]) => (
                          <label key={field} className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                            {label}
                            <input
                              type={type}
                              min={field === "discount_percent" || field === "gst_rate" ? "0" : undefined}
                              max={field === "discount_percent" || field === "gst_rate" ? "100" : undefined}
                              value={editForm[field]}
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  [field]: event.target.value,
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-black text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Pricing</div>
                          <div className="mt-1 font-black text-slate-950">Sell ₹{product.price}</div>
                          <div className="text-[10px] font-bold text-slate-500">MRP ₹{product.mrp ?? product.price}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Tax</div>
                          <div className="mt-1 font-black text-slate-950">GST {gstRate}%</div>
                          <div className="text-[10px] font-bold text-slate-500">Default {getCategoryGstRate(product.category)}%</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sale Policy</div>
                          <div className="mt-1 font-black text-slate-950">
                            {Number(product.discountPercent || 0) > 0 ? "Discounted sale" : "MRP sale"}
                          </div>
                          <div className="text-[10px] font-bold text-emerald-600">
                            {Number(product.discountPercent || 0) > 0 ? `${product.discountPercent}% discount` : "No discount"}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Stock</div>
                          <div className="mt-1 font-black text-slate-950">{product.branchStock} units</div>
                          <div className="text-[10px] font-bold text-slate-500">Min {product.reorderLevel || 10}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 sm:col-span-2">
                          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Inventory Value</div>
                          <div className="mt-1 font-black text-slate-950">₹{(product.branchStock * product.price).toLocaleString()}</div>
                          <div className="text-[10px] font-bold text-slate-500">{product.branchStock} x ₹{product.price}</div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(product.id)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(product)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-bold text-slate-500">
                  No inventory items match this search.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] overflow-hidden">
            
            {/* Header - Fixed */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">
                  Inventory Intake
                </span>
                <h3 className="text-xl font-black text-slate-950 mt-1">
                  Add New Product
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  Register product details, stock threshold, expiry, and barcode
                  for scanner workflows.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setModalError("");
                }}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Scrollable Body Container */}
            <div className="flex-1 overflow-y-auto p-5">
              {modalError && (
                <div className="mb-4 rounded-xl border px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-wider transition-all animate-fade-in flex items-start gap-2.5 bg-rose-50 border-rose-200 text-rose-800">
                  <span className="shrink-0 text-rose-600 font-black mt-0.5">⚠️</span>
                  <span className="break-words leading-relaxed flex-1">{modalError}</span>
                </div>
              )}

              <form
                id="add-product-form"
                onSubmit={handleAddProduct}
                className="grid grid-cols-1 md:grid-cols-3 gap-3"
              >
                <label className="block md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Product Name
                  </span>
                  <input
                    required
                    value={newProduct.product_name}
                    onChange={(event) => {
                      const name = event.target.value;
                      const recommendation = recommendProductCategoryAndGst(name, bizConfig.categories, newProduct.category);
                      setNewProduct((prev) => ({
                        ...prev,
                        product_name: name,
                        category: recommendation.category,
                        gst_rate: recommendation.gstRate,
                      }));
                      if (recommendation.matched) {
                        showIntakeToast("info", "AI Suggested", `${recommendation.category} Category with ${recommendation.gstRate}% GST`);
                      }
                    }}
                    placeholder="e.g. Soy Milk 1L"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:border-emerald-300 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Category
                  </span>
                  <CustomDropdown
                    value={newProduct.category}
                    onChange={(val) =>
                      setNewProduct({
                        ...newProduct,
                        category: val,
                        gst_rate: getCategoryGstRate(val),
                      })
                    }
                    options={bizConfig.categories.map((category) => ({
                      value: category,
                      label: category,
                    }))}
                    theme="emerald"
                    className="mt-1"
                    buttonClassName="font-bold"
                  />
                  <span className="mt-1 block text-[9px] font-bold text-emerald-600">
                    Suggested GST: {getCategoryGstRate(newProduct.category)}%
                  </span>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Barcode
                  </span>
                  <div className="relative mt-1 flex gap-2">
                    <input
                      value={newProduct.barcode}
                      onChange={(event) => {
                        const val = event.target.value;
                        setNewProduct((prev) => ({ ...prev, barcode: val }));
                        debouncedBarcodeLookup(val);
                      }}
                      placeholder="Scan or enter barcode"
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono font-bold outline-none focus:border-emerald-300 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => triggerSmartBarcodeLookup(newProduct.barcode)}
                      disabled={!newProduct.barcode || newProduct.barcode.trim().length < 8 || isLookupLoading}
                      className="px-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-300 hover:text-emerald-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95"
                      title="Smart Autofill Lookup"
                    >
                      {isLookupLoading ? (
                        <svg className="w-4 h-4 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l8.904-4.474m-8.904-.622L16.09 9.813M9 21.002h.002L18 12.09M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.379-3.379a.9.9 0 1 1-1.273-1.273.9.9 0 0 1 1.273 1.273Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Opening Qty
                  </span>
                  <input
                    required
                    type="number"
                    value={newProduct.quantity}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        quantity: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Unit Price
                  </span>
                  <input
                    required
                    type="number"
                    value={newProduct.selling_price}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        selling_price: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    MRP
                  </span>
                  <input
                    type="number"
                    value={newProduct.mrp}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        mrp: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    GST %
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newProduct.gst_rate}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        gst_rate: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black outline-none"
                  />
                  <span className="mt-1 block text-[9px] font-bold text-slate-400">
                    Category default: {getCategoryGstRate(newProduct.category)}%
                  </span>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Default Discount %
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newProduct.discount_percent}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        discount_percent: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Reorder Min
                  </span>
                  <input
                    required
                    type="number"
                    value={newProduct.minimum_stock}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        minimum_stock: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Purchase Price
                  </span>
                  <input
                    type="number"
                    value={newProduct.purchase_price}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        purchase_price: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Unit
                  </span>
                  <input
                    value={newProduct.unit}
                    onChange={(event) =>
                      setNewProduct({ ...newProduct, unit: event.target.value })
                    }
                    placeholder="Units / Packs / Bottles"
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black outline-none"
                  />
                </label>
                {shouldShowExpiryInput && (
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Expiry Date
                    </span>
                    <input
                      type="date"
                      value={newProduct.expiry_date}
                      onChange={(event) =>
                        setNewProduct({
                          ...newProduct,
                          expiry_date: event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none"
                    />
                  </label>
                )}
              </form>
            </div>

            {/* Footer - Fixed */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="submit"
                form="add-product-form"
                className="w-full md:w-auto md:px-10 rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-700 transition-all cursor-pointer"
              >
                Create Product
              </button>
            </div>

          </div>
        </div>
      )}

      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)] text-slate-200 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <div>
                  <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-white">
                    INVENTORY BARCODE SCANNER
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Scan with camera or use hardware wedge
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopScannerCamera();
                  setShowScannerModal(false);
                  setScannerFeedback(null);
                }}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Camera Select Dropdown */}
            {videoDevices.length > 1 && (
              <div className="flex items-center justify-between bg-slate-950/40 border border-slate-800 p-2.5 rounded-2xl gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Select Camera</span>
                <CustomDropdown
                  value={selectedDeviceId}
                  onChange={setSelectedDeviceId}
                  options={videoDevices.map((device) => ({
                    value: device.deviceId,
                    label: device.label || `Camera ${videoDevices.indexOf(device) + 1}`,
                  }))}
                  theme="rose"
                  size="sm"
                  buttonClassName="rounded-lg border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-black text-slate-200 focus:border-rose-500 max-w-[200px] truncate"
                  className="w-auto"
                  dark={true}
                />
              </div>
            )}

            <div className="relative aspect-video max-w-sm w-full mx-auto rounded-2xl bg-slate-955 border border-slate-800 overflow-hidden flex items-center justify-center">
              {showScannerModal && (
                <PureBarcodeScanner
                  selectedDeviceId={selectedDeviceId}
                  onDevicesFound={(devices, activeId) => {
                    setVideoDevices(devices);
                    if (activeId && !selectedDeviceId) {
                      setSelectedDeviceId(activeId);
                    }
                  }}
                  onScanSuccess={(text) => {
                    if (text) {
                      handleScanBarcode(text);
                    }
                  }}
                  onScanError={(err) => {
                    const errMsg = err.message || "";
                    if (
                      errMsg.includes("Permission") ||
                      errMsg.includes("NotAllowedError") ||
                      errMsg.includes("Requested device not found")
                    ) {
                      setScannerCameraStatus("error");
                      setScannerCameraMessage("Camera access denied or device unavailable.");
                    }
                  }}
                  setScannerCameraStatus={setScannerCameraStatus}
                  setScannerCameraMessage={setScannerCameraMessage}
                />
              )}

              <div className="absolute inset-0 bg-slate-950/40 z-20" />

              {/* Sweeping Laser Line */}
              <div className="scan-laser-line z-20" />

              {/* Corner Targets */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-rose-500 rounded-tl z-20" />
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-rose-500 rounded-tr z-20" />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-rose-500 rounded-bl z-20" />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-rose-500 rounded-br z-20" />

              {/* Central text indicator */}
              <div className="text-center z-30 pointer-events-none select-none px-4">
                <div className="text-[9px] font-black uppercase text-rose-500 tracking-[0.25em] animate-pulse-soft">
                  {scannerCameraStatus === "error" ? "CAMERA UNAVAILABLE" : "LIVE CAMERA SCAN ACTIVE"}
                </div>
                <div className="text-[8px] font-bold text-slate-300 tracking-wider mt-1">
                  {scannerCameraStatus === "error"
                    ? "Use manual barcode entry below"
                    : scannerCameraMessage || "READY TO READ EAN / UPC / CODE128"}
                </div>
              </div>
            </div>

            {/* Manual scan form */}
            <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleScanBarcode(scannerInput);
                }}
                className="flex gap-2"
              >
                <input
                  ref={scannerInputRef}
                  type="text"
                  placeholder="Enter barcode or wedge scan here..."
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-955 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer select-none"
                >
                  Scan Code
                </button>
              </form>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-rose-400 hover:text-rose-300 transition-all cursor-pointer select-none">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  Capture Autofocus Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageCapture}
                  />
                </label>
              </div>
            </div>

            {/* Scan Feedback notification */}
            {scannerFeedback && (
              <div
                className={`rounded-xl border p-3 flex items-start gap-2.5 animate-fade-in ${
                  scannerFeedback.status === "success"
                    ? "border-emerald-500/20 bg-emerald-950/40 text-emerald-300"
                    : "border-rose-500/20 bg-rose-950/40 text-rose-300"
                }`}
              >
                <span className="text-sm shrink-0">
                  {scannerFeedback.status === "success" ? "✓" : "⚠️"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest leading-none">
                    {scannerFeedback.status === "success"
                      ? "Scan Success"
                      : "Scan Error"}
                  </div>
                  <p className="text-[10.5px] font-bold mt-1 text-white truncate">
                    {scannerFeedback.message}
                  </p>
                </div>
              </div>
            )}

            {/* Close footer info */}
            <div className="text-center text-[9px] font-bold text-slate-500 tracking-wider">
              Press <span className="text-slate-400 font-black">F8</span>{" "}
              anytime to dismiss
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

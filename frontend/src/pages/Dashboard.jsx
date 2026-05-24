import React, { useState, useMemo, useEffect } from "react";
import {
  getBranchOpsTab,
  getBillingPosTab,
  getDashboardTab,
  getInventoryOpsTab,
  getTierBadgeLabel,
  getTierDisplayName,
  getUserDisplayName,
  normalizeBusinessTier,
} from "../utils/dashboard";
import { addBranchToNetwork, getBranchNetwork, getUserBranches, createBranch, updateBranch, deactivateBranch } from "../utils/branches";
import { toast } from "react-toastify";
import InventoryTable from "../components/InventoryTable";
import CSVUpload from "../components/CSVUpload";
import SmallDashboard from "../components/SmallDashboard";
import MediumDashboard from "../components/MediumDashboard";
import LargeDashboard from "../components/LargeDashboard";
import { INVENTORY_PRODUCT_SEED, loadInventoryProducts, saveInventoryProducts } from "../utils/inventory";

const DASHBOARD_CONFIG = {
  small: {
    label: "Starter Workspace Dashboard",
    strap: "Starter Intelligence Workspace",
    blurb: "A beginner-friendly workspace for single-location operators who need clarity, speed, and simple controls.",
    accent: "#0284C7",
    accentSoft: "rgba(2, 132, 199, 0.08)",
    shell: "#0284C7",
    summary: "Practical control panel for stock, billing, alerts, and day-to-day sales visibility.",
    profile: {
      role: "Owner / Store Manager",
      access: "Single-branch intelligence access",
      nextStep: "Set low stock parameters & review festival alerts.",
    },
  },
  medium: {
    label: "Growth Workspace Dashboard",
    strap: "Smart Operations Workspace",
    blurb: "Operational control for growing businesses that need forecasting, procurement discipline, and performance visibility.",
    accent: "#D97706",
    accentSoft: "rgba(217, 119, 6, 0.08)",
    shell: "#D97706",
    summary: "Balanced workspace for procurement, automated reorders, category segments, and reporting.",
    profile: {
      role: "Operations Director",
      access: "Multi-branch operations access",
      nextStep: "Tune supplier guidelines & approve open reorder POs.",
    },
  },
  large: {
    label: "Enterprise Command Dashboard",
    strap: "Enterprise Intelligence Command",
    blurb: "Enterprise command center for branch networks, warehouse distribution hubs, and NLP-powered AI insights.",
    accent: "#059669",
    accentSoft: "rgba(5, 150, 105, 0.08)",
    accentBase: "#059669",
    summary: "Central command center for regional demand, branch transfers, automated allocations, and NLP insights.",
    profile: {
      role: "Executive VP / Regional Director",
      access: "Consolidated enterprise control access",
      nextStep: "Verify regional demand heatmaps & run stock transfers.",
    },
  },
};

const COMMON_FEATURES = [
  "User authentication & authorization",
  "AI-generated alert center",
  "Automated GST invoicing billing POS",
  "Searchable inventory database",
  "Spreadsheet CSV upload calibration",
  "Persistent AI forecasting models",
  "Responsive layout grids",
];

const TIER_FEATURES = {
  small: [
    "Basic demand forecasting lines",
    "Expiry notification counters",
    "Festival demand alert multipliers",
    "Daily summary cards",
    "Fast-moving unit trackers",
    "Smart stock recommendations",
    "Simple analytics dashboard",
  ],
  medium: [
    "Advanced dual-path holiday forecasts",
    "Supplier reliability analytics",
    "Reorder PO checklist approvals",
    "Seasonal peak trend charts",
    "Category-wise donut segment ring",
    "Employee activity feed trackers",
    "Margin and profit Area charts",
  ],
  large: [
    "Multi-branch dropdown comparisons",
    "Drag-and-drop branch stock transfers",
    "Conversational NLP AI chat assistant",
    "Geographical regional heatmaps",
    "Consolidated group analytics",
    "Live branch alert tickers",
    "Warehouse aisle retrieval grids",
  ],
};

const WORKSPACE_TABS = [
  { key: "overview", label: "Overview Hub", icon: "🏠" },
  { key: "inventory", label: "Inventory Desk", icon: "📦" },
  { key: "billing", label: "Billing POS", icon: "🧾" },
  { key: "analytics", label: "AI Forecasts & Analytics", icon: "📊" },
  { key: "csv", label: "Spreadsheet Importer", icon: "📂" },
  { key: "profile", label: "Executive Profile", icon: "👤" },
];

const QUICK_LINKS = [
  { label: "AI Insights", icon: "✨" },
  { label: "Support", icon: "❔" },
  { label: "Documentation", icon: "📘" },
];

// ── Supported Countries with country codes and flags ──────────────────────────
const COUNTRIES = [
  { name: "India", code: "+91", flag: "🇮🇳" },
  { name: "United States", code: "+1", flag: "🇺🇸" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "United Arab Emirates", code: "+971", flag: "🇦🇪" },
  { name: "Canada", code: "+1", flag: "🇨🇦" },
  { name: "Australia", code: "+61", flag: "🇦🇺" },
  { name: "Singapore", code: "+65", flag: "🇸🇬" },
];

// ── Indian states list ──────────────────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman & Nicobar Islands","Chandigarh","Dadra & Nagar Haveli",
  "Daman & Diu","Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry",
];

// City to State mapper for smooth Indian location detection
const CITY_TO_STATE_MAP = {
  "mumbai": "Maharashtra",
  "pune": "Maharashtra",
  "nagpur": "Maharashtra",
  "nashik": "Maharashtra",
  "thane": "Maharashtra",
  "navi mumbai": "Maharashtra",
  "kolhapur": "Maharashtra",
  "solapur": "Maharashtra",
  "aurangabad": "Maharashtra",
  "amravati": "Maharashtra",
  "bangalore": "Karnataka",
  "bengaluru": "Karnataka",
  "mysore": "Karnataka",
  "mysuru": "Karnataka",
  "mangalore": "Karnataka",
  "mangaluru": "Karnataka",
  "hubli": "Karnataka",
  "hubballi": "Karnataka",
  "belgaum": "Karnataka",
  "belagavi": "Karnataka",
  "chennai": "Tamil Nadu",
  "coimbatore": "Tamil Nadu",
  "madurai": "Tamil Nadu",
  "trichy": "Tamil Nadu",
  "tiruchirappalli": "Tamil Nadu",
  "salem": "Tamil Nadu",
  "tirunelveli": "Tamil Nadu",
  "delhi": "Delhi",
  "new delhi": "Delhi",
  "noida": "Uttar Pradesh",
  "greater noida": "Uttar Pradesh",
  "ghaziabad": "Uttar Pradesh",
  "lucknow": "Uttar Pradesh",
  "kanpur": "Uttar Pradesh",
  "agra": "Uttar Pradesh",
  "varanasi": "Uttar Pradesh",
  "prayagraj": "Uttar Pradesh",
  "allahabad": "Uttar Pradesh",
  "meerut": "Uttar Pradesh",
  "bareilly": "Uttar Pradesh",
  "aligarh": "Uttar Pradesh",
  "moradabad": "Uttar Pradesh",
  "gurgaon": "Haryana",
  "gurugram": "Haryana",
  "faridabad": "Haryana",
  "panipat": "Haryana",
  "ambala": "Haryana",
  "rohtak": "Haryana",
  "kolkata": "West Bengal",
  "howrah": "West Bengal",
  "darjeeling": "West Bengal",
  "durgapur": "West Bengal",
  "siliguri": "West Bengal",
  "asansol": "West Bengal",
  "hyderabad": "Telangana",
  "warangal": "Telangana",
  "secunderabad": "Telangana",
  "nizamabad": "Telangana",
  "ahmedabad": "Gujarat",
  "surat": "Gujarat",
  "vadodara": "Gujarat",
  "rajkot": "Gujarat",
  "bhavnagar": "Gujarat",
  "jamnagar": "Gujarat",
  "jaipur": "Rajasthan",
  "jodhpur": "Rajasthan",
  "udaipur": "Rajasthan",
  "kota": "Rajasthan",
  "bikaner": "Rajasthan",
  "ajmer": "Rajasthan",
  "indore": "Madhya Pradesh",
  "bhopal": "Madhya Pradesh",
  "gwalior": "Madhya Pradesh",
  "jabalpur": "Madhya Pradesh",
  "ujjain": "Madhya Pradesh",
  "chandigarh": "Chandigarh",
  "amritsar": "Punjab",
  "ludhiana": "Punjab",
  "jalandhar": "Punjab",
  "patiala": "Punjab",
  "kochi": "Kerala",
  "trivandrum": "Kerala",
  "thiruvananthapuram": "Kerala",
  "calicut": "Kerala",
  "kozhikode": "Kerala",
  "thrissur": "Kerala",
  "kollam": "Kerala",
  "patna": "Bihar",
  "gaya": "Bihar",
  "muzaffarpur": "Bihar",
  "bhagalpur": "Bihar",
  "ranchi": "Jharkhand",
  "jamshedpur": "Jharkhand",
  "dhanbad": "Jharkhand",
  "bhubaneswar": "Odisha",
  "cuttack": "Odisha",
  "puri": "Odisha",
  "rourkela": "Odisha",
  "guwahati": "Assam",
  "dibrugarh": "Assam",
  "silchar": "Assam",
  "jorhat": "Assam",
  "dehradun": "Uttarakhand",
  "haridwar": "Uttarakhand",
  "nainital": "Uttarakhand",
  "rishikesh": "Uttarakhand",
  "shimla": "Himachal Pradesh",
  "dharamshala": "Himachal Pradesh",
  "manali": "Himachal Pradesh",
  "raipur": "Chhattisgarh",
  "bilaspur": "Chhattisgarh",
  "bhilai": "Chhattisgarh",
  "panaji": "Goa",
  "margao": "Goa",
  "vasco da gama": "Goa",
  "srinagar": "Jammu & Kashmir",
  "jammu": "Jammu & Kashmir",
  "visakhapatnam": "Andhra Pradesh",
  "vijayawada": "Andhra Pradesh",
  "guntur": "Andhra Pradesh",
  "tirupati": "Andhra Pradesh",
  "nellore": "Andhra Pradesh",
};

function getStateForCity(city) {
  if (!city) return "";
  const normalized = city.trim().toLowerCase();
  return CITY_TO_STATE_MAP[normalized] || "";
}

const BRANCH_TYPES = [
  { value: "Store",     icon: "🏪", desc: "Retail outlet" },
  { value: "Warehouse", icon: "🏭", desc: "Storage hub" },
  { value: "Franchise", icon: "🤝", desc: "Licensed store" },
  { value: "Depot",     icon: "📦", desc: "Wholesale depot" },
];

const WORKING_HOURS_PRESETS = [
  "8AM-8PM", "9AM-9PM", "9AM-6PM", "10AM-10PM", "24 Hours",
];

const EMPTY_BRANCH_FORM = {
  branch_name:        "",
  branch_code:        "",
  branch_type:        "Store",
  address:            "",
  city:               "",
  state:              "",
  pincode:            "",
  country:            "India",
  phone:              "",
  phone_country_code: "+91",
  phone_number:       "",
  manager_name:       "",
  employee_count:     1,
  working_hours:      "9AM-9PM",
  opening_date:       "",
  gstin:              "",
};

// Auto-generate an intelligent branch code from the name
function autoCode(name) {
  if (!name) return "";
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, "").trim().toUpperCase();
  const words = clean.split(/\s+/).filter(w => !["AND", "THE", "OF", "IN", "AT", "FOR", "BY", "WITH"].includes(w));
  
  if (words.length === 0) return "BR-01";
  
  const dict = {
    "MUMBAI": "MUM", "PUNE": "PUN", "DELHI": "DEL", "BANGALORE": "BLR", "BENGALURU": "BLR",
    "KOLKATA": "KOL", "CHENNAI": "MAA", "HYDERABAD": "HYD", "AHMEDABAD": "AMD", "JAIPUR": "JPR",
    "FLAGSHIP": "FLG", "BOUTIQUE": "BTQ", "STORE": "STR", "WAREHOUSE": "WH", "DEPOT": "DEP",
    "FRANCHISE": "FRN", "OUTLET": "OUT", "OFFICE": "OFF", "HEADQUARTERS": "HQ", "CENTRAL": "CTL",
    "RETAIL": "RTL", "EXPERIENCE": "EXP", "STUDIO": "STD"
  };

  const translate = (w) => dict[w] || (w.length <= 4 ? w : w.slice(0, 3));

  if (words.length === 1) {
    const w = words[0];
    return w.length <= 6 ? `${w}-01` : `${w.slice(0, 4)}-01`;
  }
  
  const parts = words.map(translate);
  if (parts[0].length > 5) parts[0] = parts[0].slice(0, 4);

  return parts.join("-").slice(0, 12);
}

// Step indicator dot (Larger, elegant, perfectly contrastive on white background)
function StepDot({ n, current, label }) {
  const done = n < current;
  const active = n === current;
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 relative">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
          done
            ? "bg-emerald-500 text-white shadow-[0_3px_10px_rgba(16,185,129,0.2)]"
            : active
            ? "bg-slate-900 text-white ring-4 ring-slate-900/10 shadow-[0_3px_10px_rgba(15,23,42,0.1)]"
            : "bg-slate-100 text-slate-550 border border-slate-200/80"
        }`}
      >
        {done ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : n}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-[0.14em] hidden sm:block ${active ? "text-slate-800" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}

function StepConnector({ done }) {
  return (
    <div className="flex-1 self-center px-1 mb-4">
      <div className={`h-[2.5px] w-full rounded-full transition-colors duration-500 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
    </div>
  );
}

export default function Dashboard({ tier = "small", setActiveTab }) {
  const normalizedTier = normalizeBusinessTier(tier);
  const config = DASHBOARD_CONFIG[normalizedTier];
  const tierDisplayName = getTierDisplayName(normalizedTier);
  const tierBadgeLabel = getTierBadgeLabel(normalizedTier);

  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("inventra_dashboard_section");
      if (saved) return saved;
    }
    return "overview";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("inventra_dashboard_section", activeSection);
    }
  }, [activeSection]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showAlertMenu, setShowAlertMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  
  // Wizard States
  const [modalStep, setModalStep] = useState(1);
  const [modalForm, setModalForm] = useState(EMPTY_BRANCH_FORM);
  const [modalErrors, setModalErrors] = useState({});
  const [modalDropdownOpen, setModalDropdownOpen] = useState(false);
  const [modalDropdownSearch, setModalDropdownSearch] = useState("");
  const [modalCountryDropdownOpen, setModalCountryDropdownOpen] = useState(false);
  const [modalPhonePrefixOpen, setModalPhonePrefixOpen] = useState(false);

  // Sync branches draft auto code generation if name updates
  useEffect(() => {
    if (modalForm.branch_name && !modalForm.branch_code) {
      setModalForm((p) => ({ ...p, branch_code: autoCode(modalForm.branch_name) }));
    }
  }, [modalForm.branch_name, modalForm.branch_code]);

  // Outside click listener for custom dropdowns
  useEffect(() => {
    if (!modalDropdownOpen && !modalCountryDropdownOpen && !modalPhonePrefixOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".custom-dropdown-container")) {
        setModalDropdownOpen(false);
      }
      if (!e.target.closest(".custom-country-container")) {
        setModalCountryDropdownOpen(false);
      }
      if (!e.target.closest(".custom-phone-prefix-container")) {
        setModalPhonePrefixOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [modalDropdownOpen, modalCountryDropdownOpen, modalPhonePrefixOpen]);

  const [branchNetwork, setBranchNetwork] = useState(() => getBranchNetwork(normalizedTier));
  const [branchesList, setBranchesList] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("inventra_branches_list");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return [];
  });
  const [expandedBranches, setExpandedBranches] = useState({});
  const [firstLoadDone, setFirstLoadDone] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("inventra_branches_list");
  });

  // Sync branches from DB on mount
  useEffect(() => {
    getUserBranches()
      .then((data) => {
        if (data && data.branches) {
          const names = data.branches.map((b) => b.branch_name);
          setBranchNetwork(names);
          setBranchesList(data.branches);
          try {
            localStorage.setItem("inventra_branches_list", JSON.stringify(data.branches));
          } catch (e) {}
        }
        setFirstLoadDone(true);
      })
      .catch((err) => {
        console.error("Failed to load branches from DB:", err);
        setFirstLoadDone(true);
      });
  }, [normalizedTier, setActiveTab]);

  // States for Medium and Large Analytics Page redone visually
  const [mediumRange, setMediumRange] = useState("30d");
  const [hoveredCategory, setHoveredCategory] = useState(null);
  
  // Large tier NLP Chat console simulation states
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: "user", text: "Explain our current seasonal category demand spike." },
    { role: "assistant", text: "Our ML engine detected a 1.8x multiplier in Beverages and Snacks due to seasonal holiday behavior. Recommend increasing reorder buffers for Apex and Metro distributors by 15%." }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // Large tier heatmap active branch state
  const [activeBranch, setActiveBranch] = useState("Mumbai");

  // Global Products State seeded with high-fidelity items
  const [products, setProducts] = useState(() => loadInventoryProducts(INVENTORY_PRODUCT_SEED));

  useEffect(() => {
    saveInventoryProducts(products);
  }, [products]);

  // Consolidated Sales Metrics States
  const [salesCount, setSalesCount] = useState(14);
  const [salesRevenue, setSalesRevenue] = useState(42800);

  // Alert Notifications States
  const [notifications, setNotifications] = useState([
    { id: 1, text: "Dairy Milk 1L is expiring in 24 hours!", type: "expiry" },
    { id: 2, text: "Fresh Bread and Potato Chips stocks fell under reorder thresholds.", type: "low_stock" },
    { id: 3, text: "Diwali peak trigger: beverages and snacks demand expected to surge 1.8x.", type: "festival" },
  ]);

  const userSession = useMemo(() => {
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
  }, []);

  const [userProfile, setUserProfile] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("inventra_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ firstName: "", lastName: "", businessName: "", email: "" });

  useEffect(() => {
    if (userProfile) {
      setProfileDraft({
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        businessName: userProfile.businessName || userProfile.company || "",
        email: userProfile.email || "",
      });
    }
  }, [userProfile]);

  const userDisplayName = getUserDisplayName(userProfile || userSession?.user, "Manager");

  const openEditProfile = () => {
    setProfileDraft({
      firstName: (userProfile?.firstName || userSession?.user?.firstName || ""),
      lastName: (userProfile?.lastName || userSession?.user?.lastName || ""),
      businessName: (userProfile?.businessName || userSession?.user?.businessName || userSession?.user?.company || ""),
      email: (userProfile?.email || userSession?.user?.email || ""),
    });
    setEditingProfile(true);
  };

  const handleSaveProfile = (ev) => {
    ev.preventDefault();
    const updated = {
      ...(userProfile || {}),
      firstName: String(profileDraft.firstName || "").trim(),
      lastName: String(profileDraft.lastName || "").trim(),
      businessName: String(profileDraft.businessName || "").trim(),
      email: String(profileDraft.email || "").trim(),
      role: "OWNER",
    };
    try {
      localStorage.setItem("inventra_user", JSON.stringify(updated));
    } catch (e) {
      // ignore storage errors
    }
    setUserProfile(updated);
    setEditingProfile(false);
  };

  const tierFeatures = TIER_FEATURES[normalizedTier];

  const handleLogout = () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem("inventra_token");
      storage.removeItem("inventra_user");
    }
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
      sessionStorage.removeItem("inventra_dashboard_section");
    }
    setActiveTab("home");
  };

  const handleRecordSale = (cartItems, totalPaid) => {
    // 1. Deduct stock from global products
    setProducts((currentProducts) =>
      currentProducts.map((p) => {
        const cartItem = cartItems.find((item) => item.id === p.id);
        if (cartItem) {
          return { 
            ...p, 
            stock: Math.max(0, p.stock - cartItem.quantity),
            sold: (p.sold || 0) + cartItem.quantity
          };
        }
        return p;
      })
    );

    // 2. Increment sales indicators
    setSalesCount((prev) => prev + 1);
    setSalesRevenue((prev) => prev + Math.round(totalPaid));
  };

  // Dynamically update low stock/expiry alerts when stock updates
  useEffect(() => {
    const activeAlerts = [];
    
    // Low stock scanner
    const lowStockItems = products.filter(p => p.stock <= (p.reorderLevel || 10));
    if (lowStockItems.length > 0) {
      activeAlerts.push({
        id: 2,
        text: `Low stock alert: ${lowStockItems.map(p => p.name).join(", ")} are under threshold buffer limits!`,
        type: "low_stock"
      });
    }

    // Expiry scanner
    const soonExpiring = products.filter(p => {
      if (!p.expiryDate) return false;
      const diff = new Date(p.expiryDate) - new Date("2026-05-22");
      return diff > 0 && diff <= 5 * 24 * 60 * 60 * 1000;
    });
    if (soonExpiring.length > 0) {
      activeAlerts.push({
        id: 1,
        text: `Urgent expiry warning: ${soonExpiring.map(p => p.name).join(", ")} approaching expiration parameters!`,
        type: "expiry"
      });
    }

    // Festival standard warning
    activeAlerts.push({
      id: 3,
      text: "ML demand forecast model calibration: upcoming holiday peak expected to surge soft items 1.8x.",
      type: "festival"
    });

    setNotifications(activeAlerts);
  }, [products]);

  const handleCSVUploadComplete = () => {
    // Simulate updating stock values and adding 10 transactions upon CSV parse completion
    setProducts((currentProducts) =>
      currentProducts.map((p) => ({
        ...p,
        stock: p.stock + Math.floor(10 + Math.random() * 20),
        sold: (p.sold || 0) + Math.floor(5 + Math.random() * 15)
      }))
    );
    setSalesCount((prev) => prev + 10);
    setSalesRevenue((prev) => prev + 14500);
  };

  const handleClearAlert = (id) => {
    setNotifications(prev => prev.filter(x => x.id !== id));
  };

  const validateModalStep = (s) => {
    const e = {};
    if (s === 1) {
      if (!modalForm.branch_name.trim()) e.branch_name = "Branch name is required";
      if (!modalForm.branch_code.trim()) e.branch_code = "Branch code is required";
    }
    if (s === 2) {
      if (!modalForm.address.trim()) e.address = "Address is required";
      if (!modalForm.city.trim()) e.city = "City is required";
      if (!modalForm.state) e.state = "State is required";
      if (!modalForm.country) e.country = "Country is required";
      if (!modalForm.pincode.trim()) e.pincode = "Pincode is required";
      else if (!/^\d{4,10}$/.test(modalForm.pincode)) e.pincode = "Enter a valid pincode";
    }
    if (s === 3) {
      if (!modalForm.phone_number.trim()) e.phone = "Phone number is required";
      else if (!/^\+?[\d\s\-]{7,15}$/.test((modalForm.phone_country_code + modalForm.phone_number).replace(/\s+/g, ""))) e.phone = "Enter a valid phone number";
      if (!modalForm.manager_name.trim()) e.manager_name = "Manager name is required";
    }
    return e;
  };

  const goNextModalStep = () => {
    const e = validateModalStep(modalStep);
    if (Object.keys(e).length) { setModalErrors(e); return; }
    setModalErrors({});
    setModalStep((s) => Math.min(4, s + 1));
  };

  const goBackModalStep = () => setModalStep((s) => Math.max(1, s - 1));

  const setModalFormField = (k, v) => {
    setModalForm((p) => ({ ...p, [k]: v }));
    setModalErrors((p) => { const n = { ...p }; delete n[k]; return n; });
  };

  const handleAddBranch = async () => {
    const e = validateModalStep(modalStep);
    if (Object.keys(e).length) { setModalErrors(e); return; }
    
    const payload = {
      branch_name:    modalForm.branch_name.trim(),
      branch_code:    modalForm.branch_code.trim().toUpperCase(),
      branch_type:    modalForm.branch_type,
      address:        modalForm.address.trim(),
      city:           modalForm.city.trim(),
      state:          modalForm.state,
      country:        modalForm.country,
      pincode:        modalForm.pincode.trim(),
      phone:          (modalForm.phone_country_code + " " + modalForm.phone_number.trim()).trim(),
      manager_name:   modalForm.manager_name.trim(),
      employee_count: Number(modalForm.employee_count) || 1,
      working_hours:  modalForm.working_hours,
      opening_date:   modalForm.opening_date || null,
      gstin:          modalForm.gstin.trim() || null,
      status:         "Active",
    };

    setLoading(true);
    try {
      let result;
      if (modalForm._id) {
        result = await updateBranch(modalForm._id, payload);
      } else {
        result = await createBranch(payload);
      }
      
      // Update cache
      addBranchToNetwork(result);
      
      // Sync branches from DB
      const data = await getUserBranches();
      if (data && data.branches) {
        setBranchNetwork(data.branches.map(b => b.branch_name));
        setBranchesList(data.branches);
        try {
          localStorage.setItem("inventra_branches_list", JSON.stringify(data.branches));
        } catch (e) {}
      } else {
        setBranchNetwork((prev) => [...prev, result.branch_name]);
        setBranchesList((prev) => {
          const next = [...prev, result];
          try {
            localStorage.setItem("inventra_branches_list", JSON.stringify(next));
          } catch (e) {}
          return next;
        });
      }
      
      toast.success(
        <div className="flex w-full items-center gap-3 px-3.5 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-emerald-250 bg-emerald-50 text-emerald-700 text-xs font-black shadow-sm">✓</div>
          <div className="min-w-0 flex-1 pr-8 text-left">
            <div className="font-heading text-[0.86rem] font-extrabold tracking-[-0.02em] text-emerald-700">
              {modalForm._id ? "Branch Updated" : "Branch Added"}
            </div>
            <div className="mt-0.5 text-[0.78rem] font-semibold text-emerald-950/80">
              {modalForm.branch_name} {modalForm._id ? "successfully updated inside database." : "registered in database as " + modalForm.branch_code + "."}
            </div>
          </div>
        </div>,
        {
          className: "inventra-toast inventra-toast--success",
          bodyClassName: "inventra-toast__body",
          icon: false,
          closeOnClick: false,
          pauseOnHover: true,
          autoClose: 3500,
        }
      );
      
      setModalForm(EMPTY_BRANCH_FORM);
      setModalStep(1);
      setShowAddBranchModal(false);
    } catch (err) {
      toast.error(
        <div className="flex w-full items-center gap-3 px-3.5 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-rose-250 bg-rose-50 text-rose-700 text-xs font-black">!</div>
          <div className="min-w-0 flex-1 pr-8 text-left">
            <div className="font-heading text-[0.86rem] font-extrabold tracking-[-0.02em] text-rose-700">Failed to Save Branch</div>
            <div className="mt-0.5 text-[0.78rem] font-semibold text-rose-950/80">{err.message || "Unable to communicate with the server."}</div>
          </div>
        </div>,
        {
          className: "inventra-toast inventra-toast--error",
          bodyClassName: "inventra-toast__body",
          icon: false,
          closeOnClick: false,
          pauseOnHover: true,
          autoClose: 4200,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditBranch = async (branch) => {
    try {
      setLoading(true);
      const phoneRaw = branch.phone || "";
      let phone_country_code = "+91";
      let phone_number = phoneRaw;
      const m = phoneRaw.match(/^(\+\d+)\s*(.*)$/);
      if (m) {
        phone_country_code = m[1];
        phone_number = m[2] || "";
      }

      setModalForm({
        branch_name: branch.branch_name || "",
        branch_code: branch.branch_code || "",
        branch_type: branch.branch_type || "Store",
        address: branch.address || "",
        city: branch.city || "",
        state: branch.state || "",
        pincode: branch.pincode || "",
        country: branch.country || "India",
        phone: phoneRaw,
        phone_country_code,
        phone_number,
        manager_name: branch.manager_name || "",
        employee_count: branch.employee_count || 1,
        working_hours: branch.working_hours || "9AM-9PM",
        opening_date: branch.opening_date || "",
        gstin: branch.gstin || "",
        _id: branch._id || branch.branch_id || null,
      });

      setModalStep(1);
      setModalErrors({});
      setShowAddBranchModal(true);
    } catch (err) {
      toast.error(
        <div className="flex w-full items-center gap-3 px-3.5 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-rose-250 bg-rose-50 text-rose-700 text-xs font-black">!</div>
          <div className="min-w-0 flex-1 pr-8 text-left">
            <div className="font-heading text-[0.86rem] font-extrabold tracking-[-0.02em] text-rose-700">Edit Failed</div>
            <div className="mt-0.5 text-[0.78rem] font-semibold text-rose-950/80">{err.message || "Unable to open edit form"}</div>
          </div>
        </div>,
        {
          className: "inventra-toast inventra-toast--error",
          bodyClassName: "inventra-toast__body",
          icon: false,
          closeOnClick: false,
          pauseOnHover: true,
          autoClose: 4200,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (branchId) => {
    if (!window.confirm("Are you sure you want to permanently deactivate this branch?")) return;
    setLoading(true);
    try {
      await deactivateBranch(branchId);
      
      const data = await getUserBranches();
      if (data && data.branches) {
        setBranchNetwork(data.branches.map(b => b.branch_name));
        setBranchesList(data.branches);
        try {
          localStorage.setItem("inventra_branches_list", JSON.stringify(data.branches));
        } catch (e) {}
      }
      
      toast.success(
        <div className="flex w-full items-center gap-3 px-3.5 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-emerald-250 bg-emerald-50 text-emerald-700 text-xs font-black shadow-sm">✓</div>
          <div className="min-w-0 flex-1 pr-8 text-left">
            <div className="font-heading text-[0.86rem] font-extrabold tracking-[-0.02em] text-emerald-700">Branch Removed</div>
            <div className="mt-0.5 text-[0.78rem] font-semibold text-emerald-950/80">Branch node deactivated and removed from live system.</div>
          </div>
        </div>,
        {
          className: "inventra-toast inventra-toast--success",
          bodyClassName: "inventra-toast__body",
          icon: false,
          closeOnClick: false,
          pauseOnHover: true,
          autoClose: 3500,
        }
      );
    } catch (err) {
      toast.error(
        <div className="flex w-full items-center gap-3 px-3.5 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-rose-250 bg-rose-50 text-rose-700 text-xs font-black">!</div>
          <div className="min-w-0 flex-1 pr-8 text-left">
            <div className="font-heading text-[0.86rem] font-extrabold tracking-[-0.02em] text-rose-700">Deactivation Failed</div>
            <div className="mt-0.5 text-[0.78rem] font-semibold text-rose-950/80">{err.message || "Failed to remove branch"}</div>
          </div>
        </div>,
        {
          className: "inventra-toast inventra-toast--error",
          bodyClassName: "inventra-toast__body",
          icon: false,
          closeOnClick: false,
          pauseOnHover: true,
          autoClose: 4200,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBranchOperations = (branchName) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("inventra_selected_branch", branchName);
    }
    setActiveTab(getBranchOpsTab(normalizedTier));
  };

  // ==========================================
  // HIGH-FIDELITY CUSTOM VISUALIZATIONS
  // ==========================================

  const renderInteractiveSeasonalChart = () => {
    const width = 500;
    const height = 180;
    const padding = 20;

    // Support two ranges: "7d" and "30d"
    const dates = mediumRange === "7d" 
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8"];
      
    const baseLine = mediumRange === "7d"
      ? [120, 145, 130, 205, 230, 310, 290]
      : [110, 135, 120, 175, 190, 260, 280, 340];
      
    const upperLine = baseLine.map(v => v + 30);
    const lowerLine = baseLine.map(v => v - 25);

    const maxVal = Math.max(...upperLine);
    const minVal = Math.min(...lowerLine);
    const range = maxVal - minVal || 1;

    const getX = (index) => padding + (index / (dates.length - 1)) * (width - padding * 2);
    const getY = (val) => height - padding - 15 - ((val - minVal) / range) * (height - padding - 35);

    const baseCoords = baseLine.map((val, idx) => `${getX(idx)},${getY(val)}`);
    const upperCoords = upperLine.map((val, idx) => `${getX(idx)},${getY(val)}`);
    const lowerCoords = lowerLine.map((val, idx) => `${getX(idx)},${getY(val)}`);

    const shadePath = [
      `M ${upperCoords[0]}`,
      ...upperCoords.slice(1).map(c => `L ${c}`),
      ...lowerCoords.reverse().map(c => `L ${c}`),
      "Z"
    ].join(" ");

    const baseD = `M ${baseCoords.join(" L ")}`;

    return (
      <div className="space-y-4">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-sm hover:border-amber-200 transition-colors text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Model Confidence</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-amber-600">98.4%</span>
              <span className="text-[9px] font-bold text-emerald-600">Optimal</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-sm hover:border-amber-200 transition-colors text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Weekly Revenue</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-slate-800">₹1,42,800</span>
              <span className="text-[9px] font-bold text-emerald-600">+18.4%</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-sm hover:border-amber-200 transition-colors text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Weekend Peak</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-rose-605">1.8x</span>
              <span className="text-[9px] font-bold text-rose-500">Holiday Surge</span>
            </div>
          </div>
        </div>

        {/* Dynamic Interactive SVG */}
        <div className="relative border border-slate-200/60 bg-gradient-to-b from-slate-50 to-white rounded-2xl p-4 shadow-inner">
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible select-none">
            <defs>
              <linearGradient id="forecast-glow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97706" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#D97706" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {Array.from({ length: 4 }).map((_, i) => {
              const y = padding + (i / 3) * (height - padding * 2 - 15);
              return <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#F1F5F9" strokeWidth="1.5" strokeDasharray="4 4" />;
            })}

            {/* Shaded Corridor */}
            <path d={shadePath} fill="url(#forecast-glow)" />

            {/* Dash Boundary Lines */}
            <path d={`M ${upperCoords.join(" L ")}`} fill="none" stroke="#D97706" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
            <path d={`M ${lowerCoords.join(" L ")}`} fill="none" stroke="#D97706" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />

            {/* Main actual curve */}
            <path d={baseD} fill="none" stroke="#D97706" strokeWidth="3.5" strokeLinecap="round" />

            {/* Active Highlight Points */}
            {baseLine.map((val, idx) => {
              const cx = getX(idx);
              const cy = getY(val);
              const isPeak = idx === (mediumRange === "7d" ? 5 : 7);
              return (
                <g key={idx} className="cursor-pointer group">
                  <circle cx={cx} cy={cy} r="6" fill="#D97706" opacity="0" className="hover:opacity-20 transition-all duration-205" />
                  <circle cx={cx} cy={cy} r="3.5" fill="#FFFFFF" stroke="#D97706" strokeWidth="2.5" />
                  {isPeak && (
                    <g>
                      <path d={`M ${cx} ${cy - 8} L ${cx} ${cy - 20}`} stroke="#EF4444" strokeWidth="1.5" strokeDasharray="2 2" />
                      <rect x={cx - 30} y={cy - 34} width="60" height="13" rx="4" fill="#EF4444" />
                      <text x={cx} y={cy - 25} fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle">
                        WEEKEND PEAK
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Axis Date Labels */}
            {dates.map((date, idx) => (
              <text key={idx} x={getX(idx)} y={height - 2} fill="#94A3B8" fontSize="9" fontWeight="black" className="uppercase tracking-wider" textAnchor="middle">
                {date}
              </text>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  const renderInteractiveDonutChart = () => {
    const size = 160;
    const center = size / 2;
    const radius = 55;
    const strokeWidth = 16;
    const circumference = 2 * Math.PI * radius;

    const categories = [
      { label: "Dairy", val: 40, color: "#10B981", money: "₹57,120", status: "Fast Moving", fill: "98% Fill" },
      { label: "Beverages", val: 30, color: "#0EA5E9", money: "₹42,840", status: "Seasonal Spike", fill: "97% Fill" },
      { label: "Snacks", val: 20, color: "#D97706", money: "₹28,560", status: "High Margin", fill: "89% Fill" },
      { label: "Bakery", val: 10, color: "#EC4899", money: "₹14,280", status: "Critical Expiry", fill: "91% Fill" },
    ];

    let currentOffset = 0;

    return (
      <div className="flex flex-col sm:flex-row items-center gap-6 justify-between text-left">
        {/* Interactive SVG Ring */}
        <div className="relative select-none shrink-0 mx-auto">
          <svg width={size} height={size} className="overflow-visible">
            {/* Background base circle */}
            <circle cx={center} cy={center} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
            
            {categories.map((c, i) => {
              const dashArray = `${(c.val / 100) * circumference} ${circumference}`;
              const dashOffset = currentOffset;
              currentOffset -= (c.val / 100) * circumference;
              
              const isHovered = hoveredCategory === i;
              const isAnyHovered = hoveredCategory !== null;

              return (
                <circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${center} ${center})`}
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer"
                  opacity={isAnyHovered && !isHovered ? "0.35" : "1"}
                  onMouseEnter={() => setHoveredCategory(i)}
                  onMouseLeave={() => setHoveredCategory(null)}
                />
              );
            })}

            {/* Centered label */}
            <g className="pointer-events-none">
              <text x={center} y={center - 6} textAnchor="middle" fill="#94A3B8" fontSize="8" fontWeight="black" className="uppercase tracking-widest">
                TOTAL SALES
              </text>
              <text x={center} y={center + 10} textAnchor="middle" fill="#0F172A" fontSize="13" fontWeight="900">
                ₹1.42L
              </text>
            </g>
          </svg>
        </div>

        {/* Legend Panel */}
        <div className="flex-1 space-y-2 w-full">
          {categories.map((c, i) => {
            const isHovered = hoveredCategory === i;
            const isAnyHovered = hoveredCategory !== null;
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredCategory(i)}
                onMouseLeave={() => setHoveredCategory(null)}
                className={`p-2.5 rounded-2xl border transition-all duration-300 cursor-pointer flex justify-between items-center ${
                  isHovered 
                    ? "bg-slate-50 border-slate-300 shadow-[0_4px_12px_rgba(0,0,0,0.03)] scale-[1.02]" 
                    : isAnyHovered 
                      ? "opacity-40 border-transparent bg-transparent" 
                      : "bg-slate-50/60 border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c.color }} />
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 leading-none">
                      <span>{c.label}</span>
                      <span className="text-[9px] font-black text-slate-400">{c.val}%</span>
                    </div>
                    <span className="text-[9px] font-semibold text-slate-455 block mt-1 leading-none">{c.status} • {c.fill}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-850 block">{c.money}</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Allocated</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const simulateChatCommand = (promptText) => {
    if (isTyping) return;
    
    // Add user message
    const userMsg = { role: "user", text: promptText };
    setChatHistory(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Dynamic co-pilot replies
    let replyText = "";
    if (promptText.includes("Diwali")) {
      replyText = "Diwali Surge Simulation initialized. Expected multi-location demand multiplier is calibrated to 1.84x. Recommended triggers: increase Coke 500ml and Potato Chips stock reserves by 75 units at Mumbai and Delhi hubs. Safety stock parameters updated.";
    } else if (promptText.includes("Chennai")) {
      replyText = "Chennai Hub Expiries evaluated. 14 units of Organic Milk 1L are approaching expiration boundaries (expires in 48h). Auto-allocation rules triggered standard price markdown of 25% to maximize salvage rates prior to expiration.";
    } else if (promptText.includes("Delhi")) {
      replyText = "Delhi command network balanced. Identified supply surplus (Beverages: +120 units) in Delhi Store 2. Initiated logistics recommendation: transfer 45 units to Gurgaon Hub to resolve local stockouts. Fuel route optimization: optimal. Click Approve to authorize transfer.";
    } else {
      replyText = "ML classification command verified. Analyzing historical supply line signals. All regional indicators operate within normal standard error margins (efficiency: 96.8%).";
    }

    setTimeout(() => {
      setIsTyping(false);
      setChatHistory(prev => [...prev, { role: "assistant", text: replyText }]);
    }, 1200);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const txt = chatInput;
    setChatInput("");
    simulateChatCommand(txt);
  };

  const renderNLPCommandConsole = () => {
    const promptPills = [
      "Simulate Diwali Surge ⚡",
      "Check Chennai Hub Expiries 📦",
      "Optimize Delhi Allocations 📍"
    ];

    return (
      <div className="flex flex-col h-[320px] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden font-mono text-xs text-left">
        {/* Terminal Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">INVENTRA CO-PILOT COMMAND</span>
          </div>
          <span className="text-[9px] text-emerald-500 font-bold tracking-wider animate-pulse flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            LIVE LINK ACTIVE
          </span>
        </div>

        {/* Scrollable messages area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 flex flex-col justify-end text-left scrollbar-thin scrollbar-thumb-slate-805 scrollbar-track-slate-950">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "self-end items-end" : "self-start items-start"}`}>
              <span className="text-[9px] font-black text-slate-550 uppercase tracking-widest mb-1">
                {msg.role === "user" ? "VP Executive Console" : "Inventra ML Engine"}
              </span>
              <div className={`p-3 rounded-2xl leading-relaxed font-sans font-semibold text-xs border ${
                msg.role === "user"
                  ? "bg-slate-900 border-slate-800 text-slate-200"
                  : "bg-emerald-950/20 border-emerald-900/60 text-emerald-400 shadow-[0_2px_12px_rgba(5,150,105,0.04)]"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="self-start flex flex-col items-start max-w-[85%]">
              <span className="text-[9px] font-black text-slate-550 uppercase tracking-widest mb-1">Inventra ML Engine</span>
              <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-2xl flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* Interactive Pills */}
        <div className="bg-slate-950 px-3.5 py-2 border-t border-slate-900 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none items-center">
          {promptPills.map((pill, idx) => (
            <button
              key={idx}
              disabled={isTyping}
              onClick={() => simulateChatCommand(pill)}
              className="px-2.5 py-1 text-[10px] bg-slate-900 text-slate-400 border border-slate-800 rounded-xl hover:text-emerald-400 hover:border-emerald-700/60 transition-all font-sans font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Input box */}
        <form onSubmit={handleSendChat} className="bg-slate-900 border-t border-slate-800 p-2.5 flex items-center gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isTyping}
            placeholder="Type a regional command (e.g. Optimize Chennai hubs)..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-600/80 font-sans text-xs disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isTyping || !chatInput.trim()}
            className="h-8 w-8 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center transition-colors shrink-0 shadow-[0_4px_12px_rgba(5,150,105,0.18)] cursor-pointer disabled:opacity-40"
          >
            ➔
          </button>
        </form>
      </div>
    );
  };

  const renderGeographicalCommandMap = () => {
    const branches = {
      Mumbai: { name: "Mumbai Regional HQ", efficiency: "98.2%", fleet: "12 Fleet Vehicles", stocks: "1,240 units", coord: [100, 160] },
      Delhi: { name: "Delhi Command Center", efficiency: "94.6%", fleet: "8 Fleet Vehicles", stocks: "850 units", coord: [120, 50] },
      Chennai: { name: "Chennai Logistics Hub", efficiency: "96.4%", fleet: "15 Fleet Vehicles", stocks: "1,480 units", coord: [170, 230] },
      Bangalore: { name: "Bangalore Store 1", efficiency: "92.1%", fleet: "6 Fleet Vehicles", stocks: "680 units", coord: [130, 210] },
    };

    const activeInfo = branches[activeBranch] || branches.Mumbai;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr] gap-4 bg-slate-950 border border-slate-800 p-4 rounded-3xl select-none min-h-[320px] text-left">
        {/* Interactive SVG Geo Map Representation */}
        <div className="relative border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden p-2 flex items-center justify-center min-h-[220px]">
          <svg className="w-full h-full max-h-[240px]" viewBox="0 0 300 300">
            {/* Grid gridlines */}
            {Array.from({ length: 7 }).map((_, i) => {
              const pos = 40 + i * 36;
              return (
                <g key={i}>
                  <line x1={pos} y1="0" x2={pos} y2="300" stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2 2" />
                  <line x1="0" y1={pos} x2="300" y2={pos} stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2 2" />
                </g>
              );
            })}

            {/* Bezier flow lines representing transfer arrows */}
            <g>
              {/* Flow line 1: Mumbai to Bangalore */}
              <path d="M 100 160 Q 115 185 130 210" fill="none" stroke="#059669" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
              {/* Flow line 2: Delhi to Chennai */}
              <path d="M 120 50 Q 165 140 170 230" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
              {/* Flow line 3: Bangalore to Chennai */}
              <path d="M 130 210 Q 150 220 170 230" fill="none" stroke="#E11D48" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
            </g>

            {/* Custom stylized outlines - simple polygon map hints */}
            <polygon points="120,30 180,40 210,120 180,180 170,250 140,290 120,240 80,180 60,150 90,100" fill="none" stroke="#1E293B" strokeWidth="1.5" />

            {/* Glowing Branch Pins */}
            {Object.entries(branches).map(([key, data]) => {
              const [cx, cy] = data.coord;
              const isSelected = activeBranch === key;
              return (
                <g key={key} onClick={() => setActiveBranch(key)} className="cursor-pointer">
                  {isSelected && (
                    <circle cx={cx} cy={cy} r="12" fill="#059669" opacity="0.25" className="animate-ping" />
                  )}
                  <circle cx={cx} cy={cy} r="6" fill={isSelected ? "#10B981" : "#1E293B"} stroke="#059669" strokeWidth="2.5" />
                  <circle cx={cx} cy={cy} r="2" fill="#FFFFFF" />
                  <text x={cx} y={cy - 10} fill="#94A3B8" fontSize="8" fontWeight="black" textAnchor="middle" className="uppercase tracking-wider">
                    {key}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="absolute top-2.5 left-2.5 text-[8px] font-black text-slate-500 uppercase tracking-widest">
            LOGISTICS ARC ROUTING
          </div>
        </div>

        {/* Selected Hub Details Panel */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between text-left font-sans">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Selected Command Node</span>
            </div>
            <h4 className="text-base font-black text-slate-200 mt-1">{activeInfo.name}</h4>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">Multi-branch node evaluating transfer vectors and transport lines.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Operational Yield</span>
              <span className="text-sm font-black text-emerald-400 block mt-0.5">{activeInfo.efficiency}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Assigned Fleet</span>
              <span className="text-sm font-black text-slate-200 block mt-0.5">{activeInfo.fleet}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5 col-span-2">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Monitored Safety Stock Buffer</span>
              <span className="text-sm font-black text-slate-200 block mt-0.5">{activeInfo.stocks}</span>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-800 text-center">
            <span className="text-[9px] font-black text-slate-550 uppercase tracking-widest block">TAP PINS ON MAP TO ROUTE</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen w-full bg-[#F8FAFC] text-slate-900 flex flex-col font-sans relative overflow-x-hidden"
      style={{
        backgroundImage: `radial-gradient(circle at 80% 20%, ${config.accentSoft}, transparent 45%), radial-gradient(circle at 10% 80%, rgba(241, 245, 249, 0.6), transparent 50%)`,
      }}
    >
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-xl px-4 sm:px-6 lg:px-10 py-3.5 flex justify-between items-center shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("home")}
            className="text-[13px] font-black uppercase tracking-[0.28em] text-slate-900 hover:opacity-85 transition-all font-sans cursor-pointer"
          >
            INVENTRA
          </button>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: config.accent }} />
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
            {config.strap}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications Alerts Center */}
          <div className="relative">
            <button
              onClick={() => setShowAlertMenu(!showAlertMenu)}
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 hover:text-slate-900 transition-all relative cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              {notifications.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-600 text-[10px] font-black text-white flex items-center justify-center border-2 border-white animate-pulse">
                  {notifications.length}
                </span>
              )}
            </button>

            {showAlertMenu && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-left z-50">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-3">
                  AI Real-Time Alerts
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No active alerts currently.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-150 flex justify-between items-start gap-2">
                        <p className="text-[11px] text-slate-700 font-semibold leading-relaxed">{n.text}</p>
                        <button
                          onClick={() => handleClearAlert(n.id)}
                          className="text-[10px] font-black text-slate-400 hover:text-slate-800 shrink-0 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Quick Pill */}
          <button
            onClick={() => setActiveSection("profile")}
            className="flex items-center gap-2.5 rounded-full bg-white border border-slate-200 pl-2 pr-3.5 py-1.5 hover:border-slate-350 hover:bg-slate-50 transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.03)] group"
          >
            <div
              className="h-7 w-7 rounded-full text-[11px] font-black flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105"
              style={{ backgroundColor: config.accent }}
            >
              {String(userDisplayName || "M").trim().charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col text-left leading-[1.1]">
              <span className="text-[11px] font-black text-slate-800 tracking-tight">{userDisplayName}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{config.profile.role}</span>
            </div>
          </button>
        </div>
      </header>

      {/* Main Grid Workspace Layout */}
      <div className="flex-1 w-full px-0 py-0 pt-[72px] lg:pl-[340px] xl:pl-[372px]">
        {/* Left Control Panel / Sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-[72px] h-[calc(100vh-72px)] z-30 w-[340px] xl:w-[372px] flex flex-col overflow-y-auto sidebar-scrollbar select-none border-r border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_48%,#f8fafc_100%)] shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-4 py-4 xl:px-5 xl:py-5">
          <div className="rounded-[28px] border border-slate-100 bg-white px-5 py-5 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Business Control</span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5 leading-tight">{config.label}</h2>
              </div>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-sm" style={{ background: config.shell }}>
                {tierBadgeLabel}
              </span>
            </div>
            <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">{config.summary}</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Role</div>
                <div className="mt-1 text-[11px] font-bold text-slate-800 leading-tight">{config.profile.role}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Access</div>
                <div className="mt-1 text-[11px] font-bold text-slate-800 leading-tight">{config.profile.access}</div>
              </div>
            </div>
          </div>

          <nav className="mt-4 space-y-2.5">
            {WORKSPACE_TABS.map((tab) => {
              const isActive = activeSection === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    if (tab.key === "billing") {
                      setActiveTab(getBillingPosTab(normalizedTier));
                      return;
                    }
                    if (tab.key === "inventory") {
                      setActiveTab(getInventoryOpsTab(normalizedTier));
                      return;
                    }
                    setActiveSection(tab.key);
                  }}
                  className={`group w-full flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-xs font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer hover:scale-[1.005] ${
                    isActive
                      ? "text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)]"
                      : "border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  style={isActive ? { backgroundColor: config.accent, borderColor: config.accent } : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`grid h-8 w-8 place-items-center rounded-xl text-sm transition-colors ${isActive ? "bg-white/20" : "bg-slate-50 group-hover:bg-slate-100"}`}>
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </div>
                  <span className={`text-[10px] transition-transform ${isActive ? "translate-x-0 opacity-100" : "translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`}>
                    →
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
            <details className="group" open>
              <summary className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-500 cursor-pointer list-none flex justify-between items-center hover:text-slate-900 transition-colors">
                <span>Tier Specific Plugins</span>
                <span className="text-[8px] transition-transform duration-300 group-open:rotate-180">▼</span>
              </summary>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {tierFeatures.map((f, i) => (
                  <div key={i} className="min-w-0 flex-1 basis-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10.5px] font-semibold text-slate-600 leading-snug">
                    {f}
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div className="mt-4 space-y-3.5">
            <div className="rounded-[24px] border border-slate-100 bg-slate-950 p-4 text-white shadow-[0_12px_25px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-sky-200/90">
                <span>✨</span>
                AI Insights
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                Low stock and expiry signals are tracked in real time for the smallest workflow noise possible.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {QUICK_LINKS.map((link) => (
                <button key={link.label} className="rounded-2xl border border-slate-200 bg-white px-2.5 py-3 text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                  <span className="block text-base leading-none">{link.icon}</span>
                  <span className="mt-2 block leading-tight">{link.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleLogout}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-xs font-black uppercase tracking-[0.22em] text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </aside>

        {/* Mobile menu navigation buttons (Hidden on Desktop) */}
        <div className="lg:hidden w-full flex justify-between items-center gap-3 px-4 sm:px-6 pt-4">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="flex-1 py-3 px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-950 font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-2 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          >
            <span>🧭</span>
            <span>Workspace Navigation Menu</span>
          </button>
        </div>

        {mobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-black uppercase tracking-widest text-slate-450">Workspace Selection</span>
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 text-sm cursor-pointer"
              >
                ✕ Close Menu
              </button>
            </div>
            
            <nav className="space-y-2 mb-6">
              {WORKSPACE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    if (tab.key === "billing") {
                      setActiveTab(getBillingPosTab(normalizedTier));
                      setMobileSidebarOpen(false);
                      return;
                    }
                    if (tab.key === "inventory") {
                      setActiveTab(getInventoryOpsTab(normalizedTier));
                      setMobileSidebarOpen(false);
                      return;
                    }
                    setActiveSection(tab.key);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left text-sm font-bold border transition-all duration-200 active:scale-[0.98] ${
                    activeSection === tab.key
                      ? "text-white font-black"
                      : "text-slate-600 border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                  style={activeSection === tab.key ? { backgroundColor: config.accent, borderColor: config.accent } : undefined}
                >
                  <div className="flex items-center gap-3">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </div>
                </button>
              ))}
            </nav>

            <button
              onClick={() => {
                setMobileSidebarOpen(false);
                handleLogout();
              }}
              className="w-full py-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-black uppercase tracking-wider cursor-pointer hover:bg-rose-100 transition-colors"
            >
              Logout Session
            </button>
          </div>
        )}

        {/* Dynamic Area Panels */}
        <main className="min-w-0 space-y-6 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 lg:py-8">
          {/* Header Strap */}
          {activeSection === "overview" && (
            <section className="bg-white border border-slate-200 p-5 md:p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left relative overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
              {/* Glowing spot */}
              <div className="absolute w-48 h-48 rounded-full pointer-events-none -right-10 blur-[80px]" style={{ background: config.accentSoft }} />

              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Retail Intelligence Node</span>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1 leading-tight tracking-tight">{config.strap}</h1>
                <p className="text-xs text-slate-500 font-semibold mt-1 max-w-xl leading-relaxed">{config.blurb}</p>
              </div>
              
              <div className="flex items-center gap-2 shrink-0 border border-slate-100 rounded-full px-3 py-1.5 bg-slate-50/50">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: config.accent }} />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 font-mono whitespace-nowrap">
                  TIER: {tierDisplayName}
                </span>
              </div>
            </section>
          )}

          {/* Section Router */}
          {activeSection === "overview" && (
            <>
              {normalizedTier === "small" && (
                <SmallDashboard 
                  products={products}
                  salesCount={salesCount}
                  salesRevenue={salesRevenue}
                  notifications={notifications}
                  tierAccent={config.accent}
                  tierAccentSoft={config.accentSoft}
                />
              )}
              {normalizedTier === "medium" && (
                <MediumDashboard 
                  products={products}
                  onUpdateProducts={setProducts}
                  tierAccent={config.accent}
                  tierAccentSoft={config.accentSoft}
                />
              )}
              {normalizedTier === "large" && (
                <LargeDashboard 
                  products={products}
                  onUpdateProducts={setProducts}
                  tierAccent={config.accent}
                  tierAccentSoft={config.accentSoft}
                  onOpenBranchPage={handleOpenBranchOperations}
                  branchNetwork={branchNetwork}
                />
              )}
            </>
          )}

          {activeSection === "inventory" && (
            <InventoryTable 
              products={products} 
              onUpdateProducts={setProducts}
              tier={normalizedTier}
              tierAccent={config.accent}
              tierAccentSoft={config.accentSoft}
            />
          )}

          {activeSection === "analytics" && (
            <>
              {normalizedTier === "small" && (
                <div className="space-y-6">
                  {/* Top Intro Section */}
                  <div className="bg-white border border-slate-200 p-5 md:p-6 rounded-3xl text-left shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Demand Simulation</span>
                    <h3 className="text-lg md:text-xl font-black text-slate-900 mt-1">Basic Demand Forecasting</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
                      High-fidelity intelligence forecast vectors for primary bakery and dairy SKUs, calculated dynamically using local sales frequency parameters.
                    </p>
                  </div>

                  {/* Dual Card Showcase */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card 1: Fresh Bread */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-left flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Bakery Segment</span>
                            <h4 className="text-base font-black text-slate-800 leading-tight">Fresh Bread 400g</h4>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                            style={{ backgroundColor: `${config.accent}15`, color: config.accent }}
                          >
                            Peak Demand
                          </span>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2.5 mb-6">
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">Stock Level</span>
                            <span className="text-sm font-black text-rose-600 block mt-0.5">8 Units</span>
                            <span className="text-[8px] font-semibold text-rose-500 block">Below Reorder (15)</span>
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">7D Forecast</span>
                            <span className="text-sm font-black text-slate-800 block mt-0.5">145 Units</span>
                            <span className="text-[8px] font-semibold text-emerald-600 block">+18% Surge Peak</span>
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">ML Confidence</span>
                            <span className="text-sm font-black block mt-0.5" style={{ color: config.accent }}>94.2%</span>
                            <span className="text-[8px] font-semibold text-slate-500 block">High Certainty</span>
                          </div>
                        </div>
                      </div>

                      {/* SVG Sparkline */}
                      <div className="relative pt-4 pb-2 border-t border-slate-100">
                        <svg className="w-full h-28 overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="bread-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={config.accent} stopOpacity="0.25" />
                              <stop offset="100%" stopColor={config.accent} stopOpacity="0.00" />
                            </linearGradient>
                          </defs>
                          {/* Grid Lines */}
                          <line x1="0" y1="15" x2="500" y2="15" stroke="#F1F5F9" strokeWidth="1" />
                          <line x1="0" y1="50" x2="500" y2="50" stroke="#F1F5F9" strokeWidth="1" />
                          <line x1="0" y1="85" x2="500" y2="85" stroke="#F1F5F9" strokeWidth="1" />
                          
                          {/* Gradient Fill under the curve */}
                          <path
                            d="M 0 70 C 80 40, 120 85, 200 35 C 280 -5, 380 95, 450 15 L 500 12 L 500 100 L 0 100 Z"
                            fill="url(#bread-grad)"
                          />
                          {/* Sparkline Stroke */}
                          <path
                            d="M 0 70 C 80 40, 120 85, 200 35 C 280 -5, 380 95, 450 15 L 500 12"
                            fill="none"
                            stroke={config.accent}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2.5 px-0.5">
                          <span>Mon</span>
                          <span>Tue</span>
                          <span>Wed</span>
                          <span>Thu</span>
                          <span>Fri</span>
                          <span>Sat (Peak)</span>
                          <span>Sun</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Organic Milk */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-left flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Dairy Segment</span>
                            <h4 className="text-base font-black text-slate-800 leading-tight">Organic Milk 1L</h4>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600"
                          >
                            Stable Supply
                          </span>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2.5 mb-6">
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">Stock Level</span>
                            <span className="text-sm font-black text-amber-600 block mt-0.5">12 Units</span>
                            <span className="text-[8px] font-semibold text-amber-500 block">Near Reorder (20)</span>
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">7D Forecast</span>
                            <span className="text-sm font-black text-slate-800 block mt-0.5">280 Units</span>
                            <span className="text-[8px] font-semibold text-emerald-600 block">+8% Steady Growth</span>
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">ML Confidence</span>
                            <span className="text-sm font-black text-emerald-600 block mt-0.5">96.8%</span>
                            <span className="text-[8px] font-semibold text-slate-500 block">Optimal Signals</span>
                          </div>
                        </div>
                      </div>

                      {/* SVG Sparkline */}
                      <div className="relative pt-4 pb-2 border-t border-slate-100">
                        <svg className="w-full h-28 overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="milk-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                              <stop offset="100%" stopColor="#10B981" stopOpacity="0.00" />
                            </linearGradient>
                          </defs>
                          {/* Grid Lines */}
                          <line x1="0" y1="15" x2="500" y2="15" stroke="#F1F5F9" strokeWidth="1" />
                          <line x1="0" y1="50" x2="500" y2="50" stroke="#F1F5F9" strokeWidth="1" />
                          <line x1="0" y1="85" x2="500" y2="85" stroke="#F1F5F9" strokeWidth="1" />
                          
                          {/* Gradient Fill under the curve */}
                          <path
                            d="M 0 35 C 100 50, 180 15, 250 55 C 320 95, 400 30, 500 40 L 500 100 L 0 100 Z"
                            fill="url(#milk-grad)"
                          />
                          {/* Sparkline Stroke */}
                          <path
                            d="M 0 35 C 100 50, 180 15, 250 55 C 320 95, 400 30, 500 40"
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2.5 px-0.5">
                          <span>Mon</span>
                          <span>Tue (Stable)</span>
                          <span>Wed</span>
                          <span>Thu</span>
                          <span>Fri</span>
                          <span>Sat</span>
                          <span>Sun</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {normalizedTier === "medium" && (
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 text-left">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 mb-1">Seasonal & Profit Analytics</h3>
                        <p className="text-xs text-slate-500 font-semibold">Dual path Area forecasts with seasonal peaks.</p>
                      </div>
                      <div className="flex gap-1 bg-slate-100 p-1 border border-slate-200 rounded-xl">
                        {["7d", "30d"].map(r => (
                          <button
                            key={r}
                            onClick={() => setMediumRange(r)}
                            className={`px-2.5 py-1 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all cursor-pointer ${mediumRange === r ? 'bg-white text-slate-900 border border-slate-205 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800 font-bold'}`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    {renderInteractiveSeasonalChart()}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 mb-1">Segment Sales Share</h3>
                      <p className="text-xs text-slate-500 font-semibold">Category Sales donut segments indicators.</p>
                    </div>
                    <div className="py-2">
                      {renderInteractiveDonutChart()}
                    </div>
                  </div>
                </div>
              )}
              {normalizedTier === "large" && (
                <div className="space-y-6 text-left">
                  <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-6">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Enterprise AI Forecasting</span>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-950 mt-1 leading-tight">Network Demand & Inventory Risk Command</h3>
                        <p className="text-xs md:text-sm text-slate-500 font-semibold mt-2 max-w-3xl leading-relaxed">
                          Multi-branch forecast model combining sales velocity, stock cover, expiry exposure, fulfillment load, and transfer feasibility across regional hubs.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5 min-w-0 lg:min-w-[520px]">
                        {[
                          { label: "Model Confidence", value: "96.4%", note: "+2.1 pts", tone: "text-emerald-600" },
                          { label: "30D Revenue Forecast", value: "₹18.7Cr", note: "+12.8%", tone: "text-emerald-600" },
                          { label: "Risk Exposure", value: "₹42.8L", note: "actionable", tone: "text-amber-600" },
                          { label: "Service Level", value: "93.8%", note: "target 96%", tone: "text-sky-600" },
                        ].map((metric) => (
                          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                            <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">{metric.label}</span>
                            <span className="block text-lg font-black text-slate-950 mt-1">{metric.value}</span>
                            <span className={`block text-[10px] font-black uppercase tracking-wider mt-0.5 ${metric.tone}`}>{metric.note}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Demand Curve</span>
                            <h4 className="text-lg font-black text-slate-900 mt-1">30-Day Network Forecast</h4>
                          </div>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                            Auto-Rebalance Active
                          </span>
                        </div>
                        <svg className="w-full h-72 overflow-visible" viewBox="0 0 760 280" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="enterpriseForecastFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="enterpriseRiskFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.18" />
                              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {[40, 90, 140, 190, 240].map((y) => (
                            <line key={y} x1="0" y1={y} x2="760" y2={y} stroke="#E2E8F0" strokeWidth="1" />
                          ))}
                          <path
                            d="M0 214 C72 188 104 154 172 164 C232 172 260 104 326 116 C386 128 404 78 472 82 C552 86 584 140 646 108 C700 80 724 62 760 54 L760 280 L0 280 Z"
                            fill="url(#enterpriseForecastFill)"
                          />
                          <path
                            d="M0 224 C84 210 126 204 188 196 C260 188 326 174 390 154 C476 126 536 132 610 104 C672 82 718 76 760 68"
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M0 242 C78 232 128 224 194 214 C278 202 350 184 420 164 C494 146 562 156 632 128 C690 106 724 102 760 92 L760 280 L0 280 Z"
                            fill="url(#enterpriseRiskFill)"
                          />
                          <path
                            d="M0 242 C78 232 128 224 194 214 C278 202 350 184 420 164 C494 146 562 156 632 128 C690 106 724 102 760 92"
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="3"
                            strokeDasharray="10 8"
                            strokeLinecap="round"
                          />
                          {[
                            { x: 172, y: 164, label: "Delhi buffer breach" },
                            { x: 472, y: 82, label: "Holiday demand lift" },
                            { x: 646, y: 108, label: "Pune surplus release" },
                          ].map((point) => (
                            <g key={point.label}>
                              <circle cx={point.x} cy={point.y} r="7" fill="#fff" stroke="#10B981" strokeWidth="4" />
                              <text x={point.x + 12} y={point.y - 10} fill="#475569" fontSize="11" fontWeight="800">{point.label}</text>
                            </g>
                          ))}
                        </svg>
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-6 rounded-full bg-emerald-500" /> Demand forecast</span>
                          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-6 rounded-full bg-amber-500" /> Inventory risk band</span>
                          <span>Planning horizon: 30 days</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {[
                          { label: "Delhi Branch", signal: "Understock risk", value: "68% cover", action: "Receive 30 Bakery + Dairy units", tone: "border-rose-200 bg-rose-50 text-rose-700" },
                          { label: "Pune Depot", signal: "Overstock expiry", value: "98% capacity", action: "Release slow-moving surplus", tone: "border-amber-200 bg-amber-50 text-amber-700" },
                          { label: "Bangalore Branch", signal: "Demand expansion", value: "+14% velocity", action: "Raise beverage reorder min", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
                          { label: "London Branch", signal: "Service watch", value: "76% stock health", action: "Confirm supplier SLA", tone: "border-sky-200 bg-sky-50 text-sky-700" },
                        ].map((branch) => (
                          <div key={branch.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Branch Risk Signal</span>
                                <h4 className="text-base font-black text-slate-950 mt-1">{branch.label}</h4>
                              </div>
                              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${branch.tone}`}>{branch.signal}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                              <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Current State</span>
                                <span className="block text-sm font-black text-slate-800 mt-1">{branch.value}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">AI Action</span>
                                <span className="block text-sm font-black text-slate-800 mt-1">{branch.action}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">AI Decision Queue</span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">Recommended Enterprise Actions</h3>
                      <div className="mt-5 space-y-3">
                        {[
                          ["1", "Rebalance Stock", "Move 30 Bakery/Dairy units from Pune Depot to Delhi Branch before tomorrow morning dispatch."],
                          ["2", "Update Reorder Policy", "Increase beverage minimum stock by 18% for Bangalore and Mumbai through the next holiday window."],
                          ["3", "Protect Margin", "Hold discounting on Dairy SKUs in high-velocity branches; route promotion spend to Snacks instead."],
                          ["4", "Supplier Escalation", "Trigger SLA check for London cold-chain supply due to two-cycle service-level drift."],
                        ].map(([step, title, body]) => (
                          <div key={step} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                            <span className="h-7 w-7 rounded-full bg-emerald-600 text-white text-xs font-black grid place-items-center shrink-0">{step}</span>
                            <div>
                              <h4 className="text-sm font-black text-slate-950">{title}</h4>
                              <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mt-0.5">{body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Category Exposure</span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">Inventory, Margin & Expiry Analysis</h3>
                      <div className="mt-5 space-y-4">
                        {[
                          { label: "Dairy", stock: 74, margin: "18.4%", risk: "High expiry sensitivity", color: "#0EA5E9" },
                          { label: "Bakery", stock: 61, margin: "21.7%", risk: "Short cover in Delhi", color: "#F59E0B" },
                          { label: "Beverages", stock: 88, margin: "25.2%", risk: "Holiday demand lift", color: "#10B981" },
                          { label: "Snacks", stock: 79, margin: "31.5%", risk: "Promo upside", color: "#6366F1" },
                        ].map((category) => (
                          <div key={category.label}>
                            <div className="flex justify-between items-end gap-3 mb-1.5">
                              <div>
                                <span className="text-sm font-black text-slate-900">{category.label}</span>
                                <span className="ml-2 text-[10px] font-bold text-slate-400">{category.risk}</span>
                              </div>
                              <span className="text-xs font-black text-slate-700">{category.margin} margin</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${category.stock}%`, background: category.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                </div>
              )}
            </>
          )}

          {activeSection === "csv" && (
            <CSVUpload 
              onUploadComplete={handleCSVUploadComplete}
              tierAccent={config.accent}
              tierAccentSoft={config.accentSoft}
            />
          )}

          {activeSection === "profile" && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6 text-left">
              {/* ── LEFT DESK: Identity & Active Branch Nodes ── */}
              <div className="space-y-6">
                {/* Executive Header Banner */}
                <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                  {/* Decorative ambient background blur shapes */}
                  <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-[60px] opacity-20 transition-all duration-700" style={{ background: config.accent }} />
                  <div className="absolute -left-12 -bottom-12 h-36 w-36 rounded-full blur-[50px] opacity-15" style={{ background: config.accent }} />

                  <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      {/* Premium large avatar node */}
                      <div className="relative">
                        <div className="h-16 w-16 rounded-[1.25rem] text-white text-xl font-black grid place-items-center shadow-[0_12px_28px_rgba(0,0,0,0.12)] transition-all duration-300 hover:scale-[1.05]" style={{ background: `linear-gradient(135deg, ${config.accent} 0%, #1e293b 100%)` }}>
                          {String(userDisplayName || "M").trim().charAt(0).toUpperCase()}
                        </div>
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Executive identity</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">SYSTEM OWNER</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mt-1.5 leading-none tracking-tight">{userDisplayName}</h2>
                        <p className="text-xs text-slate-500 font-extrabold mt-2 flex items-center gap-1.5">
                          🏢 {userProfile?.businessName || userSession?.user?.businessName || userSession?.user?.company || "Your Enterprise"}
                        </p>
                        <p className="text-[11px] text-slate-400 font-semibold mt-1 flex items-center gap-1.5">
                          ✉️ {userProfile?.email || userSession?.user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 sm:self-start">
                      <span className="rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] shadow-sm select-none" style={{ borderColor: `${config.accent}44`, color: config.accent, background: `${config.accent}0d` }}>
                        {tierDisplayName} Tier
                      </span>
                      <button onClick={openEditProfile} className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer select-none">
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-semibold text-slate-500 leading-normal">
                    <p className="max-w-md">
                      ✨ {config.profile.role}. You possess full operations permissions, ledger scopes, and forecasting triggers for your enterprise.
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">Active Status</span>
                    </div>
                  </div>
                </div>

                {/* Live Platform Stats Panels */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Access Scope</span>
                    <div className="mt-2 text-base font-black text-slate-905 flex items-center gap-1.5">
                      🔑 <span style={{ color: config.accent }}>Full scope Access</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Authentication</span>
                    <div className="mt-2 text-base font-black text-emerald-600 flex items-center gap-1.5">
                      🛡️ <span>Active JWT SSL</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">System Security</span>
                    <div className="mt-2 text-base font-black text-slate-905 flex items-center gap-1.5">
                      🔒 <span>Secure Socket Layer</span>
                    </div>
                  </div>
                </div>

                {/* MongoDB Active Branch Nodes Grid */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                  <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Database nodes</span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">Active Registered Branch Networks</h3>
                    </div>
                    <span className="rounded-xl bg-slate-105 text-[10px] font-black px-3 py-1 uppercase tracking-wider text-slate-600">
                      {branchesList.length} Nodes Online
                    </span>
                  </div>

                  {!firstLoadDone && branchesList.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[1, 2].map((n) => (
                        <div key={n} className="animate-pulse bg-slate-50 border border-slate-100 rounded-2xl p-5 h-44 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center">
                              <div className="h-3 w-16 bg-slate-200 rounded" />
                              <div className="h-4 w-12 bg-slate-200 rounded" />
                            </div>
                            <div className="mt-4 flex gap-3 items-center">
                              <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                              <div className="space-y-2 flex-1">
                                <div className="h-4 w-32 bg-slate-200 rounded" />
                                <div className="h-3 w-40 bg-slate-200 rounded" />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-slate-100">
                            <div className="h-3 w-16 bg-slate-200 rounded" />
                            <div className="h-3 w-12 bg-slate-200 rounded justify-self-end" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : branchesList.filter(b => b.status !== "Inactive").length === 0 ? (
                    <div className="py-8 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-6">
                      <div className="text-slate-400 text-3xl mb-3">📍</div>
                      <span className="block text-sm font-black text-slate-800">No active branch nodes registered in MongoDB yet.</span>
                      <p className="text-xs text-slate-500 font-semibold max-w-sm mx-auto mt-1 leading-normal">
                        Your enterprise branch network has no database mappings. Use the **Growth Console** to initialize your first node!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      {branchesList.filter(b => b.status !== "Inactive").map((branch) => {
                        const isExpanded = !!expandedBranches[branch._id || branch.branch_id];
                        return (
                          <div 
                            key={branch._id || branch.branch_id} 
                            onClick={() => setExpandedBranches((prev) => ({ ...prev, [branch._id || branch.branch_id]: !isExpanded }))}
                            className={`relative overflow-hidden rounded-2xl border transition-all duration-305 shadow-sm flex flex-col justify-between p-5 cursor-pointer select-none group self-start ${
                              isExpanded 
                                ? "border-slate-800 bg-slate-50/90 ring-4 ring-slate-900/5 shadow-md" 
                                : "border-slate-150 bg-slate-50/40 hover:bg-slate-50/80 hover:border-slate-350 hover:shadow-md"
                            }`}
                          >
                            {/* Card Content Header */}
                            <div>
                              <div className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Node: Active</span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md border border-slate-250 bg-slate-100 text-[9px] font-black uppercase text-slate-705 tracking-wider">
                                    {branch.branch_code || "CODE"}
                                  </span>
                                  <span className={`text-[10px] text-slate-450 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                                    ▼
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3.5 flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center text-xl shrink-0">
                                  {branch.branch_type === "Warehouse" ? "🏭" : branch.branch_type === "Franchise" ? "🤝" : branch.branch_type === "Depot" ? "📦" : "🏪"}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-base font-black text-slate-900 leading-tight">{branch.branch_name}</h4>
                                  <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
                                    📍 {branch.address}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Minimal default view */}
                            {!isExpanded && (
                              <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-slate-105 text-left">
                                <div>
                                  <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Manager</span>
                                  <span className="block text-[10px] font-black text-slate-705 mt-0.5 truncate">{branch.manager_name}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400 text-right">Employees</span>
                                  <span className="block text-[10px] font-black text-slate-750 mt-0.5 text-right">{branch.employee_count} assigned</span>
                                </div>
                              </div>
                            )}

                            {/* Expanded premium details view */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t border-slate-100 text-left space-y-3.5">
                                <div className="grid grid-cols-1 gap-y-3.5 text-xs leading-normal">
                                  <div>
                                    <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Full Address</span>
                                    <span className="block text-[10.5px] font-bold text-slate-800 leading-relaxed mt-0.5">{branch.address}</span>
                                    <span className="block text-[10.5px] font-bold text-slate-805 leading-relaxed mt-0.5">{branch.city}, {branch.state}, {branch.country} - {branch.pincode}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Branch Type</span>
                                      <span className="inline-flex items-center gap-1 mt-1 rounded bg-slate-200/60 border border-slate-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-700">
                                        {branch.branch_type || "Store"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Opening Date</span>
                                      <span className="block text-[10px] font-bold text-slate-800 mt-1">{branch.opening_date || "Not Specified"}</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Operations Manager</span>
                                      <span className="block text-[10px] font-black text-slate-800 mt-0.5 truncate">{branch.manager_name}</span>
                                      <span className="block text-[9px] font-bold text-slate-500 mt-0.5">{branch.phone || "No Contact"}</span>
                                    </div>
                                    <div>
                                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Allocated Staff</span>
                                      <span className="block text-[10px] font-black text-slate-800 mt-0.5">{branch.employee_count} assigned member{branch.employee_count !== 1 ? "s" : ""}</span>
                                      <span className="block text-[9px] font-bold text-slate-500 mt-0.5">Shifts: {branch.working_hours || "9AM-9PM"}</span>
                                    </div>
                                  </div>
                                  {branch.gstin && (
                                    <div>
                                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">GSTIN Identification</span>
                                      <span className="inline-block text-[9.5px] font-mono font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-0.5">{branch.gstin}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Premium Actions Row */}
                                <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditBranch(branch);
                                    }}
                                    className="flex-1 py-2 border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5"
                                  >
                                    ✏️ Edit Node
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteBranch(branch._id || branch.branch_id);
                                    }}
                                    className="flex-1 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5"
                                  >
                                    Deactivate Node
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT DESK: Growth Console & Session Monitor ── */}
              <div className="space-y-6">
                {/* Actions & Next Steps */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Action desk</span>
                      <h3 className="text-lg font-black text-slate-900 mt-0.5">Console Actions</h3>
                    </div>
                  </div>



                  {/* Growth console expand branch */}
                  <div className="rounded-2xl border border-emerald-250 bg-emerald-50/50 p-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-700">Enterprise Expansion</span>
                    <h4 className="text-base font-black text-slate-950 mt-1">Scale Branch Networks</h4>
                    <p className="text-xs font-semibold text-slate-600 leading-normal mt-1">
                      Register a new branch node inside MongoDB. It will instantly initialize stock records conforming to the latest Complete Inventory Schema.
                    </p>
                    <button
                      onClick={() => {
                        setModalStep(1);
                        setModalForm(EMPTY_BRANCH_FORM);
                        setModalErrors({});
                        setModalDropdownOpen(false);
                        setModalDropdownSearch("");
                        setModalCountryDropdownOpen(false);
                        setModalPhonePrefixOpen(false);
                        setShowAddBranchModal(true);
                      }}
                      className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:bg-emerald-700 transition-all cursor-pointer select-none"
                    >
                      + Add New Branch
                    </button>
                  </div>
                </div>

                {/* Session Security Terminal */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Security desk</span>
                    <h3 className="text-base font-black text-slate-900 mt-0.5">Session Monitor</h3>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-[11px] font-mono text-slate-300 space-y-2.5">
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span>SECURE_ID:</span>
                      <span className="text-slate-100 font-bold select-all truncate max-w-[140px]">{userSession?.user?.id || userSession?.user?._id || "system_admin"}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span>ENCRYPTION:</span>
                      <span className="text-emerald-400 font-bold">SHA-256 JWT</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span>SSL_STATUS:</span>
                      <span className="text-emerald-400 font-bold">100% SECURE SSL</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span>API_HOST:</span>
                      <span className="text-slate-100 truncate">127.0.0.1:8000</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span>WORKSPACE:</span>
                      <span className="text-sky-400 truncate">{tierDisplayName.toUpperCase()}_DESK</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] text-white transition-all shadow-[0_8px_20px_rgba(15,23,42,0.18)] hover:opacity-95 cursor-pointer select-none"
                    style={{ background: "linear-gradient(90deg,#0f172a 0%,#1e293b 100%)" }}
                  >
                    End Active Session (Logout)
                  </button>
                </div>
              </div>
            </div>
          )}

          {editingProfile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Edit Profile</span>
                    <h3 className="text-xl font-black text-slate-950 mt-1">Update Executive Profile</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">Your role will remain <strong>OWNER</strong>.</p>
                  </div>
                  <button
                    onClick={() => setEditingProfile(false)}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">First Name</span>
                    <input
                      value={profileDraft.firstName}
                      onChange={(e) => setProfileDraft((p) => ({ ...p, firstName: e.target.value }))}
                      placeholder="First name"
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
                      autoFocus
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Last Name</span>
                    <input
                      value={profileDraft.lastName}
                      onChange={(e) => setProfileDraft((p) => ({ ...p, lastName: e.target.value }))}
                      placeholder="Last name"
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Business / Company</span>
                    <input
                      value={profileDraft.businessName}
                      onChange={(e) => setProfileDraft((p) => ({ ...p, businessName: e.target.value }))}
                      placeholder="Business name"
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email (login)</span>
                    <input
                      value={profileDraft.email}
                      onChange={(e) => setProfileDraft((p) => ({ ...p, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
                    />
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 w-full rounded-xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-700 transition-all cursor-pointer"
                    >
                      Save Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProfile(false)}
                      className="rounded-xl bg-slate-100 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showAddBranchModal && (() => {
            const inp = (field) =>
              `w-full border ${
                modalErrors[field] ? "border-rose-450 bg-rose-50/40" : "border-slate-200 bg-slate-50/50"
              } text-slate-900 placeholder:text-slate-400 px-4 py-2.5 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-500 focus:bg-white transition-all`;

            const ErrMsg = ({ field }) =>
              modalErrors[field] ? <p className="text-rose-600 text-xs font-bold mt-1.5 leading-none">{modalErrors[field]}</p> : null;

            const Label = ({ children }) => (
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-450 block mb-1.5">
                {children}
              </label>
            );

            const filteredStates = INDIAN_STATES.filter((stateName) =>
              stateName.toLowerCase().includes(modalDropdownSearch.toLowerCase())
            );

            const STEPS = ["Branch", "Location", "Contact", "Review"];

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] flex flex-col relative overflow-hidden max-h-[90vh]">
                  {/* Decorative top colored line */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900" />
                  
                  {/* Modal Header */}
                  <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/40">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-700">
                        {modalForm._id ? "Enterprise Modifier Desk" : "Enterprise Onboarding Desk"}
                      </span>
                      <h3 className="text-xl font-black text-slate-950 mt-1">
                        {modalForm._id ? `Modify ${modalForm.branch_name}` : "Scale Branch Networks"}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
                        {modalForm._id
                          ? "Update manager contact ledger mapping, change business name, address, or re-allocate branch employees."
                          : "Configure regional parameters, manager contact ledger mapping, and initial staff distribution."
                        }
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddBranchModal(false)}
                      className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-black text-slate-600 hover:text-slate-900 cursor-pointer transition-all shrink-0"
                    >
                      Close
                    </button>
                  </div>

                  {/* Step progress bar */}
                  <div className="px-6 py-4 border-b border-slate-150 bg-slate-50/60">
                    <div className="flex items-start justify-between w-full max-w-[480px] mx-auto">
                      {STEPS.map((label, i) => (
                        <React.Fragment key={label}>
                          <StepDot n={i + 1} current={modalStep} label={label} />
                          {i < STEPS.length - 1 && <StepConnector done={modalStep > i + 1} />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Form Content Scroll Area */}
                  <div className="p-6 overflow-y-auto flex-1 min-h-[300px]">
                    {/* ── Step 1: Branch Basics ── */}
                    {modalStep === 1 && (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Branch Identity</h4>
                          <span className="text-[10px] font-bold text-slate-400">* Required fields</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                          <div className="md:col-span-5 flex flex-col gap-4">
                            <div>
                              <Label>Branch Name <span className="text-rose-500 font-black">*</span></Label>
                              <input
                                type="text"
                                placeholder="e.g. Dhara Flagship"
                                value={modalForm.branch_name}
                                onChange={(e) => {
                                  setModalFormField("branch_name", e.target.value);
                                  if (!modalForm.branch_code || modalForm.branch_code === autoCode(modalForm.branch_name)) {
                                    setModalFormField("branch_code", autoCode(e.target.value));
                                  }
                                }}
                                className={inp("branch_name")}
                                autoFocus
                              />
                              <ErrMsg field="branch_name" />
                            </div>
                            <div>
                              <Label>Branch Code <span className="text-rose-500 font-black">*</span></Label>
                              <input
                                type="text"
                                placeholder="e.g. DHA-FLG-01"
                                value={modalForm.branch_code}
                                onChange={(e) => setModalFormField("branch_code", e.target.value.toUpperCase())}
                                className={inp("branch_code")}
                                maxLength={20}
                              />
                              <ErrMsg field="branch_code" />
                            </div>
                          </div>

                          <div className="md:col-span-7 flex flex-col justify-between">
                            <div>
                              <Label>Branch Type <span className="text-rose-500 font-black">*</span></Label>
                              <div className="grid grid-cols-2 gap-3 mt-1">
                                {BRANCH_TYPES.map((t) => {
                                  const isSelected = modalForm.branch_type === t.value;
                                  return (
                                    <button
                                      key={t.value}
                                      type="button"
                                      onClick={() => setModalFormField("branch_type", t.value)}
                                      className={`p-2.5 rounded-2xl border-2 text-center transition-all duration-205 cursor-pointer flex flex-col items-center justify-center ${
                                        isSelected
                                          ? "border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-950/10"
                                          : "border-slate-200 bg-slate-50 hover:border-slate-350 hover:bg-slate-105 text-slate-700"
                                      }`}
                                    >
                                      <span className="text-xl mb-0.5 leading-none">{t.icon}</span>
                                      <span className="text-[11px] font-black tracking-tight">{t.value}</span>
                                      <span className={`text-[9px] font-semibold mt-0.5 leading-none ${isSelected ? "text-slate-350" : "text-slate-400"}`}>
                                        {t.desc}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Step 2: Location ── */}
                    {modalStep === 2 && (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Location Parameters</h4>
                          <span className="text-[10px] font-bold text-slate-400">* Required fields</span>
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                          {/* Line 1: Address (Full width) */}
                          <div className="col-span-12">
                            <Label>Address <span className="text-rose-500 font-black">*</span></Label>
                            <input
                              type="text"
                              placeholder="Shop No., Street, Area..."
                              value={modalForm.address}
                              onChange={(e) => setModalFormField("address", e.target.value)}
                              className={inp("address")}
                            />
                            <ErrMsg field="address" />
                          </div>

                          {/* Line 2: City & State side-by-side */}
                          <div className="col-span-12 sm:col-span-6">
                            <Label>City <span className="text-rose-500 font-black">*</span></Label>
                            <input
                              type="text"
                              placeholder="e.g. Pune"
                              value={modalForm.city}
                              onChange={(e) => {
                                const val = e.target.value;
                                setModalFormField("city", val);
                                const matchedState = getStateForCity(val);
                                if (matchedState) {
                                  setModalFormField("state", matchedState);
                                }
                              }}
                              className={inp("city")}
                            />
                            <ErrMsg field="city" />
                          </div>
                          <div className="col-span-12 sm:col-span-6 relative custom-dropdown-container">
                            <Label>State <span className="text-rose-500 font-black">*</span></Label>
                            <button
                              type="button"
                              onClick={() => {
                                setModalDropdownOpen(!modalDropdownOpen);
                                setModalDropdownSearch("");
                              }}
                              className={`w-full border ${
                                modalErrors.state ? "border-rose-400 bg-rose-50/40" : "border-slate-200 bg-slate-50/50"
                              } text-slate-900 px-4 py-2.5 rounded-xl font-bold text-sm outline-none text-left flex justify-between items-center transition-all cursor-pointer`}
                            >
                              <span className={modalForm.state ? "text-slate-900 font-bold" : "text-slate-400 font-bold"}>
                                {modalForm.state || "Select State"}
                              </span>
                              <svg className={`w-4 h-4 text-slate-500 transition-transform duration-205 ${modalDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                              </svg>
                            </button>
                            <ErrMsg field="state" />

                            {modalDropdownOpen && (
                              <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-1.5 flex flex-col gap-1.5">
                                <div className="px-1.5 py-1 sticky top-0 bg-white z-10 border-b border-slate-100">
                                  <input
                                    type="text"
                                    placeholder="Search state..."
                                    value={modalDropdownSearch}
                                    onChange={(e) => setModalDropdownSearch(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-400 bg-slate-50/80"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                </div>
                                <div className="overflow-y-auto max-h-40 space-y-0.5">
                                  {filteredStates.length === 0 ? (
                                    <div className="text-[11px] text-slate-400 font-bold py-2.5 text-center">No states found</div>
                                  ) : (
                                    filteredStates.map((s) => {
                                      const isSelected = modalForm.state === s;
                                      return (
                                        <button
                                          key={s}
                                          type="button"
                                          onClick={() => {
                                            setModalFormField("state", s);
                                            setModalDropdownOpen(false);
                                            setModalDropdownSearch("");
                                          }}
                                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex justify-between items-center ${
                                            isSelected
                                              ? "bg-slate-900 text-white"
                                              : "text-slate-700 hover:bg-slate-100"
                                          }`}
                                        >
                                          <span>{s}</span>
                                          {isSelected && <span className="text-emerald-400 font-black">✓</span>}
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Line 3: Country & Pincode side-by-side */}
                          <div className="col-span-12 sm:col-span-6 relative custom-country-container">
                            <Label>Country <span className="text-rose-500 font-black">*</span></Label>
                            <button
                              type="button"
                              onClick={() => setModalCountryDropdownOpen(!modalCountryDropdownOpen)}
                              className={`w-full border ${
                                modalErrors.country ? "border-rose-400 bg-rose-50/40" : "border-slate-200 bg-slate-50/50"
                              } text-slate-900 px-4 py-2.5 rounded-xl font-bold text-sm outline-none text-left flex justify-between items-center transition-all cursor-pointer`}
                            >
                              <span className="text-slate-900 font-bold flex items-center gap-1.5">
                                <span>{COUNTRIES.find(c => c.name === modalForm.country)?.flag || "🇮🇳"}</span>
                                <span>{modalForm.country}</span>
                              </span>
                              <svg className={`w-4 h-4 text-slate-500 transition-transform duration-205 ${modalCountryDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                              </svg>
                            </button>
                            <ErrMsg field="country" />

                            {modalCountryDropdownOpen && (
                              <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-1.5 flex flex-col gap-0.5">
                                {COUNTRIES.map((c) => {
                                  const isSelected = modalForm.country === c.name;
                                  return (
                                    <button
                                      key={c.name}
                                      type="button"
                                      onClick={() => {
                                        setModalFormField("country", c.name);
                                        setModalFormField("phone_country_code", c.code);
                                        setModalFormField("phone", c.code + " " + modalForm.phone_number);
                                        setModalCountryDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex justify-between items-center ${
                                        isSelected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      <span className="flex items-center gap-2">
                                        <span>{c.flag}</span>
                                        <span>{c.name}</span>
                                      </span>
                                      {isSelected && <span className="text-emerald-400 font-black">✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="col-span-12 sm:col-span-6">
                            <Label>Pincode <span className="text-rose-500 font-black">*</span></Label>
                            <input type="text" placeholder="e.g. 411001" value={modalForm.pincode} onChange={(e) => setModalFormField("pincode", e.target.value)} className={inp("pincode")} maxLength={10} />
                            <ErrMsg field="pincode" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Step 3: Contact & Operations ── */}
                    {modalStep === 3 && (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Contact & Shifts</h4>
                          <span className="text-[10px] font-bold text-slate-400">* Required fields</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                          <div className="md:col-span-6 flex flex-col gap-4">
                            <div>
                              <Label>Branch Manager Name <span className="text-rose-500 font-black">*</span></Label>
                              <input type="text" placeholder="e.g. Rahul Patil" value={modalForm.manager_name} onChange={(e) => setModalFormField("manager_name", e.target.value)} className={inp("manager_name")} />
                              <ErrMsg field="manager_name" />
                            </div>
                            <div className="relative custom-phone-prefix-container">
                              <Label>Phone Number <span className="text-rose-500 font-black">*</span></Label>
                              <div className="flex relative">
                                <div className="absolute left-0 top-0 bottom-0 flex items-center z-10">
                                  <button
                                    type="button"
                                    onClick={() => setModalPhonePrefixOpen(!modalPhonePrefixOpen)}
                                    className="h-full px-3 bg-slate-50 border-r border-slate-200 hover:bg-slate-100 rounded-l-xl text-slate-800 font-black text-xs flex items-center gap-1 transition-all cursor-pointer select-none"
                                  >
                                    <span>{COUNTRIES.find(c => c.code === modalForm.phone_country_code)?.flag || "🇮🇳"}</span>
                                    <span className="text-[11px] font-extrabold">{modalForm.phone_country_code}</span>
                                    <svg className={`w-2.5 h-2.5 text-slate-500 transition-transform ${modalPhonePrefixOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                    </svg>
                                  </button>

                                  {modalPhonePrefixOpen && (
                                    <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                                      {COUNTRIES.map((c) => {
                                        const isSelected = modalForm.phone_country_code === c.code;
                                        return (
                                          <button
                                            key={c.name}
                                            type="button"
                                            onClick={() => {
                                              setModalFormField("phone_country_code", c.code);
                                              setModalFormField("phone", c.code + " " + modalForm.phone_number);
                                              setModalPhonePrefixOpen(false);
                                            }}
                                            className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex justify-between items-center ${
                                              isSelected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                                            }`}
                                          >
                                            <span className="flex items-center gap-1.5">
                                              <span>{c.flag}</span>
                                              <span>{c.name} ({c.code})</span>
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                <input
                                  type="tel"
                                  placeholder="98765 43210"
                                  value={modalForm.phone_number}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^\d\s\-]/g, ""); // allow digits, spaces, hyphens
                                    setModalFormField("phone_number", val);
                                    setModalFormField("phone", (modalForm.phone_country_code + " " + val).trim());
                                  }}
                                  className={inp("phone_number") + " pl-[84px]"}
                                />
                              </div>
                              <ErrMsg field="phone" />
                            </div>
                            <div>
                              <Label>GSTIN (Optional)</Label>
                              <input type="text" placeholder="27AAAAA0000A1Z5" value={modalForm.gstin} onChange={(e) => setModalFormField("gstin", e.target.value.toUpperCase())} className={inp("gstin") + " font-mono uppercase tracking-wider text-sm"} maxLength={15} />
                            </div>
                          </div>

                          <div className="md:col-span-6 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Employee Count</Label>
                                <input type="number" min={1} value={modalForm.employee_count} onChange={(e) => setModalFormField("employee_count", e.target.value)} className={inp("employee_count")} />
                              </div>
                              <div>
                                <Label>Opening Date</Label>
                                <input type="date" value={modalForm.opening_date} onChange={(e) => setModalFormField("opening_date", e.target.value)} className={inp("opening_date") + " cursor-pointer"} />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <Label>Working Hours</Label>
                              </div>
                              <input type="text" placeholder="e.g. 9AM-9PM" value={modalForm.working_hours} onChange={(e) => setModalFormField("working_hours", e.target.value)} className={inp("working_hours")} />
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {WORKING_HOURS_PRESETS.map((h) => {
                                  const isSelected = modalForm.working_hours === h;
                                  return (
                                    <button
                                      key={h}
                                      type="button"
                                      onClick={() => setModalFormField("working_hours", h)}
                                      className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide border transition-all cursor-pointer ${
                                        isSelected
                                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                      }`}
                                    >
                                      {h}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Step 4: Review ── */}
                    {modalStep === 4 && (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Final Verification</h4>
                          <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Ready to launch</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-950 rounded-2xl p-4 shadow-xl border border-slate-900 text-[13px] leading-tight text-white text-left">
                          <div className="space-y-3 md:border-r md:border-slate-800 md:pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
                                {BRANCH_TYPES.find((t) => t.value === modalForm.branch_type)?.icon || "🏪"}
                              </div>
                              <div>
                                <h5 className="text-white font-black text-sm leading-none">{modalForm.branch_name || "New Branch"}</h5>
                                <span className="text-emerald-400 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mt-1">{modalForm.branch_code || "CODE"}</span>
                              </div>
                            </div>
                            <div className="pt-1">
                              <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider block mb-1">Registered Address</span>
                              <span className="text-slate-350 text-xs font-semibold leading-relaxed block">{modalForm.address}</span>
                              <span className="text-white text-xs font-bold block mt-1">{modalForm.city}, {modalForm.state}, {modalForm.country} – {modalForm.pincode}</span>
                            </div>
                          </div>

                          <div className="space-y-3 md:border-r md:border-slate-800 md:px-4">
                            <div>
                              <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider block mb-1">Branch Manager</span>
                              <span className="text-white text-sm font-bold block">{modalForm.manager_name}</span>
                              <span className="text-slate-400 text-xs font-semibold block mt-0.5">{modalForm.phone}</span>
                            </div>
                            {modalForm.gstin && (
                              <div>
                                <span className="text-slate-550 text-[9px] font-black uppercase tracking-wider block mb-1">GST Identification</span>
                                <span className="text-emerald-400 font-mono text-[10px] font-black uppercase tracking-widest">{modalForm.gstin}</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 md:pl-4">
                            <div>
                              <span className="text-slate-500 text-[9px] font-black uppercase tracking-wider block mb-1">Operating Hours</span>
                              <span className="text-white text-sm font-bold block">{modalForm.working_hours}</span>
                            </div>
                            <div>
                              <span className="text-slate-550 text-[9px] font-black uppercase tracking-wider block mb-1">Team & Launch</span>
                              <span className="text-white text-xs font-bold block">{modalForm.employee_count} Active Staff Member{modalForm.employee_count !== 1 ? "s" : ""}</span>
                              {modalForm.opening_date && (
                                <span className="text-slate-400 text-[10px] font-semibold block mt-0.5">Opening: {modalForm.opening_date}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer Controls */}
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-3">
                    {modalStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => setShowAddBranchModal(false)}
                        className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-black rounded-xl transition-all text-xs tracking-wider cursor-pointer"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={goBackModalStep}
                        className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-black rounded-xl transition-all text-xs tracking-wider cursor-pointer"
                      >
                        ← Back
                      </button>
                    )}

                    {modalStep < 4 ? (
                      <button
                        type="button"
                        onClick={goNextModalStep}
                        className="px-7 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl transition-all text-xs tracking-widest cursor-pointer shadow-lg shadow-slate-900/10 ml-auto"
                      >
                        Continue →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAddBranch}
                        disabled={loading}
                        className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-xl transition-all text-xs tracking-widest cursor-pointer shadow-lg shadow-emerald-600/20 ml-auto flex items-center gap-1.5"
                      >
                        {loading ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {modalForm._id ? "Saving..." : "Creating..."}
                          </>
                        ) : (
                          <>{modalForm._id ? "💾 Save Changes" : "🚀 Launch Branch"}</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    </div>
  );
}

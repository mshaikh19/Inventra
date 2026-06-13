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
  userHasOwnerAccess,
} from "../utils/dashboard";
import { addBranchToNetwork, getUserBranches, createBranch, updateBranch, deactivateBranch, getBranchInventory } from "../utils/branches";
import { getEmployees } from "../utils/employees";
import { getTasks, updateTask } from "../utils/tasks";
import { toast } from "react-toastify";
import InventoryTable from "../components/inventoryTable";
import CSVUpload from "../components/csvUpload";
import SmallDashboard from "../components/smallDashboard";
import MediumDashboard from "../components/mediumDashboard";
import LargeDashboard from "../components/largeDashboard";
import CustomDropdown from "../components/CustomDropdown";
import NotificationDropdown from "../components/notificationDropdown";
import { useNotifications } from "../contexts/notificationContext";
import { loadScopedInventoryProducts, saveScopedInventoryProducts, normalizeInventoryProducts } from "../utils/inventory";
import {
  isEmployeeUser,
  getEmployeeEnvironment,
  getEmployeeQuickActions,
  getEmployeeAccessLabel,
} from "../utils/employeeWorkspace";

const getRoleDisplayName = (role) => {
  if (!role || role === "owner" || role === "user") return "SYSTEM OWNER";
  const r = String(role).trim().toLowerCase();
  if (r === "manager") return "BRANCH MANAGER";
  if (r === "warehouse_manager") return "WAREHOUSE MANAGER";
  if (r === "franchise_manager") return "FRANCHISE MANAGER";
  if (r === "depot_manager") return "DEPOT MANAGER";
  if (r === "store_manager") return "STORE MANAGER";
  if (r === "store_employee") return "STORE STAFF";
  if (r === "warehouse_employee") return "WAREHOUSE STAFF";
  if (r === "franchise_employee") return "FRANCHISE STAFF";
  if (r === "depot_employee") return "DEPOT STAFF";
  if (r === "employee") return "STAFF MEMBER";
  if (r.endsWith("_manager")) return r.replace(/_/g, " ").toUpperCase();
  if (r.endsWith("_employee")) return r.replace(/_/g, " ").toUpperCase();
  return String(role).toUpperCase().replace("_", " ");
};

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

function getDynamicLabels(type) {
  const defs = {
    Store: {
      nameLabel: "Store Name", namePlaceholder: "e.g. Downtown Store",
      codeLabel: "Store Code", codePlaceholder: "e.g. STORE-001",
      addressLabel: "Store Address", addressPlaceholder: "e.g. 42 MG Road",
      cityLabel: "Store City", cityPlaceholder: "e.g. Mumbai",
      pincodeLabel: "Store Pincode", pincodePlaceholder: "e.g. 400001",
      managerLabel: "Store Manager", placeholderName: "e.g. Rajesh Kumar",
      phoneLabel: "Store Phone", phonePlaceholder: "e.g. 98765 43210",
      emailLabel: "Manager Email", emailPlaceholder: "manager@example.com",
      gstLabel: "GSTIN", gstPlaceholder: "e.g. 27AABCU9603R1ZM",
      staffLabel: "Staff Count", openingDateLabel: "Opening Date",
      hoursLabel: "Working Hours", placeholderHours: "e.g. 9AM-9PM",
      verificationHeader: "Verification Summary",
      titleLabel: "Store", addressSectionLabel: "📍 Address",
      managerSectionLabel: "👤 Manager", gstSectionLabel: "🧾 GSTIN",
      hoursSectionLabel: "⏰ Hours", teamSectionLabel: "👥 Team",
    },
    Warehouse: {
      nameLabel: "Warehouse Name", namePlaceholder: "e.g. Central Warehouse",
      codeLabel: "Warehouse Code", codePlaceholder: "e.g. WH-001",
      addressLabel: "Warehouse Address", addressPlaceholder: "e.g. Plot 5, Industrial Area",
      cityLabel: "Warehouse City", cityPlaceholder: "e.g. Pune",
      pincodeLabel: "Warehouse Pincode", pincodePlaceholder: "e.g. 411001",
      managerLabel: "Warehouse Manager", placeholderName: "e.g. Suresh Patel",
      phoneLabel: "Warehouse Phone", phonePlaceholder: "e.g. 98765 43210",
      emailLabel: "Manager Email", emailPlaceholder: "manager@example.com",
      gstLabel: "GSTIN", gstPlaceholder: "e.g. 27AABCU9603R1ZM",
      staffLabel: "Staff Count", openingDateLabel: "Opening Date",
      hoursLabel: "Operating Hours", placeholderHours: "e.g. 8AM-8PM",
      verificationHeader: "Verification Summary",
      titleLabel: "Warehouse", addressSectionLabel: "📍 Address",
      managerSectionLabel: "👤 Manager", gstSectionLabel: "🧾 GSTIN",
      hoursSectionLabel: "⏰ Hours", teamSectionLabel: "👥 Team",
    },
    Factory: {
      nameLabel: "Factory Name", namePlaceholder: "e.g. Manufacturing Unit",
      codeLabel: "Factory Code", codePlaceholder: "e.g. FAC-001",
      addressLabel: "Factory Address", addressPlaceholder: "e.g. 12B Industrial Zone",
      cityLabel: "Factory City", cityPlaceholder: "e.g. Chennai",
      pincodeLabel: "Factory Pincode", pincodePlaceholder: "e.g. 600001",
      managerLabel: "Factory Manager", placeholderName: "e.g. Priya Sharma",
      phoneLabel: "Factory Phone", phonePlaceholder: "e.g. 98765 43210",
      emailLabel: "Manager Email", emailPlaceholder: "manager@example.com",
      gstLabel: "GSTIN", gstPlaceholder: "e.g. 27AABCU9603R1ZM",
      staffLabel: "Staff Count", openingDateLabel: "Opening Date",
      hoursLabel: "Shift Hours", placeholderHours: "e.g. 7AM-11PM",
      verificationHeader: "Verification Summary",
      titleLabel: "Factory", addressSectionLabel: "📍 Address",
      managerSectionLabel: "👤 Manager", gstSectionLabel: "🧾 GSTIN",
      hoursSectionLabel: "⏰ Hours", teamSectionLabel: "👥 Team",
    },
    Outlet: {
      nameLabel: "Outlet Name", namePlaceholder: "e.g. Airport Kiosk",
      codeLabel: "Outlet Code", codePlaceholder: "e.g. OUT-001",
      addressLabel: "Outlet Address", addressPlaceholder: "e.g. Terminal 2",
      cityLabel: "Outlet City", cityPlaceholder: "e.g. Delhi",
      pincodeLabel: "Outlet Pincode", pincodePlaceholder: "e.g. 110001",
      managerLabel: "Outlet Manager", placeholderName: "e.g. Amit Verma",
      phoneLabel: "Outlet Phone", phonePlaceholder: "e.g. 98765 43210",
      emailLabel: "Manager Email", emailPlaceholder: "manager@example.com",
      gstLabel: "GSTIN", gstPlaceholder: "e.g. 27AABCU9603R1ZM",
      staffLabel: "Staff Count", openingDateLabel: "Opening Date",
      hoursLabel: "Working Hours", placeholderHours: "e.g. 10AM-10PM",
      verificationHeader: "Verification Summary",
      titleLabel: "Outlet", addressSectionLabel: "📍 Address",
      managerSectionLabel: "👤 Manager", gstSectionLabel: "🧾 GSTIN",
      hoursSectionLabel: "⏰ Hours", teamSectionLabel: "👥 Team",
    },
  };
  return defs[type] || defs.Store;
}

function autoCode(name) {
  if (!name || !name.trim()) return "";
  const prefix = name.trim().split(/\s+/)[0].substring(0, 3).toUpperCase();
  const suffix = String(Date.now()).slice(-4);
  return `${prefix}-${suffix}`;
}

const EMPTY_BRANCH_FORM = {
  branch_name: "",
  branch_code: "",
  branch_type: "Store",
  address: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  phone: "",
  phone_country_code: "+91",
  phone_number: "",
  manager_name:       "",
  manager_email:      "",
  employee_count:     1,
  working_hours:      "9AM-9PM",
  opening_date:       "",
  gstin:              "",
};

export default function Dashboard({ tier: normalizedTier, setActiveTab }) {
  const config = DASHBOARD_CONFIG[normalizedTier] || DASHBOARD_CONFIG.small;
  const tierBadgeLabel = getTierBadgeLabel(normalizedTier);
  const tierFeatures = TIER_FEATURES[normalizedTier] || TIER_FEATURES.small;
  const tierDisplayName = getTierDisplayName(normalizedTier);

  const { notifications } = useNotifications();

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

  const isOwner = useMemo(() => {
    return userHasOwnerAccess(userSession?.user);
  }, [userSession]);

  const userBranchId = isOwner ? null : userSession?.user?.branchId;

  // visibleTabs is defined below branchesList to prevent ReferenceError.

  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("inventra_dashboard_section");
      if (saved) return saved;
      try {
        const rawUser = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (isEmployeeUser(user) && !userHasOwnerAccess(user)) {
            return "tasks";
          }
        }
      } catch {
        // ignore
      }
    }
    return "overview";
  });

  useEffect(() => {
    const validKeys = visibleTabs.map(t => t.key);
    if (!validKeys.includes(activeSection)) {
      const defaultKey = validKeys[0];
      if (defaultKey) {
        if (defaultKey === "billing") {
          setActiveTab(getBillingPosTab(normalizedTier));
        } else if (defaultKey === "inventory") {
          setActiveTab(getInventoryOpsTab(normalizedTier));
        } else {
          setActiveSection(defaultKey);
        }
      }
    }
  }, [visibleTabs, activeSection, setActiveTab, normalizedTier]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("inventra_dashboard_section", activeSection);
    }
  }, [activeSection]);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showAddBranchModal, setShowAddBranchModal] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("inventra_show_add_branch_modal") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("inventra_show_add_branch_modal", showAddBranchModal ? "true" : "false");
    }
  }, [showAddBranchModal]);

  const [modalStep, setModalStep] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("inventra_add_branch_modal_step");
      if (saved) return parseInt(saved, 10);
    }
    return 1;
  });



  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("inventra_add_branch_modal_step", modalStep.toString());
    }
  }, [modalStep]);

  const [modalForm, setModalForm] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("inventra_add_branch_modal_form");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return EMPTY_BRANCH_FORM;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("inventra_add_branch_modal_form", JSON.stringify(modalForm));
    }
  }, [modalForm]);

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

  const [branchNetwork, setBranchNetwork] = useState(() => []);
  const [branchesList, setBranchesList] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("inventra_branches_list");
      if (stored) {
        let parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          if (!isOwner && userBranchId) {
            parsed = parsed.filter(b => b.branch_id === userBranchId);
          }
          return parsed;
        }
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

  const isManager = useMemo(() => {
    if (isOwner) return false;
    const role = String(userSession?.user?.role || "").trim().toLowerCase();
    const roles = Array.isArray(userSession?.user?.roles)
      ? userSession.user.roles.map(r => String(r || "").trim().toLowerCase())
      : [];
    return role === "manager" || role.endsWith("_manager") || roles.includes("manager");
  }, [isOwner, userSession]);

  const isEmployee = useMemo(() => {
    if (isOwner || isManager) return false;
    return isEmployeeUser(userSession?.user);
  }, [isOwner, isManager, userSession]);

  const userBranch = useMemo(() => {
    if (!userBranchId) return null;
    return branchesList?.find(b => b.branch_id === userBranchId) || branchesList?.[0];
  }, [branchesList, userBranchId]);

  const branchType = userBranch?.branch_type || "Store";

  const employeeEnvironment = useMemo(() => {
    if (!isEmployee) return null;
    return getEmployeeEnvironment(userSession?.user, userBranch);
  }, [isEmployee, userSession, userBranch]);

  const employeeQuickActions = useMemo(() => {
    if (!isEmployee || !employeeEnvironment) return [];
    return getEmployeeQuickActions(employeeEnvironment, normalizedTier, setActiveTab);
  }, [isEmployee, employeeEnvironment, normalizedTier, setActiveTab]);

  const visibleTabs = useMemo(() => {
    if (isOwner) {
      const tabs = [...WORKSPACE_TABS];
      tabs.splice(4, 0, { key: "employees", label: "Manage Staff", icon: "👥" });
      return tabs;
    }
    if (isManager) {
      return [
        { key: "overview", label: "Branch Overview", icon: "🏠" },
        { key: "inventory", label: "Inventory Desk", icon: "📦" },
        { key: "billing", label: "Billing POS", icon: "🧾" },
        { key: "analytics", label: "AI Forecasts & Analytics", icon: "📊" },
        { key: "employees", label: "Staff", icon: "👥" },
        { key: "profile", label: "Profile", icon: "👤" },
      ];
    }
    if (isEmployee) {
      const isWarehouseOrDepot =
        branchType.toLowerCase() === "warehouse" ||
        branchType.toLowerCase() === "depot" ||
        branchType.toLowerCase() === "factory";
      if (isWarehouseOrDepot) {
        return [
          { key: "inventory", label: "Inventory Desk", icon: "📦" },
          { key: "tasks", label: "My Tasks", icon: "📋" },
          { key: "profile", label: "Profile", icon: "👤" },
        ];
      } else {
        return [
          { key: "billing", label: "Billing POS", icon: "🧾" },
          { key: "tasks", label: "My Tasks", icon: "📋" },
          { key: "profile", label: "Profile", icon: "👤" },
        ];
      }
    }
    return [];
  }, [isOwner, isManager, isEmployee, branchType]);

  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const fetchEmployeeTasks = async () => {
    if (!isEmployee) return;
    setLoadingTasks(true);
    try {
      const data = await getTasks();
      setEmployeeTasks(data || []);
    } catch (err) {
      console.warn("Failed to fetch employee tasks:", err);
      toast.error(err.message || "Failed to load tasks");
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    setEmployeeTasks(prev =>
      prev.map(t => {
        const id = t._id || t.id;
        if (id === taskId) {
          return {
            ...t,
            status: nextStatus,
            completed_at: nextStatus === "completed" ? new Date().toISOString() : null
          };
        }
        return t;
      })
    );
    try {
      await updateTask(taskId, { status: nextStatus });
      toast.success(nextStatus === "completed" ? "Task marked as completed!" : "Task marked as pending.");
    } catch (err) {
      console.warn("Failed to update task status:", err);
      toast.error(err.message || "Failed to update task");
      fetchEmployeeTasks();
    }
  };

  useEffect(() => {
    if (isEmployee && activeSection === "tasks") {
      fetchEmployeeTasks();
    }
  }, [isEmployee, activeSection]);

  // Sync branches from DB on mount
  useEffect(() => {
    getUserBranches()
      .then((data) => {
        if (data && data.branches) {
          let branches = data.branches;
          if (!isOwner && userBranchId) {
            branches = branches.filter(b => b.branch_id === userBranchId);
          }
          const names = branches.map((b) => b.branch_name);
          setBranchNetwork(names);
          setBranchesList(branches);
          try {
            localStorage.setItem("inventra_branches_list", JSON.stringify(branches));
          } catch (e) {}
        }
        setFirstLoadDone(true);
      })
      .catch((err) => {
        console.error("Failed to load branches from DB:", err);
        setFirstLoadDone(true);
      });
  }, [normalizedTier, setActiveTab, isOwner, userBranchId]);

  // States for Medium and Large Analytics Page redone visually
  const [mediumRange, setMediumRange] = useState("30d");
  const [hoveredCategory, setHoveredCategory] = useState(null);
  
  // Large tier NLP Chat console simulation states
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  // Large tier heatmap active branch state
  const [activeBranch, setActiveBranch] = useState("");

  const [products, setProducts] = useState([]);

  // Consolidated Sales Metrics States
  const [salesCount, setSalesCount] = useState(0);
  const [salesRevenue, setSalesRevenue] = useState(0);
  const [salesRevenueNote, setSalesRevenueNote] = useState("");
  const [salesHistory, setSalesHistory] = useState([]);

  // Fetch real payment statistics from backend dynamically on mount
  useEffect(() => {
    const token = localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
    if (token) {
      fetch("http://127.0.0.1:8000/api/v1/payments/stats", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })
      .then(res => {
        if (!res.ok) throw new Error("Offline or bad response");
        return res.json();
      })
      .then(data => {
        if (data && typeof data.sales_count === "number") {
          setSalesCount(data.sales_count);
          setSalesRevenue(data.daily_sales || 0);
          setSalesRevenueNote(data.comparison_note || "0% vs yesterday");
          if (data.last_7_days_sales) {
            setSalesHistory(data.last_7_days_sales);
          }
        }
      })
      .catch(err => {
        console.error("Failed to fetch payment stats:", err);
      });
    }
  }, []);

  // Load real dynamic products from cache or DB if branch exists
  useEffect(() => {
    if (branchesList && branchesList.length > 0) {
      if (normalizedTier === "small") {
        const activeBranch = branchesList[0];
        const activeBranchName = activeBranch.branch_name;
        const branchId = activeBranch._id || activeBranch.branch_id;
        
        // Load from local storage cache first for responsive UI rendering
        const cached = loadScopedInventoryProducts([], activeBranchName);
        if (cached && cached.length > 0) {
          setProducts(cached);
        }
        
        // Always fetch dynamic live values from DB in the background to ensure data freshness
        getBranchInventory(branchId)
          .then((invData) => {
            const items = invData.items || invData.inventory?.items || [];
            const normalized = normalizeInventoryProducts(items);
            setProducts(normalized);
            saveScopedInventoryProducts(normalized, activeBranchName);
          })
          .catch((err) => {
            console.warn("Failed to load branch inventory for dashboard overview:", err);
          });
      } else {
        // Fetch all branch inventories in parallel
        Promise.all(
          branchesList.map(branch => {
            const branchId = branch._id || branch.branch_id;
            return getBranchInventory(branchId)
              .then((invData) => {
                const items = invData.items || invData.inventory?.items || [];
                const normalized = normalizeInventoryProducts(items);
                // Tag each item with its branch name so dashboard elements can map it
                const tagged = normalized.map(p => ({ ...p, branchName: branch.branch_name, branchId: branchId }));
                saveScopedInventoryProducts(normalized, branch.branch_name);
                return tagged;
              })
              .catch((err) => {
                console.warn(`Failed to fetch inventory for branch ${branch.branch_name}:`, err);
                const cached = loadScopedInventoryProducts([], branch.branch_name);
                return cached.map(p => ({ ...p, branchName: branch.branch_name, branchId: branchId }));
              });
          })
        ).then((allResults) => {
          const merged = allResults.flat();
          setProducts(merged);
        });
      }
    } else {
      setProducts([]);
    }
  }, [branchesList, normalizedTier]);

  // Session details are moved to the top of Dashboard component

  

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
  const [profileDraft, setProfileDraft] = useState({ firstName: "", lastName: "", businessName: "", email: "", businessType: "" });

  // ── Delete Account state ──────────────────────────────────────────────────
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [accountDeleted, setAccountDeleted] = useState(false);   // shows post-delete screen
  const [recoveryToken, setRecoveryToken] = useState("");          // returned by backend
  const [recoveringAccount, setRecoveringAccount] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setProfileDraft({
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        businessName: userProfile.businessName || userProfile.company || "",
        email: userProfile.email || "",
        businessType: userProfile.businessType || "",
      });
    }
  }, [userProfile]);

  const userDisplayName = getUserDisplayName(userProfile || userSession?.user);

  const handleLogout = () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem("inventra_token");
      storage.removeItem("inventra_user");
    }
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("inventra_dashboard_section");
      window.history.replaceState({}, "", "/");
    }
    setActiveTab("home");
  };

  const handleDeleteAccount = async () => {
    const expectedEmail = userProfile?.email || userSession?.user?.email || "";
    if (deleteConfirmEmail.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
      setDeleteError("Email does not match. Please type your exact account email to confirm.");
      return;
    }
    setDeletingAccount(true);
    setDeleteError("");
    try {
      const token = userSession?.token;
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/delete-account", {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.detail === "string" ? data.detail : "Failed to delete account"
        );
      }
      const data = await res.json().catch(() => ({}));
      // Store recovery token for the post-delete screen
      setRecoveryToken(data.recoveryToken || "");
      // Clear session — user is now logged out
      for (const storage of [localStorage, sessionStorage]) {
        storage.removeItem("inventra_token");
        storage.removeItem("inventra_user");
        storage.removeItem("inventra_branches_list");
      }
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("inventra_dashboard_section");
      }
      // Switch modal to post-delete choice screen (don't close modal yet)
      setAccountDeleted(true);
    } catch (err) {
      setDeleteError(err.message || "An error occurred. Please try again.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleRecoverAccount = async () => {
    if (!recoveryToken) return;
    setRecoveringAccount(true);
    setDeleteError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/recover-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.detail === "string" ? data.detail : "Recovery failed"
        );
      }
      const data = await res.json();
      // Log the user back in automatically
      if (data?.accessToken && data?.user) {
        localStorage.setItem("inventra_token", data.accessToken);
        localStorage.setItem("inventra_user", JSON.stringify(data.user));
      }
      toast.success("Welcome back! Your account has been fully restored.");
      setShowDeleteAccountModal(false);
      setAccountDeleted(false);
      setRecoveryToken("");
      // Force a page reload so all state picks up the restored session
      window.location.reload();
    } catch (err) {
      setDeleteError(err.message || "Recovery failed. Please try again.");
    } finally {
      setRecoveringAccount(false);
    }
  };

  const handleCSVUploadComplete = () => {
  };

  const handleSaveBranch = async () => {
    const payload = {
      branch_name: modalForm.branch_name.trim(),
      branch_code: modalForm.branch_code.trim(),
      branch_type: modalForm.branch_type,
      address: modalForm.address.trim(),
      city: modalForm.city.trim(),
      state: modalForm.state,
      country: modalForm.country,
      pincode: modalForm.pincode.trim(),
      phone: (modalForm.phone_country_code + " " + modalForm.phone_number.trim()).trim(),
      manager_name: modalForm.manager_name.trim(),
      manager_email: modalForm.manager_email.trim() || null,
      employee_count: Number(modalForm.employee_count) || 1,
      working_hours: modalForm.working_hours,
      opening_date: modalForm.opening_date || null,
      gstin: modalForm.branch_type === "Warehouse" ? null : (modalForm.gstin.trim() || null),
      status: "Active",
    };

    setLoading(true);
    try {
      let result;
      if (modalForm._id) {
        result = await updateBranch(modalForm._id, payload);
      } else {
        const nameParts = modalForm.manager_name.trim().split(/\s+/);
        const firstName = nameParts[0] || "manager";
        const lastName = nameParts.slice(1).join("_") || "manager";
        payload.manager_password = `${firstName}_${lastName}@manager`.toLowerCase();
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-black shadow-sm">✓</div>
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
        manager_email: branch.manager_email || "",
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-black shadow-sm">✓</div>
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

  // Open the profile edit modal
  const openEditProfile = () => {
    setEditingProfile(true);
  };

  // Save profile draft locally (and attempt backend update if available)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      // Update local state and localStorage immediately for responsive UI
      const updated = {
        ...userProfile,
        firstName: profileDraft.firstName || (userProfile && userProfile.firstName) || "",
        lastName: profileDraft.lastName || (userProfile && userProfile.lastName) || "",
        businessName: profileDraft.businessName || (userProfile && userProfile.businessName) || "",
        email: profileDraft.email || (userProfile && userProfile.email) || "",
        businessType: profileDraft.businessType || (userProfile && userProfile.businessType) || "other",
      };
      setUserProfile(updated);
      try {
        localStorage.setItem("inventra_user", JSON.stringify(updated));
        sessionStorage.setItem("inventra_user", JSON.stringify(updated));
      } catch (err) {
        // ignore storage errors
      }

      // Optimistic UI: close editor and show success
      setEditingProfile(false);
      toast.success("Executive profile updated successfully!");

      // Optional: persist to backend if token present
      const token = localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
      if (token) {
        try {
          const res = await fetch("http://127.0.0.1:8000/api/v1/auth/update-profile", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              firstName: updated.firstName,
              lastName: updated.lastName,
              businessName: updated.businessName,
              email: updated.email,
              businessType: updated.businessType,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.user) {
              setUserProfile(data.user);
              localStorage.setItem("inventra_user", JSON.stringify(data.user));
              sessionStorage.setItem("inventra_user", JSON.stringify(data.user));
            }
          }
        } catch (err) {
          console.warn("Failed to persist profile to backend:", err);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save profile.");
    }
  };

  // ==========================================
  // HIGH-FIDELITY CUSTOM VISUALIZATIONS
  // ==========================================

  const renderInteractiveSeasonalChart = () => {
    const width = 500;
    const height = 180;
    const padding = 20;

    const hasSales = salesRevenue > 0 && salesHistory.length > 0;

    if (!hasSales) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-400">No sales data available yet.</p>
        </div>
      );
    }

    const dates = mediumRange === "7d" 
      ? salesHistory.map(h => h.day)
      : ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8"];
       
    const baseLine = mediumRange === "7d"
      ? salesHistory.map(h => h.revenue)
      : [];

    const upperLine = baseLine.map(v => v + Math.round(v * 0.15));
    const lowerLine = baseLine.map(v => Math.max(0, v - Math.round(v * 0.15)));

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
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-sm text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Revenue</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-slate-800">₹{salesRevenue.toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-sm text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Sales Count</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-slate-800">{salesCount}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-sm text-left">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Note</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-slate-800">{salesRevenueNote || "—"}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Interactive SVG */}
        <div className="relative overflow-hidden border border-slate-200/60 bg-gradient-to-b from-slate-50 to-white rounded-2xl p-4 shadow-inner">
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
                  {isPeak && hasSales && (
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

          {!hasSales ? (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[3px] flex flex-col items-center justify-center text-center p-6 z-10 border border-slate-100/50">
              <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm text-sm mb-2">📈</div>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Cannot Forecast Now</span>
              <p className="text-xs font-semibold text-slate-500 mt-2 max-w-sm leading-relaxed">
                Holiday-aware profit forecasting and confidence boundaries will activate once transactions are recorded in Billing POS.
              </p>
            </div>
          ) : null}
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

    const totalSold = products.reduce((sum, p) => sum + (p.sold || 0), 0);
    const hasSales = totalSold > 0;

    const categories = (() => {
      const categorySales = {};
      let netSold = 0;
      products.forEach(p => {
        const cat = p.category || "Other";
        const sold = p.sold || 0;
        categorySales[cat] = (categorySales[cat] || 0) + sold;
        netSold += sold;
      });
      
      const defaultCats = [
        { label: "Dairy", val: 40, color: "#10B981", money: "₹0", status: "Fast Moving", fill: "98% Fill" },
        { label: "Beverages", val: 30, color: "#0EA5E9", money: "₹0", status: "Seasonal Spike", fill: "97% Fill" },
        { label: "Snacks", val: 20, color: "#D97706", money: "₹0", status: "High Margin", fill: "89% Fill" },
        { label: "Bakery", val: 10, color: "#EC4899", money: "₹0", status: "Critical Expiry", fill: "91% Fill" },
      ];
      
      if (netSold === 0) return defaultCats;
      
      const sortedCats = Object.keys(categorySales)
        .map(cat => ({
          label: cat,
          val: Math.round((categorySales[cat] / netSold) * 100),
          raw: categorySales[cat],
          money: `₹${(categorySales[cat] * 40).toLocaleString()}`, // estimate value based on sales
          status: "Active Segment",
          fill: "Healthy Fill"
        }))
        .filter(c => c.raw > 0)
        .sort((a, b) => b.raw - a.raw);
        
      const colors = ["#10B981", "#0EA5E9", "#D97706", "#EC4899", "#8B5CF6", "#64748B"];
      return sortedCats.slice(0, 4).map((c, i) => ({
        ...c,
        color: colors[i % colors.length]
      }));
    })();

    let currentOffset = 0;

    return (
      <div className="relative overflow-hidden w-full">
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
                  {hasSales ? `${totalSold} Units` : "0 Units"}
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
                      <span className="text-[9px] font-semibold text-slate-500 block mt-1 leading-none">{c.label} • {c.fill}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900 block">{hasSales ? c.money : "—"}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Allocated</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!hasSales ? (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[3px] flex flex-col items-center justify-center text-center p-6 z-10 border border-slate-100/50">
            <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm text-sm mb-2">📊</div>
            <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Sales Data Unavailable</span>
            <p className="text-xs font-semibold text-slate-500 mt-2 max-w-xs leading-relaxed">
              Category sales distribution and segment shares will populate once transactions are recorded in Billing POS.
            </p>
          </div>
        ) : null}
      </div>
    );
  };

  const simulateChatCommand = (promptText) => {
    if (isTyping) return;

    const userMsg = { role: "user", text: promptText };
    setChatHistory(prev => [...prev, userMsg]);
    setIsTyping(true);

    const activeBranches = branchesList && branchesList.length > 0 ? branchesList.map(b => b.branch_name) : [];
    const activeProducts = products && products.length > 0 ? products.map(p => p.name) : [];

    let replyText = "";
    if (activeBranches.length === 0 && activeProducts.length === 0) {
      replyText = "No data available. Set up branches and inventory first.";
    } else {
      const lowStock = products.filter(p => p.stock <= p.reorderLevel);
      if (lowStock.length > 0) {
        replyText = `Found ${lowStock.length} low-stock items: ${lowStock.slice(0, 3).map(p => p.name).join(", ")}. Consider restocking soon.`;
      } else {
        replyText = `Monitoring ${activeBranches.length} branches with ${activeProducts.length} products. All levels nominal.`;
      }
    }

    setTimeout(() => {
      setChatHistory(prev => [...prev, { role: "assistant", text: replyText }]);
      setIsTyping(false);
    }, 800);
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
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 flex flex-col justify-end text-left scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "self-end items-end" : "self-start items-start"}`}>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
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
            →
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
              <path d="M 100 160 Q 115 185 130 210" fill="none" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
              {/* Flow line 2: Delhi to Chennai */}
              <path d="M 120 50 Q 165 140 170 230" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
              {/* Flow line 3: Bangalore to Chennai */}
              <path d="M 130 210 Q 150 220 170 230" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
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
                    <circle cx={cx} cy={cy} r="12" fill="#10B981" opacity="0.25" className="animate-ping" />
                  )}
                  <circle cx={cx} cy={cy} r="6" fill={isSelected ? "#10B981" : "#1E293B"} stroke="#10B981" strokeWidth="2.5" />
                  <circle cx={cx} cy={cy} r="2" fill="#FFFFFF" />
                  <text x={cx} y={cy - 10} fill="#94A3B8" fontSize="8" fontWeight="black" textAnchor="middle" className="uppercase tracking-wider">
                    {key}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="absolute top-2.5 left-2.5 text-[8px] font-black text-slate-550 uppercase tracking-widest">
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
              <span className="text-[8px] font-black text-slate-550 uppercase tracking-wider block">Operational Yield</span>
              <span className="text-sm font-black text-emerald-400 block mt-0.5">{activeInfo.efficiency}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5">
              <span className="text-[8px] font-black text-slate-550 uppercase tracking-wider block">Assigned Fleet</span>
              <span className="text-sm font-black text-slate-200 block mt-0.5">{activeInfo.fleet}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5 col-span-2">
              <span className="text-[8px] font-black text-slate-550 uppercase tracking-wider block">Monitored Safety Stock Buffer</span>
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
          <NotificationDropdown
            buttonClassName="h-10 w-10 border-slate-200 bg-white hover:border-slate-300"
            panelClassName="mt-3"
            title="AI Real-Time Alerts"
            emptyMessage="No active alerts currently."
          />

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
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-slate-500">
                {!isOwner ? getRoleDisplayName(userProfile?.role || userSession?.user?.role) : config.profile.role}
              </span>
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
                <span className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">
                  {isEmployee ? "Employee Workspace" : "Business Control"}
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5 leading-tight">
                  {isEmployee ? (employeeEnvironment?.label || "My Branch Desk") : config.label}
                </h2>
              </div>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white shadow-sm" style={{ background: config.shell }}>
                {tierBadgeLabel}
              </span>
            </div>
            <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">
              {isEmployee ? (employeeEnvironment?.blurb || "Complete assigned duties and use your branch tools.") : config.summary}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Role</div>
                <div className="mt-1 text-[11px] font-bold text-slate-800 leading-tight">
                  {!isOwner ? getRoleDisplayName(userProfile?.role || userSession?.user?.role) : config.profile.role}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Access</div>
                <div className="mt-1 text-[11px] font-bold text-slate-800 leading-tight">
                  {isEmployee
                    ? getEmployeeAccessLabel(employeeEnvironment, normalizedTier)
                    : isManager
                    ? "Branch-scoped operations"
                    : config.profile.access}
                </div>
              </div>
            </div>

            {isEmployee && userBranch && (
              <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Assigned Branch</div>
                <div className="mt-1 text-[11px] font-bold text-slate-800 leading-tight">
                  {employeeEnvironment?.icon} {userBranch.branch_name} · {userBranch.branch_type}
                </div>
              </div>
            )}
          </div>

          <nav className="mt-4 space-y-2.5">
            {visibleTabs.map((tab) => {
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
                    if (tab.key === "employees") {
                      setActiveTab("employees");
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

          {!isEmployee && (
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
          )}

          {isEmployee && employeeQuickActions.length > 0 && (
            <div className="mt-4 space-y-2">
              {employeeQuickActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={action.onClick}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl text-lg" style={{ background: `${action.accent}14` }}>
                      {action.icon}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-black text-slate-900 group-hover:text-slate-950">{action.label}</span>
                      <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">{action.description}</span>
                    </div>
                    <span className="ml-auto text-slate-300 group-hover:text-slate-500 transition-colors">→</span>
                  </div>
                </button>
              ))}
            </div>
          )}

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
            className="flex-1 py-3 px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-950 font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-2 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          >
            <span>🧭</span>
            <span>Workspace Navigation Menu</span>
          </button>
        </div>

        {mobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Workspace Selection</span>
              <button 
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 text-sm cursor-pointer"
              >
                ✕ Close Menu
              </button>
            </div>
            
            <nav className="space-y-2 mb-6">
              {visibleTabs.map((tab) => (
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
                    if (tab.key === "employees") {
                      setActiveTab("employees");
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
              {isOwner ? (
                <>
                  {normalizedTier === "small" && (
                    <SmallDashboard 
                      products={products}
                      salesCount={salesCount}
                      salesRevenue={salesRevenue}
                      salesRevenueNote={salesRevenueNote}
                      notifications={notifications}
                      tierAccent={config.accent}
                      tierAccentSoft={config.accentSoft}
                      salesHistory={salesHistory}
                    />
                  )}
                  {normalizedTier === "medium" && (
                    <MediumDashboard 
                      products={products}
                      onUpdateProducts={setProducts}
                      tierAccent={config.accent}
                      tierAccentSoft={config.accentSoft}
                      salesHistory={salesHistory}
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
                      branchesList={branchesList}
                      isOwner={isOwner}
                    />
                  )}
                </>
              ) : (
                <BranchManagerOverview
                  products={products}
                  salesCount={salesCount}
                  salesRevenue={salesRevenue}
                  salesRevenueNote={salesRevenueNote}
                  branchesList={branchesList}
                  userSession={userSession}
                  userBranchId={userBranchId}
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
              branchesList={branchesList}
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
                    {products.length === 0 ? (
                      <div className="col-span-2 bg-white border border-slate-200 rounded-3xl p-8 text-center text-xs font-semibold text-slate-500">
                        📦 Add products in Inventory Operations to view category sales predictions and sparklines.
                      </div>
                    ) : (
                      [...products]
                        .sort((a, b) => (b.sold || 0) - (a.sold || 0))
                        .slice(0, 2)
                        .map((product) => {
                          const isLowStock = product.stock <= (product.reorderLevel || 10);
                          const hasSales = (product.sold || 0) > 0;
                          const forecast = hasSales ? Math.round(product.sold * 1.25) : 0;
                          const growth = hasSales
                            ? `+${Math.round(10 + ((product.sold || 0) % 15))}% Surge Peak`
                            : "No Sales Data";
                          const mlConfidence = hasSales
                            ? (90 + ((product.price || 0) % 9) * 0.8).toFixed(1)
                            : 0;
                          const gradId = `spark-grad-${product.id}`;

                          // Generate dynamic SVG sparkline coordinates
                          const pointsCount = 7;
                          const xStep = 500 / (pointsCount - 1);
                          
                          let yValues;
                          if (hasSales) {
                            const dailyAvg = (product.sold || 0) / 7;
                            const factors = [0.8, 1.1, 0.9, 1.2, 1.5, 1.8, 1.4];
                            const maxVal = dailyAvg * 1.8;
                            yValues = factors.map(f => {
                              const val = dailyAvg * f;
                              return 85 - (val / (maxVal || 1)) * 65;
                            });
                          } else {
                            yValues = [85, 85, 85, 85, 85, 85, 85];
                          }

                          const pathPoints = yValues.map((y, i) => `${i * xStep} ${y}`);
                          const strokeD = `M ${pathPoints.join(" L ")}`;
                          const fillD = `${strokeD} L 500 100 L 0 100 Z`;

                          return (
                            <div key={product.id} className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-left flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start gap-4 mb-4">
                                  <div>
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{product.category} Segment</span>
                                    <h4 className="text-base font-black text-slate-800 leading-tight">{product.name}</h4>
                                  </div>
                                  <span
                                    className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                      isLowStock ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                    }`}
                                  >
                                    {isLowStock ? "Needs Restock" : "Stable Supply"}
                                  </span>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-3 gap-2.5 mb-6">
                                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">Stock Level</span>
                                    <span className={`text-sm font-black block mt-0.5 ${isLowStock ? "text-rose-600" : "text-slate-800"}`}>
                                      {product.stock} Units
                                    </span>
                                    <span className={`text-[8.5px] font-semibold block ${isLowStock ? "text-rose-500" : "text-slate-500"}`}>
                                      {isLowStock ? `Below Reorder (${product.reorderLevel})` : `Healthy (min ${product.reorderLevel})`}
                                    </span>
                                  </div>
                                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">7D Forecast</span>
                                    <span className="text-sm font-black text-slate-800 block mt-0.5">{hasSales ? `${forecast} Units` : "—"}</span>
                                    <span className={`text-[8.5px] font-semibold block ${hasSales ? "text-emerald-600" : "text-slate-400"}`}>{growth}</span>
                                  </div>
                                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">ML Confidence</span>
                                    <span className="text-sm font-black block mt-0.5" style={{ color: hasSales ? config.accent : "#94a3b8" }}>
                                      {hasSales ? `${mlConfidence}%` : "—"}
                                    </span>
                                    <span className="text-[8.5px] font-semibold text-slate-500 block">{hasSales ? "High Certainty" : "Pending"}</span>
                                  </div>
                                </div>
                              </div>

                              {/* SVG Sparkline */}
                              <div className="relative pt-4 pb-2 border-t border-slate-100">
                                <svg className="w-full h-28 overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                                  <defs>
                                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={config.accent} stopOpacity={hasSales ? 0.25 : 0.05} />
                                      <stop offset="100%" stopColor={config.accent} stopOpacity="0.00" />
                                    </linearGradient>
                                  </defs>
                                  {/* Grid Lines */}
                                  <line x1="0" y1="15" x2="500" y2="15" stroke="#F1F5F9" strokeWidth="1" />
                                  <line x1="0" y1="50" x2="500" y2="50" stroke="#F1F5F9" strokeWidth="1" />
                                  <line x1="0" y1="85" x2="500" y2="85" stroke="#F1F5F9" strokeWidth="1" />
                                  
                                  {/* Gradient Fill under the curve */}
                                  <path d={fillD} fill={`url(#${gradId})`} />
                                  {/* Sparkline Stroke */}
                                  <path d={strokeD} fill="none" stroke={hasSales ? config.accent : "#cbd5e1"} strokeWidth="3" strokeDasharray={hasSales ? "none" : "4 4"} strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2.5 px-0.5">
                                  <span>Mon</span>
                                  <span>Tue</span>
                                  <span>Wed</span>
                                  <span>Thu</span>
                                  <span>Fri</span>
                                  <span>Sat</span>
                                  <span>Sun</span>
                                </div>
                              </div>

                              {/* Onboarding Glassmorphic Overlay */}
                              {!hasSales ? (
                                <div className="absolute inset-0 bg-white/75 backdrop-blur-[3px] rounded-3xl flex flex-col items-center justify-center text-center p-4 z-10 border border-slate-100/50">
                                  <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm text-sm mb-2">📈</div>
                                  <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Cannot Forecast Now</span>
                                  <p className="text-xs font-semibold text-slate-500 mt-2 max-w-[240px] leading-relaxed">
                                    Awaiting sales activity to calibrate predictive models. Record transactions in Billing POS to generate forecasts.
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                    )}
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
                            className={`px-2.5 py-1 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all cursor-pointer ${mediumRange === r ? 'bg-white text-slate-900 border border-slate-200 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800 font-bold'}`}
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
              {normalizedTier === "large" && (() => {
                const networkHasSales = products.some(p => (p.sold || 0) > 0);
                return (
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
                            { label: "Total Sales", value: salesCount > 0 ? String(salesCount) : "—", note: salesCount > 0 ? "transactions" : "No data", tone: salesCount > 0 ? "text-emerald-600" : "text-slate-400" },
                            { label: "Revenue", value: salesRevenue > 0 ? `₹${salesRevenue}` : "—", note: salesRevenue > 0 ? "current" : "No data", tone: salesRevenue > 0 ? "text-emerald-600" : "text-slate-400" },
                            { label: "Products", value: products.length > 0 ? String(products.length) : "—", note: products.length > 0 ? "active SKUs" : "No data", tone: products.length > 0 ? "text-emerald-600" : "text-slate-400" },
                            { label: "Branches", value: branchesList.length > 0 ? String(branchesList.length) : "—", note: branchesList.length > 0 ? "active" : "No data", tone: branchesList.length > 0 ? "text-sky-600" : "text-slate-400" },
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
                        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
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
                                <stop offset="0%" stopColor="#10B981" stopOpacity={networkHasSales ? 0.25 : 0.05} />
                                <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                              </linearGradient>
                              <linearGradient id="enterpriseRiskFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#F59E0B" stopOpacity={networkHasSales ? 0.18 : 0.02} />
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
                              stroke={networkHasSales ? "#10B981" : "#cbd5e1"}
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
                              stroke={networkHasSales ? "#F59E0B" : "#e2e8f0"}
                              strokeWidth="3"
                              strokeDasharray="10 8"
                              strokeLinecap="round"
                            />
                            {networkHasSales && (() => {
                              const b1 = branchesList[0]?.branch_name || "Primary Hub";
                              const b2 = branchesList[1]?.branch_name || "Secondary Hub";
                              return [
                                { x: 172, y: 164, label: `${b1} warning` },
                                { x: 472, y: 82, label: "Holiday demand lift" },
                                { x: 646, y: 108, label: `${b2} surplus` },
                              ].map((point) => (
                                <g key={point.label}>
                                  <circle cx={point.x} cy={point.y} r="7" fill="#fff" stroke="#10B981" strokeWidth="4" />
                                  <text x={point.x + 12} y={point.y - 10} fill="#475569" fontSize="11" fontWeight="800">{point.label}</text>
                                </g>
                              ));
                            })()}
                          </svg>
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-6 rounded-full bg-emerald-500" /> Demand forecast</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-6 rounded-full bg-amber-500" /> Inventory risk band</span>
                            <span>Planning horizon: 30 days</span>
                          </div>

                          {!networkHasSales ? (
                            <div className="absolute inset-0 bg-white/70 backdrop-blur-[3px] flex flex-col items-center justify-center text-center p-6 z-10 border border-slate-100/50">
                              <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm text-sm mb-2">📈</div>
                              <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Cannot Forecast Now</span>
                              <p className="text-xs font-semibold text-slate-500 mt-2 max-w-sm leading-relaxed">
                                Enterprise command neural charts and network demand forecasting will activate once sales are registered in POS.
                              </p>
                            </div>
                          ) : null}
                        </div>

                      <div className="space-y-3">
                        {branchesList.slice(0, 4).map((branch) => {
                          const branchName = branch.branch_name;
                          const branchProducts = products.filter(p => p.branchName === branchName);
                          const totalStock = branchProducts.reduce((sum, p) => sum + p.stock, 0);
                          const lowStock = branchProducts.filter(p => p.stock <= p.reorderLevel);
                          
                          let signal = "Optimal Health";
                          let value = "100% cover";
                          let action = "Keep monitoring";
                          let tone = "border-emerald-200 bg-emerald-50 text-emerald-700";

                          if (branchProducts.length === 0) {
                            signal = "No Catalog";
                            value = "0 units";
                            action = "Add products to branch";
                            tone = "border-slate-200 bg-slate-50 text-slate-700";
                          } else if (lowStock.length > 0) {
                            signal = "Understock Risk";
                            value = `${Math.round((lowStock.length / branchProducts.length) * 100)}% alert rate`;
                            action = `Restock ${lowStock.slice(0, 2).map(p => p.name).join(", ")}`;
                            tone = "border-rose-200 bg-rose-50 text-rose-700";
                          } else if (totalStock > 400) {
                            signal = "Overstock Alert";
                            value = "High capacity";
                            action = "Clear excess surplus";
                            tone = "border-amber-200 bg-amber-50 text-amber-700";
                          }

                          return (
                            <div key={branchName} className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Branch Risk Signal</span>
                                  <h4 className="text-base font-black text-slate-950 mt-1">{branchName}</h4>
                                </div>
                                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${tone}`}>{signal}</span>
                              </div>
                              <div className="mt-3.5 flex justify-between items-center text-xs font-semibold">
                                <div className="text-slate-500">{action}</div>
                                <div className="text-slate-900 font-black">{value}</div>
                              </div>
                            </div>
                          );
                        })}
                        {branchesList.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs font-semibold text-slate-500">
                            No branches configured. Setup branch networks in Branch Operations.
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">AI Decision Queue</span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">Recommended Enterprise Actions</h3>
                      {products.length > 0 ? (
                        <div className="mt-5 space-y-3">
                          {products.filter(p => p.stock <= p.reorderLevel).slice(0, 4).map((p, i) => (
                            <div key={p.id || i} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                              <span className="h-7 w-7 rounded-full bg-emerald-600 text-white text-xs font-black grid place-items-center shrink-0">{i + 1}</span>
                              <div>
                                <h4 className="text-sm font-black text-slate-950">Restock {p.name}</h4>
                                <p className="text-[11px] font-semibold text-slate-500 leading-relaxed mt-0.5">Current stock: {p.stock}, reorder level: {p.reorderLevel}. {p.category} category needs attention.</p>
                              </div>
                            </div>
                          ))}
                          {products.filter(p => p.stock <= p.reorderLevel).length === 0 && (
                            <p className="text-xs font-semibold text-slate-400 text-center py-4">All stock levels are healthy. No reorder actions needed.</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs font-semibold text-slate-400 text-center py-4">No inventory data available for recommendations.</p>
                      )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Category Exposure</span>
                      <h3 className="text-lg font-black text-slate-900 mt-1">Inventory, Margin & Expiry Analysis</h3>
                      {products.length > 0 ? (
                        <div className="mt-5 space-y-4">
                          {(() => {
                            const categories = {};
                            products.forEach(p => {
                              const cat = p.category || "Uncategorized";
                              if (!categories[cat]) categories[cat] = { totalStock: 0, count: 0 };
                              categories[cat].totalStock += p.stock;
                              categories[cat].count += 1;
                            });
                            const maxStock = Math.max(...Object.values(categories).map(c => c.totalStock), 1);
                            return Object.entries(categories).map(([label, data]) => {
                              const pct = Math.round((data.totalStock / maxStock) * 100);
                              return (
                                <div key={label}>
                                  <div className="flex justify-between items-end gap-3 mb-1.5">
                                    <div>
                                      <span className="text-sm font-black text-slate-900">{label}</span>
                                      <span className="ml-2 text-[10px] font-bold text-slate-400">{data.count} products</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-700">{data.totalStock} units</span>
                                  </div>
                                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#0EA5E9" }} />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      ) : (
                        <p className="text-xs font-semibold text-slate-400 text-center py-4">No inventory data for category analysis.</p>
                      )}
                    </div>
                  </section>
                  </div>
                );
              })()}
            </>
          )}

          {activeSection === "csv" && (
            <CSVUpload 
              onUploadComplete={handleCSVUploadComplete}
              tierAccent={config.accent}
              tierAccentSoft={config.accentSoft}
            />
          )}

          {activeSection === "tasks" && (
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 md:p-6 shadow-[0_14px_44px_rgba(15,23,42,0.06)] text-left">
              {/* Header */}
              <div className="absolute right-10 top-0 h-1.5 w-24 rounded-b-full" style={{ backgroundColor: config.accent }} />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Employee Workspace</span>
                  <h2 className="text-3xl font-black tracking-tight mt-1">My Duty Checklist</h2>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-2 max-w-xl">
                    {employeeEnvironment?.blurb || "Inspect your active branch assignments and check off completed duties."}
                  </p>
                  {userBranch && (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">
                      {employeeEnvironment?.icon} {userBranch.branch_name} · {userBranch.branch_type} · {tierDisplayName} tier
                    </p>
                  )}
                </div>
                <button
                  id="btn-refresh-tasks"
                  onClick={fetchEmployeeTasks}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-700 hover:border-slate-350 hover:text-slate-900 transition-all cursor-pointer flex items-center gap-2"
                >
                  <svg className={`w-3.5 h-3.5 ${loadingTasks ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Sync Tasks
                </button>
              </div>

              {employeeQuickActions.length > 0 && (
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {employeeQuickActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={action.onClick}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-left hover:border-slate-300 hover:bg-white hover:shadow-sm transition-all cursor-pointer group"
                    >
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl"
                        style={{ background: `${action.accent}18` }}
                      >
                        {action.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-900">{action.label}</span>
                        <span className="block text-[11px] font-semibold text-slate-500 mt-0.5">{action.description}</span>
                      </div>
                      <span className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0">→</span>
                    </button>
                  ))}
                </div>
              )}

              {loadingTasks ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-slate-800 animate-spin" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Retrieving assignments…</span>
                </div>
              ) : employeeTasks.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                  <div className="text-3xl mb-3">✨</div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">All Clear!</h4>
                  <p className="text-xs text-slate-400 font-semibold mt-1">No pending tasks or duties assigned for your role.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="flex flex-wrap gap-3 mb-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                      ⏳ {employeeTasks.filter((t) => t.status !== "completed").length} Pending
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      ✓ {employeeTasks.filter((t) => t.status === "completed").length} Completed
                    </span>
                  </div>
                  {employeeTasks.map((task) => {
                    const isCompleted = task.status === "completed";
                    const taskId = task._id || task.id;
                    const priorityColorMap = {
                      low: "bg-slate-50 text-slate-600 border-slate-200",
                      medium: "bg-amber-50 text-amber-700 border-amber-200",
                      high: "bg-rose-50 text-rose-700 border-rose-200"
                    };
                    const badgeClass = priorityColorMap[task.priority?.toLowerCase()] || priorityColorMap.medium;

                    return (
                      <div
                        key={taskId}
                        id={`task-card-${taskId}`}
                        className={`group relative overflow-hidden rounded-[20px] border p-4 transition-all duration-300 ${
                          isCompleted
                            ? "bg-slate-50/70 border-slate-100/80 opacity-70"
                            : "bg-white border-slate-200/80 hover:border-slate-350 hover:shadow-[0_8px_20px_rgba(0,0,0,0.02)]"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Custom Toggle Switch */}
                          <button
                            id={`task-toggle-${taskId}`}
                            onClick={() => handleToggleTaskStatus(taskId, task.status)}
                            className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${
                              isCompleted
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "bg-white border-slate-300 hover:border-slate-400 group-hover:scale-105"
                            }`}
                          >
                            {isCompleted && (
                              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </button>

                          {/* Task details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4
                                id={`task-title-${taskId}`}
                                className={`text-sm font-black leading-tight ${
                                  isCompleted ? "text-slate-400 line-through decoration-slate-300" : "text-slate-900"
                                }`}
                              >
                                {task.title}
                              </h4>
                              <span className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${badgeClass}`}>
                                {task.priority || "medium"}
                              </span>
                            </div>

                            {task.description && (
                              <p
                                id={`task-desc-${taskId}`}
                                className={`mt-1.5 text-xs font-semibold leading-relaxed ${
                                  isCompleted ? "text-slate-400 line-through decoration-slate-200" : "text-slate-500"
                                }`}
                              >
                                {task.description}
                              </p>
                            )}

                            {/* Meta information */}
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <span>
                                ⏰ Assigned: {new Date(task.created_at || Date.now()).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                              {isCompleted && task.completed_at && (
                                <span className="text-emerald-600 font-black">
                                  ✓ Done: {new Date(task.completed_at).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">{isOwner ? "SYSTEM OWNER" : getRoleDisplayName(userProfile?.role || userSession?.user?.role)}</span>
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
                      {isEmployee ? (
                        <>✨ {getRoleDisplayName(userProfile?.role || userSession?.user?.role)} at <strong>{userBranch?.branch_name || "your branch"}</strong>. You can complete assigned tasks and access {employeeEnvironment?.primaryTab === "billing" ? "POS checkout" : "inventory desk"} tools for your location.</>
                      ) : isManager ? (
                        <>✨ {getRoleDisplayName(userProfile?.role || userSession?.user?.role)}. You manage staff, assign tasks, and oversee operations for your assigned branch.</>
                      ) : (
                        <>✨ {config.profile.role}. You possess full operations permissions, ledger scopes, and forecasting triggers for your enterprise.</>
                      )}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Active Status</span>
                    </div>
                  </div>
                </div>

                {/* Live Platform Stats Panels */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Access Scope</span>
                    <div className="mt-2 text-base font-black text-slate-900 flex items-center gap-1.5">
                      🔑 <span style={{ color: config.accent }}>
                        {isEmployee
                          ? getEmployeeAccessLabel(employeeEnvironment, normalizedTier)
                          : isManager
                          ? "Branch Operations"
                          : "Full scope Access"}
                      </span>
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
                    <div className="mt-2 text-base font-black text-slate-900 flex items-center gap-1.5">
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
                    <span className="rounded-xl bg-slate-100 text-[10px] font-black px-3 py-1 uppercase tracking-wider text-slate-600">
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
                      {branchesList
                        .filter(b => b.status !== "Inactive")
                        .filter(b => isOwner || b.branch_id === userBranchId)
                        .map((branch) => {
                        const isExpanded = !!expandedBranches[branch._id || branch.branch_id];
                        return (
                          <div 
                            key={branch._id || branch.branch_id} 
                            onClick={() => setExpandedBranches((prev) => ({ ...prev, [branch._id || branch.branch_id]: !isExpanded }))}
                            className={`relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-sm flex flex-col justify-between p-5 cursor-pointer select-none group self-start ${
                              isExpanded 
                                ? "border-slate-800 bg-slate-50/90 ring-4 ring-slate-900/5 shadow-md" 
                                : "border-slate-200 bg-slate-50/40 hover:bg-slate-50/80 hover:border-slate-300 hover:shadow-md"
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
                                  <span className="px-2 py-0.5 rounded-md border border-slate-200 bg-slate-100 text-[9px] font-black uppercase text-slate-700 tracking-wider">
                                    {branch.branch_code || "CODE"}
                                  </span>
                                  <span className={`text-[10px] text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
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
                              <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-slate-100 text-left">
                                <div>
                                  <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Manager</span>
                                  <span className="block text-[10px] font-black text-slate-700 mt-0.5 truncate">{branch.manager_name}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400 text-right">Employees</span>
                                  <span className="block text-[10px] font-black text-slate-700 mt-0.5 text-right">{branch.employee_count} assigned</span>
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
                                    <span className="block text-[10.5px] font-bold text-slate-800 leading-relaxed mt-0.5">{branch.city}, {branch.state}, {branch.country} - {branch.pincode}</span>
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
                                  {branch.branch_type !== "Warehouse" && branch.gstin && (
                                    <div>
                                      <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400">GSTIN Identification</span>
                                      <span className="inline-block text-[9.5px] font-mono font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mt-0.5">{branch.gstin}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Premium Actions Row */}
                                {isOwner && (
                                  <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditBranch(branch);
                                      }}
                                      className="flex-1 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm text-center flex items-center justify-center gap-1.5"
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
                                )}
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
                {isOwner && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Action desk</span>
                        <h3 className="text-lg font-black text-slate-900 mt-0.5">Console Actions</h3>
                      </div>
                    </div>



                    {/* Growth console expand branch */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
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
                )}

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

                {/* ── Danger Zone Card ── */}
                {isOwner && (
                  <div className="bg-white border border-rose-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-400">Danger Zone</span>
                      <h3 className="text-base font-black text-slate-900 mt-0.5">Delete Account</h3>
                    </div>

                    <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                      <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                        Permanently remove your account, business profile, all branches, and associated inventory data from Inventra. <strong className="text-rose-700">This action cannot be undone.</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setDeleteConfirmEmail("");
                        setDeleteError("");
                        setShowDeleteAccountModal(true);
                      }}
                      className="w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] text-rose-600 border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer select-none"
                    >
                      🗑️ Delete My Account
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {editingProfile && (
            <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
              <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)] my-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Edit Profile</span>
                    <h3 className="text-xl font-black text-slate-950 mt-1">Update Executive Profile</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">Your role will remain <strong>{isOwner ? "OWNER" : getRoleDisplayName(userProfile?.role || userSession?.user?.role)}</strong>.</p>
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

                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Business Category</span>
                    <CustomDropdown
                      value={profileDraft.businessType || "other"}
                      onChange={(val) => setProfileDraft((p) => ({ ...p, businessType: val }))}
                      options={[
                        { value: "retail", label: "Retail" },
                        { value: "grocery", label: "Grocery" },
                        { value: "pharmacy", label: "Pharmacy" },
                        { value: "apparel", label: "Apparel" },
                        { value: "other", label: "Other" },
                      ]}
                      theme="emerald"
                      className="mt-1"
                      buttonClassName="font-bold"
                      up={true}
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

          {/* ── Delete Account Confirmation Modal ── */}
          {showDeleteAccountModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] overflow-hidden">
                {/* Red top bar */}
                <div className="h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />

                <div className="p-6">

                  {/* ── POST-DELETE: Choice Screen ── */}
                  {accountDeleted ? (
                    <>
                      <div className="text-center mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl mx-auto mb-4 shadow-sm">
                          🗂️
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-500">Account Deactivated</span>
                        <h3 className="text-xl font-black text-slate-950 mt-1 leading-tight">Your account is now deleted</h3>
                        <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed max-w-sm mx-auto">
                          Your data is safely preserved for <strong className="text-slate-700">30 days</strong>. What would you like to do?
                        </p>
                      </div>

                      {deleteError && (
                        <p className="text-rose-600 text-xs font-bold mb-4 text-center leading-snug">{deleteError}</p>
                      )}

                      {/* Option 1: Recover */}
                      <button
                        onClick={handleRecoverAccount}
                        disabled={recoveringAccount}
                        className="w-full mb-3 py-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-left px-5 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl shrink-0">🔄</span>
                          <div>
                            <span className="block text-sm font-black text-emerald-900">
                              {recoveringAccount ? "Restoring account…" : "Recover My Account"}
                            </span>
                            <span className="block text-xs font-semibold text-emerald-700 mt-0.5 leading-snug">
                              Restore everything — all data, branches, and staff access — instantly.
                            </span>
                          </div>
                          <span className="ml-auto text-emerald-600 font-black text-lg shrink-0">→</span>
                        </div>
                      </button>

                      {/* Option 2: Start Fresh */}
                      <button
                        onClick={() => {
                          setShowDeleteAccountModal(false);
                          setAccountDeleted(false);
                          setRecoveryToken("");
                          window.history.replaceState({}, "", "/");
                          setActiveTab("signup");
                        }}
                        className="w-full py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all text-left px-5 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl shrink-0">✨</span>
                          <div>
                            <span className="block text-sm font-black text-slate-900">Start a New Account</span>
                            <span className="block text-xs font-semibold text-slate-500 mt-0.5 leading-snug">
                              Begin fresh with a brand new profile and business setup.
                            </span>
                          </div>
                          <span className="ml-auto text-slate-400 font-black text-lg shrink-0">→</span>
                        </div>
                      </button>

                      <p className="text-center text-[10px] font-semibold text-slate-400 mt-4">
                        Recovery window closes in 30 days. After that, data is permanently purged.
                      </p>
                    </>
                  ) : (
                    <>
                      {/* ── CONFIRMATION SCREEN ── */}
                      {/* Icon + Title */}
                      <div className="flex items-start gap-4 mb-5">
                        <div className="h-12 w-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-xl shrink-0 shadow-sm">
                          🗑️
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">Danger Zone</span>
                          <h3 className="text-xl font-black text-slate-950 mt-0.5 leading-tight">Delete Account</h3>
                          <p className="text-xs font-semibold text-slate-500 mt-1.5 leading-relaxed">
                            Your account will be <strong className="text-slate-700">soft-deleted</strong> — data is kept for 30 days so you can recover it. Staff will be locked out but can re-register.
                          </p>
                        </div>
                      </div>

                      {/* Warning checklist */}
                      <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 space-y-2 mb-5">
                        {[
                          "You will be immediately logged out",
                          "Staff accounts will be locked (can re-register freely)",
                          "All data preserved for 30-day recovery window",
                          "After 30 days, data is permanently purged",
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-2 text-xs font-semibold text-rose-700">
                            <span className="mt-0.5 shrink-0">⚠</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>

                      {/* Email confirmation input */}
                      <label className="block mb-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
                          Type your email to confirm
                        </span>
                        <input
                          type="email"
                          value={deleteConfirmEmail}
                          onChange={(e) => {
                            setDeleteConfirmEmail(e.target.value);
                            setDeleteError("");
                          }}
                          placeholder={userProfile?.email || userSession?.user?.email || "your@email.com"}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-rose-400 focus:bg-white transition-all"
                          autoFocus
                        />
                        {deleteError && (
                          <p className="text-rose-600 text-xs font-bold mt-2 leading-snug">{deleteError}</p>
                        )}
                      </label>

                      {/* Action buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deletingAccount || !deleteConfirmEmail.trim()}
                          className="flex-1 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-[0.18em] transition-all shadow-[0_8px_20px_rgba(225,29,72,0.28)] cursor-pointer select-none"
                        >
                          {deletingAccount ? "Processing…" : "Delete Account"}
                        </button>
                        <button
                          onClick={() => setShowDeleteAccountModal(false)}
                          disabled={deletingAccount}
                          className="rounded-xl bg-slate-100 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-all cursor-pointer select-none"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {showAddBranchModal && (() => {
            const inp = (field) =>
              `w-full border ${
                modalErrors[field] ? "border-rose-500 bg-rose-50/40" : "border-slate-200 bg-slate-50/50"
              } text-slate-900 placeholder:text-slate-400 px-3 py-1.5 rounded-lg font-bold text-sm outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-500 focus:bg-white transition-all`;

            const ErrMsg = ({ field }) =>
              modalErrors[field] ? <p className="text-rose-600 text-xs font-bold mt-1.5 leading-none">{modalErrors[field]}</p> : null;

            const Label = ({ children }) => (
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-0.5">
                {children}
              </label>
            );

            const filteredStates = INDIAN_STATES.filter((stateName) =>
              stateName.toLowerCase().includes(modalDropdownSearch.toLowerCase())
            );

            const STEPS = ["Branch", "Location", "Contact", "Review"];

            const setModalFormField = (field, value) => {
              setModalForm((prev) => ({ ...prev, [field]: value }));
              setModalErrors((prev) => {
                const next = { ...prev };
                if (Object.prototype.hasOwnProperty.call(next, field)) {
                  delete next[field];
                }
                if (field === "phone_number" && Object.prototype.hasOwnProperty.call(next, "phone")) {
                  delete next.phone;
                }
                return next;
              });
            };

            const validateModalStep = (step) => {
              const errors = {};
              const currentLabels = getDynamicLabels(modalForm.branch_type);

              if (step === 1) {
                if (!modalForm.branch_name.trim()) errors.branch_name = `${currentLabels.nameLabel} is required.`;
                if (!modalForm.branch_code.trim()) errors.branch_code = `${currentLabels.codeLabel} is required.`;
                if (!modalForm.branch_type?.trim()) errors.branch_type = "Branch type is required.";
              }

              if (step === 2) {
                if (!modalForm.address.trim()) errors.address = `${currentLabels.addressLabel} is required.`;
                if (!modalForm.city.trim()) errors.city = `${currentLabels.cityLabel} is required.`;
                if (!modalForm.state.trim()) errors.state = "State is required.";
                if (!modalForm.country.trim()) errors.country = "Country is required.";
                if (!modalForm.pincode.trim()) errors.pincode = `${currentLabels.pincodeLabel} is required.`;
              }

              if (step === 3) {
                if (!modalForm.manager_name.trim()) errors.manager_name = `${currentLabels.managerLabel} is required.`;
                if (!modalForm.phone_number.trim()) {
                  errors.phone = `${currentLabels.phoneLabel} is required.`;
                } else if (modalForm.phone_number.replace(/\D/g, "").length < 7) {
                  errors.phone = `Enter a valid ${currentLabels.phoneLabel.toLowerCase()}.`;
                }
                if (!modalForm.manager_email.trim()) {
                  errors.manager_email = `${currentLabels.emailLabel} is required.`;
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modalForm.manager_email.trim())) {
                  errors.manager_email = "Enter a valid email address.";
                }
              }

              setModalErrors(errors);
              return Object.keys(errors).length === 0;
            };

            const validateAllModalSteps = () => {
              const errors = {};
              const currentLabels = getDynamicLabels(modalForm.branch_type);

              if (!modalForm.branch_name.trim()) errors.branch_name = `${currentLabels.nameLabel} is required.`;
              if (!modalForm.branch_code.trim()) errors.branch_code = `${currentLabels.codeLabel} is required.`;
              if (!modalForm.branch_type?.trim()) errors.branch_type = "Branch type is required.";
              if (!modalForm.address.trim()) errors.address = `${currentLabels.addressLabel} is required.`;
              if (!modalForm.city.trim()) errors.city = `${currentLabels.cityLabel} is required.`;
              if (!modalForm.state.trim()) errors.state = "State is required.";
              if (!modalForm.country.trim()) errors.country = "Country is required.";
              if (!modalForm.pincode.trim()) errors.pincode = `${currentLabels.pincodeLabel} is required.`;
              if (!modalForm.manager_name.trim()) errors.manager_name = `${currentLabels.managerLabel} is required.`;

              if (!modalForm.phone_number.trim()) {
                errors.phone = `${currentLabels.phoneLabel} is required.`;
              } else if (modalForm.phone_number.replace(/\D/g, "").length < 7) {
                errors.phone = `Enter a valid ${currentLabels.phoneLabel.toLowerCase()}.`;
              }
              if (!modalForm.manager_email.trim()) {
                errors.manager_email = `${currentLabels.emailLabel} is required.`;
              } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modalForm.manager_email.trim())) {
                errors.manager_email = "Enter a valid email address.";
              }

              setModalErrors(errors);
              return Object.keys(errors).length === 0;
            };

            const goBackModalStep = () => {
              setModalStep((prev) => Math.max(1, prev - 1));
            };

            const goNextModalStep = () => {
              if (!validateModalStep(modalStep)) return;
              setModalStep((prev) => Math.min(4, prev + 1));
            };

            const handleAddBranch = async () => {
              if (!validateAllModalSteps()) return;
              await handleSaveBranch();
            };

            const labels = getDynamicLabels(modalForm.branch_type);

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] flex flex-col relative overflow-hidden max-h-[90vh]">
                  {/* Decorative top colored line */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900" />
                  
                  {/* Modal Header */}
                  <div className="px-6 pt-4 pb-2 flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/40">
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
                  <div className="px-6 py-2 border-b border-slate-200 bg-slate-50/60">
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
                  <div className="p-4 overflow-y-auto flex-1 min-h-0">
                    {/* ── Step 1: Branch Basics ── */}
                    {modalStep === 1 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Branch Identity</h4>
                          <span className="text-[9px] font-bold text-slate-400">* Required fields</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-5 flex flex-col gap-2">
                            <div>
                              <Label>{labels.nameLabel} <span className="text-rose-500 font-black">*</span></Label>
                              <input
                                type="text"
                                placeholder={labels.namePlaceholder}
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
                              <Label>{labels.codeLabel} <span className="text-rose-500 font-black">*</span></Label>
                              <input
                                type="text"
                                placeholder={labels.codePlaceholder}
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
                                      className={`p-2.5 rounded-2xl border-2 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center ${
                                        isSelected
                                          ? "border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-950/10"
                                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      <span className="text-xl mb-0.5 leading-none">{t.icon}</span>
                                      <span className="text-[11px] font-black tracking-tight">{t.value}</span>
                                      <span className={`text-[9px] font-semibold mt-0.5 leading-none ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
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
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Location Parameters</h4>
                          <span className="text-[9px] font-bold text-slate-400">* Required fields</span>
                        </div>

                        <div className="grid grid-cols-12 gap-2">
                          {/* Line 1: Address (Full width) */}
                          <div className="col-span-12">
                            <Label>{labels.addressLabel} <span className="text-rose-500 font-black">*</span></Label>
                            <input
                              type="text"
                              placeholder={labels.addressPlaceholder}
                              value={modalForm.address}
                              onChange={(e) => setModalFormField("address", e.target.value)}
                              className={inp("address")}
                            />
                            <ErrMsg field="address" />
                          </div>

                          {/* Line 2: City & State side-by-side */}
                          <div className="col-span-12 sm:col-span-6">
                            <Label>{labels.cityLabel} <span className="text-rose-500 font-black">*</span></Label>
                            <input
                              type="text"
                              placeholder={labels.cityPlaceholder}
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
                              <svg className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${modalDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
                              <svg className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${modalCountryDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
                            <Label>{labels.pincodeLabel} <span className="text-rose-500 font-black">*</span></Label>
                            <input type="text" placeholder={labels.pincodePlaceholder} value={modalForm.pincode} onChange={(e) => setModalFormField("pincode", e.target.value)} className={inp("pincode")} maxLength={10} />
                            <ErrMsg field="pincode" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Step 3: Contact & Operations ── */}
                    {modalStep === 3 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Contact & Shifts</h4>
                          <span className="text-[9px] font-bold text-slate-400">* Required fields</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-6 flex flex-col gap-2">
                            <div>
                              <Label>{labels.managerLabel} <span className="text-rose-500 font-black">*</span></Label>
                              <input type="text" placeholder={labels.placeholderName} value={modalForm.manager_name} onChange={(e) => setModalFormField("manager_name", e.target.value)} className={inp("manager_name")} />
                              <ErrMsg field="manager_name" />
                            </div>
                            <div className="relative custom-phone-prefix-container">
                              <Label>{labels.phoneLabel} <span className="text-rose-500 font-black">*</span></Label>
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
                                  placeholder={labels.phonePlaceholder}
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
                              <Label>{labels.emailLabel} <span className="text-rose-500 font-black">*</span></Label>
                              <input type="email" placeholder={labels.emailPlaceholder} value={modalForm.manager_email} onChange={(e) => setModalFormField("manager_email", e.target.value)} className={inp("manager_email")} />
                              <ErrMsg field="manager_email" />
                            </div>
                            {modalForm.branch_type !== "Warehouse" && (
                              <div>
                                <Label>{labels.gstLabel}</Label>
                                <input type="text" placeholder={labels.gstPlaceholder} value={modalForm.gstin} onChange={(e) => setModalFormField("gstin", e.target.value.toUpperCase())} className={inp("gstin") + " font-mono uppercase tracking-wider text-sm"} maxLength={15} />
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-6 flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label>{labels.staffLabel}</Label>
                                <input type="number" min={0} value={modalForm.employee_count} onChange={(e) => setModalFormField("employee_count", e.target.value)} className={inp("employee_count")} />
                              </div>
                              <div>
                                <Label>{labels.openingDateLabel}</Label>
                                <input type="date" value={modalForm.opening_date} onChange={(e) => setModalFormField("opening_date", e.target.value)} className={inp("opening_date") + " cursor-pointer"} />
                              </div>
                            </div>


                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <Label>{labels.hoursLabel}</Label>
                              </div>
                              <input type="text" placeholder={labels.placeholderHours} value={modalForm.working_hours} onChange={(e) => setModalFormField("working_hours", e.target.value)} className={inp("working_hours")} />
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
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{labels.verificationHeader}</h4>
                          <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Ready to launch</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-950 rounded-2xl p-4 shadow-xl border border-slate-900 text-[13px] leading-tight text-white text-left">
                          <div className="space-y-3 md:border-r md:border-slate-800 md:pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
                                {BRANCH_TYPES.find((t) => t.value === modalForm.branch_type)?.icon || "🏪"}
                              </div>
                              <div>
                                <h5 className="text-white font-black text-sm leading-none">{modalForm.branch_name || `New ${labels.titleLabel}`}</h5>
                                <span className="text-emerald-400 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mt-1">{modalForm.branch_code || "CODE"}</span>
                              </div>
                            </div>
                            <div className="pt-1">
                              <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.addressSectionLabel}</span>
                              <span className="text-slate-300 text-xs font-semibold leading-relaxed block">{modalForm.address}</span>
                              <span className="text-white text-xs font-bold block mt-1">{modalForm.city}, {modalForm.state}, {modalForm.country} – {modalForm.pincode}</span>
                            </div>
                          </div>

                          <div className="space-y-3 md:border-r md:border-slate-800 md:px-4">
                            <div>
                              <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.managerSectionLabel}</span>
                              <span className="text-white text-sm font-bold block">{modalForm.manager_name}</span>
                              <span className="text-slate-400 text-xs font-semibold block mt-0.5">{modalForm.phone}</span>
                              {modalForm.manager_email && (
                                <span className="text-slate-400 text-xs font-semibold block mt-0.5">{modalForm.manager_email}</span>
                              )}
                            </div>
                            {modalForm.branch_type !== "Warehouse" && modalForm.gstin && (
                              <div>
                                <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.gstSectionLabel}</span>
                                <span className="text-emerald-400 font-mono text-[10px] font-black uppercase tracking-widest">{modalForm.gstin}</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 md:pl-4">
                            <div>
                              <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.hoursSectionLabel}</span>
                              <span className="text-white text-sm font-bold block">{modalForm.working_hours}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block mb-1">{labels.teamSectionLabel}</span>
                              <span className="text-white text-xs font-bold block">{modalForm.employee_count} Additional Staff Member{modalForm.employee_count !== 1 ? "s" : ""}</span>
                              {modalForm.opening_date && (
                                <span className="text-slate-400 text-[10px] font-semibold block mt-0.5">{labels.openingDateLabel}: {modalForm.opening_date}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer Controls */}
                  <div className="px-6 py-2 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-3">
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

function BranchManagerOverview({ products, salesCount, salesRevenue, salesRevenueNote, branchesList, userSession, userBranchId }) {
  const [staffCount, setStaffCount] = React.useState(0);
  const branch = branchesList?.[0];

  React.useEffect(() => {
    getEmployees()
      .then(emps => {
        if (Array.isArray(emps)) {
          setStaffCount(emps.length);
        }
      })
      .catch(() => {});
  }, []);

  const lowStockCount = products.filter(p => p.stock <= (p.reorderLevel || 10)).length;
  const totalUnits = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const totalItems = products.length;

  const statCards = [
    { label: "Total Items", value: totalItems, icon: "📦", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { label: "Units in Stock", value: totalUnits, icon: "📊", color: "bg-blue-50 border-blue-200 text-blue-700" },
    { label: "Low Stock", value: lowStockCount, icon: "⚠️", color: lowStockCount > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { label: "Staff Count", value: staffCount, icon: "👥", color: "bg-violet-50 border-violet-200 text-violet-700" },
    { label: "Sales", value: salesCount, icon: "🧾", color: "bg-sky-50 border-sky-200 text-sky-700" },
    { label: "Revenue", value: `₹${(salesRevenue || 0).toLocaleString("en-IN")}`, icon: "💰", color: "bg-amber-50 border-amber-200 text-amber-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-5 md:p-6 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
          {branch?.branch_code || "Branch"}
        </span>
        <h3 className="text-lg md:text-xl font-black text-slate-900 mt-1">
          {branch?.branch_name || "My Branch"}
        </h3>
        <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
          {branch?.branch_type || "Store"} · {branch?.address || ""}
          {salesRevenueNote ? ` · ${salesRevenueNote}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-4 ${card.color}`}>
            <span className="text-lg">{card.icon}</span>
            <div className="mt-2 text-2xl font-black">{card.value}</div>
            <div className="text-[10px] font-black uppercase tracking-wider mt-1 opacity-80">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useMemo, useEffect } from "react";
import {
  getBillingPosTab,
  getDashboardTab,
  getTierBadgeLabel,
  getTierDisplayName,
  getUserDisplayName,
  normalizeBusinessTier,
} from "../utils/dashboard";
import InventoryTable from "../components/InventoryTable";
import CSVUpload from "../components/CSVUpload";
import SmallDashboard from "../components/SmallDashboard";
import MediumDashboard from "../components/MediumDashboard";
import LargeDashboard from "../components/LargeDashboard";

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
    shell: "#059669",
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

  // Global Products State seeded with high-fidelity items
  const [products, setProducts] = useState([
    { id: 1, name: "Fresh Bread 400g", category: "Bakery", stock: 8, price: 40, sold: 120, expiryDate: "2026-05-24", reorderLevel: 15 },
    { id: 2, name: "Organic Milk 1L", category: "Dairy", stock: 12, price: 60, sold: 240, expiryDate: "2026-05-23", reorderLevel: 20 },
    { id: 3, name: "Coke 500ml", category: "Beverages", stock: 85, price: 40, sold: 310, expiryDate: "2026-11-12", reorderLevel: 10 },
    { id: 4, name: "Potato Chips 150g", category: "Snacks", stock: 4, price: 20, sold: 480, expiryDate: "2026-09-08", reorderLevel: 25 },
    { id: 5, name: "Amul Butter 500g", category: "Dairy", stock: 32, price: 250, sold: 85, expiryDate: "2026-06-15", reorderLevel: 12 },
    { id: 6, name: "Dark Chocolate 100g", category: "Snacks", stock: 55, price: 80, sold: 150, expiryDate: "2026-10-30", reorderLevel: 15 },
  ]);

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

  const userDisplayName = getUserDisplayName(userSession?.user, "Manager");

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
          <section className="bg-white border border-slate-200 p-5 md:p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left relative overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
            {/* Glowing spot */}
            <div className="absolute w-48 h-48 rounded-full pointer-events-none -right-10 blur-[80px]" style={{ background: config.accentSoft }} />

            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Retail Intelligence Node</span>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1 leading-tight tracking-tight">{config.strap}</h1>
              <p className="text-xs text-slate-500 font-semibold mt-1 max-w-xl leading-relaxed">{config.blurb}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: config.accent }} />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 font-mono">
                TIER: {tierDisplayName}
              </span>
            </div>
          </section>

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
                />
              )}
            </>
          )}

          {activeSection === "inventory" && (
            <InventoryTable 
              products={products} 
              onUpdateProducts={setProducts}
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
                    <h3 className="text-lg font-black text-slate-900 mb-1">Seasonal & Profit Analytics</h3>
                    <p className="text-xs text-slate-500 font-semibold mb-6">Dual path Area forecasts with seasonal peaks.</p>
                    <div className="h-56 flex items-center justify-center border border-slate-250 rounded-2xl bg-slate-50 text-slate-400 text-xs font-semibold">
                      Navigate to the Overview Hub to see the active Holiday-Aware Dual-Path forecast.
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                    <h3 className="text-lg font-black text-slate-900 mb-1">Segment Sales Share</h3>
                    <p className="text-xs text-slate-500 font-semibold mb-6">Category Sales donut segments indicators.</p>
                    <div className="h-56 flex items-center justify-center border border-slate-250 rounded-2xl bg-slate-50 text-slate-400 text-xs font-semibold">
                      Category Ring charts are displayed on the active Overview panel.
                    </div>
                  </div>
                </div>
              )}
              {normalizedTier === "large" && (
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 text-left">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                    <h3 className="text-lg font-black text-slate-900 mb-1">NLP AI Chat Insights</h3>
                    <p className="text-xs text-slate-500 font-semibold mb-6">Ask AI co-pilot about allocations.</p>
                    <div className="h-56 flex items-center justify-center border border-slate-250 rounded-2xl bg-slate-50 text-slate-400 text-xs font-semibold">
                      Chat terminal with interactive suggested prompts is active on the Overview Hub.
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
                    <h3 className="text-lg font-black text-slate-900 mb-1">Regional Heatmap</h3>
                    <p className="text-xs text-slate-500 font-semibold mb-6">Geographical branch maps.</p>
                    <div className="h-56 flex items-center justify-center border border-slate-250 rounded-2xl bg-slate-50 text-slate-400 text-xs font-semibold">
                      India branch regional heatmaps are active on the Overview command desk.
                    </div>
                  </div>
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
            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-6 text-left">
              <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
                <div className="rounded-3xl border border-slate-200/70 bg-[linear-gradient(120deg,#f8fafc_0%,#f1f5f9_100%)] p-4 md:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl text-white text-sm font-black grid place-items-center shadow-[0_8px_20px_rgba(15,23,42,0.18)]" style={{ background: config.accent }}>
                        {String(userDisplayName || "M").trim().charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Executive Identity</span>
                        <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-1 leading-tight">{userDisplayName}</h3>
                      </div>
                    </div>
                    <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ borderColor: `${config.accent}66`, color: config.accent, background: `${config.accent}14` }}>
                      {tierDisplayName}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 font-semibold leading-relaxed">{config.profile.role}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Access Tier</div>
                    <div className="mt-1 text-sm font-black" style={{ color: config.accent }}>{tierDisplayName}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Session</div>
                    <div className="mt-1 text-sm font-black text-emerald-600">Active</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Security</div>
                    <div className="mt-1 text-sm font-black text-slate-900">JWT Secured</div>
                  </div>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="font-semibold text-slate-500">Logged In As</span>
                    <span className="text-slate-900 font-black">{userDisplayName}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="font-semibold text-slate-500">Assigned Role</span>
                    <span className="text-slate-900 font-black">{config.profile.role}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="font-semibold text-slate-500">Platform Tier</span>
                    <span className="font-black" style={{ color: config.accent }}>{tierDisplayName}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="font-semibold text-slate-500">Authentication</span>
                    <span className="font-black" style={{ color: config.accent }}>ACTIVE SESSION (JWT SECURE)</span>
                  </div>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Action Console</span>
                  <h3 className="text-lg md:text-xl font-black text-slate-900 mt-1">Operational Next Actions</h3>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="text-xs text-slate-600 font-semibold leading-relaxed">{config.profile.nextStep}</p>
                  <div className="space-y-2 text-[11px] font-bold text-slate-600">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: config.accent }} />
                      <span>Review live alert stream before shift handover.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: config.accent }} />
                      <span>Approve pending inventory updates and billing queue.</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full py-3.5 rounded-xl font-bold uppercase text-xs tracking-[0.18em] text-white transition-all shadow-[0_10px_25px_rgba(15,23,42,0.16)] hover:opacity-95 cursor-pointer"
                  style={{ background: "linear-gradient(90deg,#0f172a 0%,#1e293b 100%)" }}
                >
                  End Active Session (Logout)
                </button>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
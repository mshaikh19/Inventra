import React, { useState, useMemo, useEffect } from "react";
import { getDashboardTab, normalizeBusinessTier } from "../utils/dashboard";
import InventoryTable from "../components/InventoryTable";
import BillingSystem from "../components/BillingSystem";
import CSVUpload from "../components/CSVUpload";
import SmallDashboard from "../components/SmallDashboard";
import MediumDashboard from "../components/MediumDashboard";
import LargeDashboard from "../components/LargeDashboard";

const DASHBOARD_CONFIG = {
  small: {
    label: "Small Business Dashboard",
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
    label: "Medium Business Dashboard",
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
    label: "Large Business Dashboard",
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

export default function Dashboard({ tier = "small", setActiveTab }) {
  const normalizedTier = normalizeBusinessTier(tier);
  const config = DASHBOARD_CONFIG[normalizedTier];

  const [activeSection, setActiveSection] = useState("overview");
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

  const tierFeatures = TIER_FEATURES[normalizedTier];

  const handleLogout = () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem("inventra_token");
      storage.removeItem("inventra_user");
    }
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
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
      className="min-h-screen w-full bg-[#F8FAFC] text-slate-900 flex flex-col font-sans relative"
      style={{
        backgroundImage: `radial-gradient(circle at 80% 20%, ${config.accentSoft}, transparent 45%), radial-gradient(circle at 10% 80%, rgba(241, 245, 249, 0.6), transparent 50%)`,
      }}
    >
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-xl px-4 sm:px-6 lg:px-10 py-3.5 flex justify-between items-center shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
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
            className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:border-slate-350 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <span
              className="h-6 w-6 rounded-lg text-[10px] font-black flex items-center justify-center bg-slate-100"
              style={{ color: config.accent }}
            >
              {config.profile.role[0]}
            </span>
            <span className="hidden sm:inline">{userSession?.user?.email || "Manager"}</span>
          </button>
        </div>
      </header>

      {/* Main Grid Workspace Layout */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 grid lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Left Control Panel / Sidebar */}
        <aside className="hidden lg:flex sticky top-24 flex-col bg-white border border-slate-200 rounded-3xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] h-[80vh] overflow-y-auto justify-between select-none">
          <div className="space-y-6">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Business Control</span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5 leading-tight">{config.label}</h2>
              <span className="inline-block mt-2 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white" style={{ background: config.shell }}>
                {normalizedTier.toUpperCase()}
              </span>
            </div>

            {/* Sidebar Navigation */}
            <nav className="space-y-1.5">
              {WORKSPACE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSection(tab.key)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                    activeSection === tab.key
                      ? "bg-slate-900 text-white font-black shadow-sm"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            {/* Displaying features list representing the tier limits */}
            <details className="group" open>
              <summary className="text-[9px] font-black uppercase tracking-widest text-slate-450 cursor-pointer list-none flex justify-between items-center hover:text-slate-950 transition-colors">
                <span>TIER SPECIFIC PLUGINS</span>
                <span className="text-[8px] transition-transform duration-300 group-open:rotate-180">▼</span>
              </summary>
              <div className="mt-3.5 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {tierFeatures.map((f, i) => (
                  <div key={i} className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-150 text-[10.5px] font-semibold text-slate-600">
                    {f}
                  </div>
                ))}
              </div>
            </details>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile menu navigation buttons (Hidden on Desktop) */}
        <div className="lg:hidden w-full flex justify-between items-center gap-3">
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
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left text-sm font-bold border ${
                    activeSection === tab.key
                      ? "bg-slate-900 text-white border-slate-900 font-black"
                      : "text-slate-600 border-slate-200 bg-slate-50"
                  }`}
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
        <main className="min-w-0 space-y-6">
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
                TIER: {normalizedTier.toUpperCase()}
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

          {activeSection === "billing" && (
            <BillingSystem 
              products={products} 
              onRecordSale={handleRecordSale}
              tierAccent={config.accent}
              tierAccentSoft={config.accentSoft}
            />
          )}

          {activeSection === "analytics" && (
            <>
              {normalizedTier === "small" && (
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] text-left">
                    <h3 className="text-lg font-black text-slate-900 mb-2">Basic Demand Forecasting</h3>
                    <p className="text-xs text-slate-500 font-semibold mb-6">Simple line graphs simulating upcoming weekly demands for basic bakery and dairy stocks.</p>
                    <div className="h-48 flex items-center justify-center border border-slate-250 rounded-2xl bg-slate-50 text-slate-400 text-xs font-semibold">
                      Select Bakery or Dairy in the Overview Hub to view sparkline trends.
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
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Account Credentials</span>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-1">Executive Profile Area</h3>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 font-semibold text-xs text-slate-650">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Logged In As</span>
                    <span className="text-slate-900 font-black">{userSession?.user?.email || "Executive Manager"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Assigned Business Role</span>
                    <span className="text-slate-900 font-black">{config.profile.role}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>Platform Access Tier</span>
                    <span className="text-slate-900 font-black uppercase" style={{ color: config.accent }}>{normalizedTier}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Authentication Status</span>
                    <span className="text-slate-900 font-black uppercase" style={{ color: config.accent }}>ACTIVE SESSION (JWT SECURE)</span>
                  </div>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Setup Guidelines</span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">Next Actions</h3>
                </div>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">{config.profile.nextStep}</p>
                <button
                  onClick={handleLogout}
                  className="w-full py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-md cursor-pointer"
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
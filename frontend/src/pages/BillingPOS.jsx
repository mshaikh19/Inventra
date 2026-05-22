import React from "react";
import BillingSystem from "../components/BillingSystem";
import {
  getDashboardTierFromUser,
  getTierBadgeLabel,
  getTierDisplayName,
  getUserDisplayName,
  normalizeBusinessTier,
} from "../utils/dashboard";

export default function BillingPOS({ tier = "small", setActiveTab }) {
  const normalizedTier = normalizeBusinessTier(tier);

  const userSession = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    for (const storage of [localStorage, sessionStorage]) {
      const token = storage.getItem("inventra_token");
      const rawUser = storage.getItem("inventra_user");
      if (token && rawUser) {
        try { return { token, user: JSON.parse(rawUser) }; }
        catch { return { token, user: null }; }
      }
    }
    return null;
  }, []);

  const userDisplayName  = getUserDisplayName(userSession?.user, "Cashier");
  const tierBadgeLabel   = getTierBadgeLabel(normalizedTier);

  const tierAccent     = normalizedTier === "medium" ? "#D97706" : normalizedTier === "large" ? "#059669" : "#0284C7";
  const tierAccentSoft = normalizedTier === "medium" ? "rgba(217,119,6,0.1)" : normalizedTier === "large" ? "rgba(5,150,105,0.1)" : "rgba(2,132,199,0.1)";

  const handleBack = () => {
    const fallbackTier = normalizeBusinessTier(getDashboardTierFromUser(userSession?.user) || normalizedTier);
    setActiveTab(`dashboard-${fallbackTier}`);
  };

  const [products, setProducts] = React.useState([
    { id: 1, name: "Fresh Bread 400g",    category: "Bakery",    stock: 8,  price: 40,  sold: 120, expiryDate: "2026-05-24", reorderLevel: 15, barcode: "8901234567890" },
    { id: 2, name: "Organic Milk 1L",     category: "Dairy",     stock: 12, price: 60,  sold: 240, expiryDate: "2026-05-23", reorderLevel: 20, barcode: "8901234567891" },
    { id: 3, name: "Coke 500ml",          category: "Beverages", stock: 85, price: 40,  sold: 310, expiryDate: "2026-11-12", reorderLevel: 10, barcode: "8901234567892" },
    { id: 4, name: "Potato Chips 150g",   category: "Snacks",    stock: 4,  price: 20,  sold: 480, expiryDate: "2026-09-08", reorderLevel: 25, barcode: "8901234567893" },
    { id: 5, name: "Amul Butter 500g",    category: "Dairy",     stock: 32, price: 250, sold: 85,  expiryDate: "2026-06-15", reorderLevel: 12, barcode: "8901234567894" },
    { id: 6, name: "Dark Chocolate 100g", category: "Snacks",    stock: 55, price: 80,  sold: 150, expiryDate: "2026-10-30", reorderLevel: 15, barcode: "8901234567895" },
  ]);

  const handleRecordSale = (cartItems, totalPaid) => {
    setProducts((curr) =>
      curr.map((product) => {
        const cartItem = cartItems.find((i) => i.id === product.id);
        if (!cartItem) return product;
        return { ...product, stock: Math.max(0, product.stock - cartItem.quantity), sold: (product.sold || 0) + cartItem.quantity };
      })
    );
    void totalPaid;
  };

  return (
    /* Full-screen dark terminal shell */
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#0C1120" }}>

      {/* ── Dark POS header bar ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0F172A" }}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors duration-150"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-[0.18em]">Dashboard</span>
          </button>

          <div className="w-px h-5" style={{ background: "rgba(255,255,255,0.08)" }} />

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: tierAccent + "22", border: `1px solid ${tierAccent}30` }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke={tierAccent} strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3h-.75m0 0v16.5A2.25 2.25 0 0 0 5.25 21.75h13.5A2.25 2.25 0 0 0 21 19.5V3m-17.25 0h17.25M3 9h18M9 3v18m6-18v18" />
              </svg>
            </div>
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.22em] text-slate-500 leading-none">POS Terminal</div>
              <div className="text-sm font-black text-white leading-none mt-0.5">Product Counter</div>
            </div>
          </div>

          <div className="hidden lg:block w-px h-5" style={{ background: "rgba(255,255,255,0.08)" }} />

          <span className="hidden lg:inline text-[10px] font-semibold text-slate-400 tracking-wider">
            Search, filter, or tap items to add instantly
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{userDisplayName}</div>
          <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.08)" }} />
          <span
            className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white"
            style={{ background: tierAccent }}
          >
            {tierBadgeLabel}
          </span>
          <div className="text-[10px] font-bold text-slate-500">
            {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        </div>
      </header>

      {/* ── Billing system fills remaining space — no container, no padding ── */}
      <main className="flex-1 flex overflow-hidden">
        <BillingSystem
          products={products}
          onRecordSale={handleRecordSale}
          tierAccent={tierAccent}
          tierAccentSoft={tierAccentSoft}
        />
      </main>
    </div>
  );
}

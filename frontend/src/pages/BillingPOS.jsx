import React from "react";
import BillingSystem from "../components/BillingSystem";
import BranchDropdown from "../components/BranchDropdown";
import {
  getDashboardTierFromUser,
  getTierBadgeLabel,
  getTierDisplayName,
  getUserDisplayName,
  normalizeBusinessTier,
} from "../utils/dashboard";
import { getBranchNetwork, getBranchInventory, getUserBranches } from "../utils/branches";
import {
  INVENTORY_PRODUCT_SEED,
  hydrateInventoryProducts,
  loadScopedInventoryProducts,
  saveScopedInventoryProducts,
} from "../utils/inventory";

function buildFallbackBranches(branchNames) {
  return branchNames.map((branchName, index) => ({
    branch_id: `fallback-${index + 1}`,
    branch_name: branchName,
    branch_code: `BR${String(index + 1).padStart(3, "0")}`,
    status: "Active",
  }));
}

export default function BillingPOS({ tier = "small", setActiveTab }) {
  const normalizedTier = normalizeBusinessTier(tier);
  const fallbackBranches = React.useMemo(() => buildFallbackBranches(getBranchNetwork(normalizedTier)), [normalizedTier]);

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

  const [branchOptions, setBranchOptions] = React.useState(fallbackBranches);
  const [selectedBranchId, setSelectedBranchId] = React.useState(() => {
    if (typeof window === "undefined") return fallbackBranches[0]?.branch_id || "";
    return sessionStorage.getItem("inventra_billing_branch_id") || sessionStorage.getItem("inventra_billing_branch") || fallbackBranches[0]?.branch_id || "";
  });
  const [isBranchLoading, setIsBranchLoading] = React.useState(true);
  const [isInventorySyncing, setIsInventorySyncing] = React.useState(false);
  const [inventoryStatus, setInventoryStatus] = React.useState("Loading branch inventory…");

  const handleBack = () => {
    const fallbackTier = normalizeBusinessTier(getDashboardTierFromUser(userSession?.user) || normalizedTier);
    setActiveTab(`dashboard-${fallbackTier}`);
  };

  const selectedBranch = React.useMemo(
    () => branchOptions.find((branch) => branch.branch_id === selectedBranchId || branch.branch_name === selectedBranchId) || branchOptions[0] || null,
    [branchOptions, selectedBranchId],
  );
  const selectedBranchKey = selectedBranch?.branch_id || selectedBranch?.branch_name || selectedBranchId || "default";
  const selectedBranchLabel = selectedBranch?.branch_name || selectedBranch?.branch_id || "Main Store";
  const [products, setProducts] = React.useState(() => loadScopedInventoryProducts(INVENTORY_PRODUCT_SEED, selectedBranchKey));

  React.useEffect(() => {
    saveScopedInventoryProducts(products, selectedBranchKey);
  }, [products, selectedBranchKey]);

  React.useEffect(() => {
    let cancelled = false;

    const syncBranches = async () => {
      try {
        const data = await getUserBranches();
        if (cancelled) return;

        const branches = Array.isArray(data?.branches) && data.branches.length > 0 ? data.branches : fallbackBranches;
        setBranchOptions(branches);

        const storedBranch = sessionStorage.getItem("inventra_billing_branch_id") || sessionStorage.getItem("inventra_billing_branch");
        const matchedBranch =
          branches.find((branch) => branch.branch_id === storedBranch || branch.branch_name === storedBranch) ||
          branches[0] ||
          null;

        if (matchedBranch) {
          setSelectedBranchId(matchedBranch.branch_id || matchedBranch.branch_name);
        }
      } catch {
        if (!cancelled) {
          setBranchOptions(fallbackBranches);
        }
      } finally {
        if (!cancelled) {
          setIsBranchLoading(false);
        }
      }
    };

    syncBranches();
    return () => {
      cancelled = true;
    };
  }, [fallbackBranches]);

  React.useEffect(() => {
    let cancelled = false;

    const loadBranchInventory = async () => {
      if (!selectedBranch) return;

      const branchKey = selectedBranch.branch_id || selectedBranch.branch_name;
      const cachedProducts = loadScopedInventoryProducts(INVENTORY_PRODUCT_SEED, branchKey);
      setProducts(cachedProducts);
      setIsInventorySyncing(true);
      setInventoryStatus(`Loading ${selectedBranchLabel} inventory from database…`);

      try {
        const payload = await getBranchInventory(branchKey);
        if (cancelled) return;

        const nextProducts = hydrateInventoryProducts(payload, cachedProducts);
        setProducts(nextProducts);
        saveScopedInventoryProducts(nextProducts, branchKey);
        setInventoryStatus(`Synced ${nextProducts.length} products from database.`);
      } catch (error) {
        if (cancelled) return;
        setInventoryStatus(error?.message ? `${error.message} — using cached inventory.` : "Using cached inventory.");
      } finally {
        if (!cancelled) {
          setIsInventorySyncing(false);
        }
      }
    };

    loadBranchInventory();
    return () => {
      cancelled = true;
    };
  }, [selectedBranch, selectedBranchLabel]);

  const handleBranchChange = (branch) => {
    if (!branch) return;
    const nextKey = branch.branch_id || branch.branch_name;
    setSelectedBranchId(nextKey);
    try {
      sessionStorage.setItem("inventra_billing_branch_id", nextKey);
      sessionStorage.setItem("inventra_billing_branch", branch.branch_name || nextKey);
    } catch {
      // ignore storage errors
    }
  };

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
          <div className="hidden md:block">
            <BranchDropdown
              branches={branchOptions}
              selectedBranchId={selectedBranch?.branch_id || selectedBranch?.branch_name || selectedBranchId}
              onSelect={handleBranchChange}
              loading={isBranchLoading}
              syncing={isInventorySyncing}
              statusText={inventoryStatus}
            />
          </div>
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

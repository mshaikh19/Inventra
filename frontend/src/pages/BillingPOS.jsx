import React from "react";
import BillingSystem from "../components/BillingSystem";
import BranchDropdown from "../components/BranchDropdown";
import {
  getDashboardTierFromUser,
  getTierBadgeLabel,
  getTierDisplayName,
  getUserDisplayName,
  normalizeBusinessTier,
  userHasOwnerAccess,
  getInventoryOpsTab,
} from "../utils/dashboard";
import { getBranchNetwork, getBranchInventory, getUserBranches, recordBranchSale } from "../utils/branches";
import {
  hydrateInventoryProducts,
  loadScopedInventoryProducts,
  saveScopedInventoryProducts,
} from "../utils/inventory";
import { isEmployeeUser, isManagerUser } from "../utils/employeeWorkspace";

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
  const businessName = userSession?.user?.businessName || userSession?.user?.company || "Inventra Retail";
  const tierBadgeLabel   = getTierBadgeLabel(normalizedTier);

  const tierAccent     = normalizedTier === "medium" ? "#D97706" : normalizedTier === "large" ? "#059669" : "#0284C7";
  const tierAccentSoft = normalizedTier === "medium" ? "rgba(217,119,6,0.1)" : normalizedTier === "large" ? "rgba(5,150,105,0.1)" : "rgba(2,132,199,0.1)";

  const [branchOptions, setBranchOptions] = React.useState([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("inventra_selected_branch") || sessionStorage.getItem("inventra_billing_branch_id") || sessionStorage.getItem("inventra_billing_branch") || "";
  });
  const [isBranchLoading, setIsBranchLoading] = React.useState(true);
  const [isInventorySyncing, setIsInventorySyncing] = React.useState(false);
  const [inventoryStatus, setInventoryStatus] = React.useState("Loading branch inventory…");

  const handleBack = () => {
    sessionStorage.setItem("inventra_dashboard_section", "tasks");
    const fallbackTier = normalizeBusinessTier(getDashboardTierFromUser(userSession?.user) || normalizedTier);
    setActiveTab(`dashboard-${fallbackTier}`);
  };

  const selectedBranch = React.useMemo(
    () => branchOptions.find((branch) => branch.branch_id === selectedBranchId || branch.branch_name === selectedBranchId) || branchOptions[0] || null,
    [branchOptions, selectedBranchId],
  );
  const selectedBranchKey = selectedBranch?.branch_id || selectedBranch?.branch_name || selectedBranchId || "default";
  const selectedBranchLabel = selectedBranch?.branch_name || selectedBranch?.branch_id || "Main Store";
  const [products, setProducts] = React.useState(() => loadScopedInventoryProducts([], selectedBranchLabel));

  React.useEffect(() => {
    // Debounce saves to localStorage - wait 500ms after last change before saving
    const timer = setTimeout(() => {
      saveScopedInventoryProducts(products, selectedBranchLabel);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [products, selectedBranchLabel]);

  React.useEffect(() => {
    let cancelled = false;

    const syncBranches = async () => {
      try {
        const data = await getUserBranches();
        if (cancelled) return;

        let branches = Array.isArray(data?.branches) && data.branches.length > 0 ? data.branches : [];
        
        // Scope to assigned branch if user is a branch manager or employee
        const userBranchId = userHasOwnerAccess(userSession?.user) ? null : userSession?.user?.branchId;
        if (userBranchId) {
          const userBranch = branches.find(b => b.branch_id === userBranchId);
          if (userBranch) {
            branches = [userBranch];
          }
        }

        setBranchOptions(branches);

        const storedBranch = sessionStorage.getItem("inventra_selected_branch") || sessionStorage.getItem("inventra_billing_branch_id") || sessionStorage.getItem("inventra_billing_branch");
        const matchedBranch =
          branches.find((branch) => branch.branch_id === storedBranch || branch.branch_name === storedBranch) ||
          branches[0] ||
          null;

        if (matchedBranch) {
          const nextKey = matchedBranch.branch_id || matchedBranch.branch_name;
          const branchName = matchedBranch.branch_name || nextKey;
          setSelectedBranchId(nextKey);
          try {
            sessionStorage.setItem("inventra_selected_branch", branchName);
            sessionStorage.setItem("inventra_billing_branch_id", nextKey);
            sessionStorage.setItem("inventra_billing_branch", branchName);
          } catch {}
        }
      } catch {
        if (!cancelled) {
          setBranchOptions([]);
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
  }, [userSession]);

  React.useEffect(() => {
    let cancelled = false;

    const loadBranchInventory = async () => {
      if (!selectedBranch) return;

      const branchKey = selectedBranch.branch_id || selectedBranch.branch_name;
      const branchName = selectedBranch.branch_name || branchKey;
      
      // Clear old products first so the screen shows loading state correctly
      setProducts([]);
      setIsInventorySyncing(true);
      setInventoryStatus(`Loading ${branchName} inventory from database…`);

      try {
        const payload = await getBranchInventory(branchKey);
        if (cancelled) return;

        const nextProducts = hydrateInventoryProducts(payload, []);
        setProducts(nextProducts);
        setInventoryStatus(`Synced ${nextProducts.length} products from database.`);
        saveScopedInventoryProducts(nextProducts, branchName);
      } catch (error) {
        if (cancelled) return;
        
        // Load local storage cached products as dynamic fallback if network fails
        const cachedProducts = loadScopedInventoryProducts([], branchName);
        setProducts(cachedProducts);
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
    const branchName = branch.branch_name || nextKey;
    setSelectedBranchId(nextKey);
    try {
      sessionStorage.setItem("inventra_selected_branch", branchName);
      sessionStorage.setItem("inventra_billing_branch_id", nextKey);
      sessionStorage.setItem("inventra_billing_branch", branchName);
    } catch {
      // ignore storage errors
    }
  };

  const handleRecordSale = async (receiptData, onSuccess, onError) => {
    const branchKey = selectedBranch?.branch_id || selectedBranch?.branch_name || selectedBranchLabel;

    const salePayload = {
      invoice_number: receiptData.invoiceNumber,
      payment_mode: receiptData.paymentMode,
      amount_paid: receiptData.amountPaid,
      grand_total: receiptData.grandTotal,
      change_due: receiptData.changeDue,
      customer_name: receiptData.customerName,
      customer_state: receiptData.customerState,
      cashier: userDisplayName,
      items: receiptData.items.map((item) => ({
        item_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        selling_price: item.unitPrice ?? item.price,
        mrp: item.mrp,
        sell_on_mrp: Boolean(item.sellOnMrp),
        discount_percent: item.discountPercent || 0,
        discount_amount: item.lineDiscountAmount || 0,
        taxable_amount: item.lineTaxableAmount || 0,
        gst_rate: item.gstRate ?? item.gstPercentage ?? 0,
        cgst_amount: item.cgstAmount || 0,
        sgst_amount: item.sgstAmount || 0,
        igst_amount: item.igstAmount || 0,
        tax_amount: item.lineTaxAmount || 0,
        line_total: item.lineTotal || 0,
      })),
    };

    try {
      const result = await recordBranchSale(branchKey, salePayload);
      // Refresh product list from updated inventory returned by the server
      if (result.updated_items && result.updated_items.length > 0) {
        const nextProducts = hydrateInventoryProducts({ items: result.updated_items }, []);
        setProducts(nextProducts);
        saveScopedInventoryProducts(nextProducts, branchKey);
        if (selectedBranch?.branch_name) {
          saveScopedInventoryProducts(nextProducts, selectedBranch.branch_name);
        }
      }
      onSuccess?.();
    } catch (err) {
      onError?.(err.message || "Failed to record sale");
    }
  };

  return (
    /* Full-screen dark terminal shell */
    <div className="min-h-dvh flex flex-col overflow-x-hidden overflow-y-auto" style={{ background: "#0C1120" }}>

      {/* ── Dark POS header bar ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 px-4 sm:px-6 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0F172A" }}>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-[0.18em]">Dashboard</span>
          </button>

          <div className="w-px h-5 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />

          <button
            type="button"
            onClick={() => setActiveTab && setActiveTab(getInventoryOpsTab(normalizedTier))}
            className="flex items-center gap-1.5 whitespace-nowrap text-slate-400 hover:text-white transition-colors duration-150 border border-slate-800 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] bg-slate-900/40 cursor-pointer hover:border-emerald-500/30 shrink-0"
          >
            <span className="shrink-0">📦</span>
            <span className="shrink-0">Inventory Desk</span>
          </button>

          <div className="w-px h-5 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />

          <div className="hidden sm:flex items-center gap-3 min-w-[260px] md:min-w-[320px] lg:min-w-[360px]">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: tierAccent + "22", border: `1px solid ${tierAccent}30` }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke={tierAccent} strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3h-.75m0 0v16.5A2.25 2.25 0 0 0 5.25 21.75h13.5A2.25 2.25 0 0 0 21 19.5V3m-17.25 0h17.25M3 9h18M9 3v18m6-18v18" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="text-[8px] font-black uppercase tracking-[0.22em] text-slate-500 leading-none">POS Terminal</div>
              <div className="text-sm font-black text-white leading-none mt-0.5">Sales Counter</div>
              <div className="hidden lg:block text-[12px] text-slate-400 mt-1 whitespace-nowrap">Search, filter, or tap items to add instantly</div>
            </div>
          </div>

          {/* helper text moved below Sales Counter title to avoid wrapping */}
        </div>

        <div className="flex flex-col gap-2 sm:hidden w-full">
          <div className="block w-full">
            {userHasOwnerAccess(userSession?.user) ? (
              <BranchDropdown
                branches={branchOptions}
                selectedBranchId={selectedBranch?.branch_id || selectedBranch?.branch_name || selectedBranchId}
                onSelect={handleBranchChange}
                loading={isBranchLoading}
                syncing={isInventorySyncing}
                statusText={inventoryStatus}
              />
            ) : branchOptions[0] ? (
              <div className="w-full rounded-2xl border border-emerald-500/20 bg-slate-950/80 px-4 py-3 relative overflow-hidden">
                <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />
                <span className="block text-sm font-black text-white">
                  {branchOptions[0].branch_name}
                </span>
              </div>
            ) : null}
          </div>
          <div className="inline-flex items-center justify-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex-wrap max-w-full">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider truncate max-w-[140px]">{userDisplayName}</span>
            <span className="inline-block w-1 h-1 rounded-full bg-slate-700 shrink-0" />
            <span
              className="rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white shrink-0 shadow-sm"
              style={{ background: tierAccent }}
            >
              {tierBadgeLabel}
            </span>
            <span className="inline-block w-1 h-1 rounded-full bg-slate-700 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap shrink-0">
              {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 sm:gap-3 flex-wrap justify-between w-full lg:gap-6 lg:px-6">
          <div className="block w-full sm:w-auto flex-1 min-w-0" />
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end w-full sm:w-auto">
            <div className="w-[280px] md:w-80 lg:w-96 mr-2 lg:mr-4">
              {userHasOwnerAccess(userSession?.user) ? (
                <BranchDropdown
                  branches={branchOptions}
                  selectedBranchId={selectedBranch?.branch_id || selectedBranch?.branch_name || selectedBranchId}
                  onSelect={handleBranchChange}
                  loading={isBranchLoading}
                  syncing={isInventorySyncing}
                  statusText={inventoryStatus}
                />
              ) : branchOptions[0] ? (
                <div className="w-full rounded-2xl border border-emerald-500/20 bg-slate-950/80 px-4 py-3 relative overflow-hidden">
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />
                  <span className="block text-sm font-black text-white">
                    {branchOptions[0].branch_name}
                  </span>
                </div>
              ) : null}
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
        </div>
      </header>

      {/* ── Billing system fills remaining space — no container, no padding ── */}
      <main className="flex-1 flex overflow-hidden">
        <BillingSystem
          products={products}
          onRecordSale={handleRecordSale}
          tierAccent={tierAccent}
          tierAccentSoft={tierAccentSoft}
          isLoading={isInventorySyncing}
          setActiveTab={setActiveTab}
          tier={normalizedTier}
          selectedBranchLabel={selectedBranchLabel}
          selectedBranchId={selectedBranch?.branch_id || selectedBranchId}
          userDisplayName={userDisplayName}
          businessName={businessName}
          isManagerOrOwner={isManagerUser(userSession?.user) || userHasOwnerAccess(userSession?.user)}
        />
      </main>
    </div>
  );
}

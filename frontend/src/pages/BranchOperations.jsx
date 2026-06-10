import React from "react";
import {
  getDashboardTierFromUser,
  getTierBadgeLabel,
  getUserDisplayName,
  normalizeBusinessTier,
  userHasOwnerAccess,
} from "../utils/dashboard";
import { getUserBranches, getBranchInventory } from "../utils/branches";
import { normalizeInventoryProducts } from "../utils/inventory";
import CustomDropdown from "../components/CustomDropdown";

function getCapacityForBranch(branchObj) {
  if (!branchObj) return 300;
  const type = branchObj.branch_type;
  if (type === "Warehouse" || type === "Depot") return 1000;
  if (type === "Store") return 300;
  return 500;
}

function getShelfForProduct(productName) {
  if (!productName) return "Aisle A-1";
  const char = productName.charAt(0).toUpperCase();
  const sum = productName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const aisleNum = (sum % 5) + 1;
  const shelfNum = (sum % 4) + 1;
  const isCold = productName.toLowerCase().includes("milk") || 
                 productName.toLowerCase().includes("butter") || 
                 productName.toLowerCase().includes("yogurt") ||
                 productName.toLowerCase().includes("cheese") ||
                 productName.toLowerCase().includes("dairy");
  if (isCold) {
    return `Cold Rack-${aisleNum}`;
  }
  return `Aisle ${char}-${shelfNum}`;
}

function getDynamicDirective(branchName, branchProducts, capacityPct) {
  if (branchProducts.length === 0) {
    return "This branch has no inventory items. Populate the inventory by adding items or recording purchase orders to start tracking stock operations.";
  }
  
  const criticalItems = branchProducts.filter(p => p.stock === 0 || p.stock <= p.reorderLevel * 0.3);
  const warningItems = branchProducts.filter(p => p.stock > p.reorderLevel * 0.3 && p.stock <= p.reorderLevel);
  
  if (criticalItems.length > 0) {
    const itemNames = criticalItems.slice(0, 2).map(p => p.name).join(" and ");
    const moreCount = criticalItems.length > 2 ? ` and ${criticalItems.length - 2} more` : "";
    return `Critical stock alert: ${itemNames}${moreCount} is/are depleted. Allocate immediate dispatch from a warehouse node or place a vendor reorder to restore safety margins.`;
  }
  
  if (warningItems.length > 0) {
    const itemNames = warningItems.slice(0, 2).map(p => p.name).join(" and ");
    return `Stock buffer warning: ${itemNames} is approaching safety limit. Replenishment logic is monitoring velocity.`;
  }
  
  if (capacityPct > 90) {
    return `Branch holding capacity is very high (${capacityPct}%). Consider routing surplus stock to other nodes in the network to optimize holding costs.`;
  }
  
  return "Branch operations are healthy. All active products are operating within normal buffer bounds. Keep automatic tracking active.";
}

function statusFor(stock, reorderLevel) {
  if (stock === 0 || stock <= reorderLevel * 0.3) return "Critical Low";
  if (stock <= reorderLevel) return "Warning Low";
  if (stock >= reorderLevel * 5) return "Overstocked";
  return "Stable";
}

export default function BranchOperations({ tier = "large", setActiveTab }) {
  const normalizedTier = normalizeBusinessTier(tier);
  const tierAccent = normalizedTier === "medium" ? "#D97706" : normalizedTier === "large" ? "#059669" : "#0284C7";
  const tierBadgeLabel = getTierBadgeLabel(normalizedTier);
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

  const [branchesList, setBranchesList] = React.useState([]);
  const [rawBranches, setRawBranches] = React.useState([]);
  const [products, setProducts] = React.useState([]);

  const [selectedBranch, setSelectedBranch] = React.useState(() => {
    if (typeof window === "undefined") return "Mumbai Hub";
    return sessionStorage.getItem("inventra_selected_branch") || "Mumbai Hub";
  });

  React.useEffect(() => {
    getUserBranches()
      .then((data) => {
        if (data && data.branches) {
          setRawBranches(data.branches);
          const names = data.branches.map((b) => b.branch_name);
          
          // Check if employee has branch scoping
          const userBranchId = userHasOwnerAccess(userSession?.user) ? null : userSession?.user?.branchId;
          const userBranch = data.branches.find(b => b.branch_id === userBranchId);
          
          if (userBranch) {
            setSelectedBranch(userBranch.branch_name);
            setBranchesList([userBranch.branch_name]);
          } else {
            setBranchesList(names);
            // Auto-select the first branch if current selected branch is not in names list
            setSelectedBranch((current) => {
              return names.includes(current) ? current : (names[0] || current);
            });
          }
        }
      })
      .catch((err) => console.error("Failed to load branches from DB:", err));
  }, [normalizedTier, userSession]);

  // Load inventories in parallel
  React.useEffect(() => {
    if (rawBranches && rawBranches.length > 0) {
      Promise.all(
        rawBranches.map(branch => {
          const branchId = branch._id || branch.branch_id;
          return getBranchInventory(branchId)
            .then((invData) => {
              const items = invData.items || invData.inventory?.items || [];
              const normalized = normalizeInventoryProducts(items);
              return normalized.map(p => ({ ...p, branchName: branch.branch_name, branchId: branchId }));
            })
            .catch((err) => {
              console.warn(`Failed to fetch inventory for branch ${branch.branch_name}:`, err);
              return [];
            });
        })
      ).then((allResults) => {
        const merged = allResults.flat();
        setProducts(merged);
      });
    }
  }, [rawBranches]);

  const [branchStocks, setBranchStocks] = React.useState({});

  React.useEffect(() => {
    if (products.length > 0) {
      const stocks = {};
      products.forEach((p) => {
        if (!stocks[p.id]) {
          stocks[p.id] = {};
        }
        stocks[p.id][p.branchName] = p.stock;
      });
      setBranchStocks(stocks);
    }
  }, [products]);

  const [transferForm, setTransferForm] = React.useState({
    source: "",
    productId: "",
    quantity: 10,
  });
  
  // Set transfer form default source / product when branches / products load
  React.useEffect(() => {
    const defaultSrc = branchesList.find(b => b !== selectedBranch) || "";
    const sourceProds = products.filter(p => p.branchName === defaultSrc);
    setTransferForm(prev => ({
      ...prev,
      source: defaultSrc,
      productId: sourceProds[0]?.id || ""
    }));
  }, [branchesList, selectedBranch, products]);

  const [transferStatus, setTransferStatus] = React.useState("idle");

  const allBranchesMetrics = React.useMemo(() => {
    const map = {};
    branchesList.forEach((branchName) => {
      const branchObj = rawBranches.find(b => b.branch_name === branchName);
      const limit = getCapacityForBranch(branchObj);
      const branchProducts = products.filter((p) => p.branchName === branchName);
      const totalStock = branchProducts.reduce((sum, p) => sum + p.stock, 0);
      const capacityPct = Math.min(100, Math.round((totalStock / limit) * 100)) || 0;
      const lowStock = branchProducts.filter((p) => p.stock <= p.reorderLevel);
      const alerts = lowStock.length;
      const salesVal = branchProducts.reduce((sum, p) => sum + (p.price * p.sold), 0);
      
      let health = "Optimal";
      if (branchProducts.length === 0) {
        health = "Onboarding";
      } else if (alerts > 0) {
        health = "Watchlist";
      } else if (capacityPct > 95) {
        health = "Overstocked";
      }

      map[branchName] = {
        sales: `₹${salesVal.toLocaleString()}`,
        stockLevel: `${capacityPct}%`,
        health,
        alerts,
        orders: alerts,
        growth: salesVal > 0 ? "Active" : "—"
      };
    });
    return map;
  }, [products, branchesList, rawBranches]);

  const activeBranchObj = React.useMemo(() => {
    return rawBranches.find(b => b.branch_name === selectedBranch);
  }, [rawBranches, selectedBranch]);

  const capacityLimit = React.useMemo(() => {
    return getCapacityForBranch(activeBranchObj);
  }, [activeBranchObj]);

  const metrics = React.useMemo(() => {
    const branchProducts = products.filter((p) => p.branchName === selectedBranch);
    const totalStock = branchProducts.reduce((sum, p) => sum + p.stock, 0);
    const capacityPct = Math.min(100, Math.round((totalStock / capacityLimit) * 100)) || 0;
    const lowStock = branchProducts.filter((p) => p.stock <= p.reorderLevel);
    const alerts = lowStock.length;
    const salesVal = branchProducts.reduce((sum, p) => sum + (p.price * p.sold), 0);
    
    // Determine health
    let health = "Optimal";
    if (branchProducts.length === 0) {
      health = "Onboarding";
    } else if (alerts > 0) {
      health = "Watchlist";
    } else if (capacityPct > 95) {
      health = "Overstocked";
    }

    const growth = salesVal > 0 ? "Active" : "—";

    return {
      sales: `₹${salesVal.toLocaleString()}`,
      stockLevel: `${capacityPct}%`,
      health,
      alerts,
      growth,
      orders: alerts
    };
  }, [products, selectedBranch, capacityLimit]);

  const userDisplayName = getUserDisplayName(userSession?.user, "Manager");

  const branchInventory = React.useMemo(() => {
    return products.filter((p) => p.branchName === selectedBranch).map((p) => {
      const stock = branchStocks[p.id]?.[selectedBranch] ?? p.stock;
      return {
        ...p,
        stock,
        shelf: getShelfForProduct(p.name),
        status: statusFor(stock, p.reorderLevel || 10),
      };
    });
  }, [products, branchStocks, selectedBranch]);

  const totalStock = branchInventory.reduce((sum, item) => sum + item.stock, 0);
  const capacity = Math.min(100, Math.round((totalStock / capacityLimit) * 100));
  const healthClass = metrics.health === "Watchlist" ? "text-rose-600" : metrics.health === "Overstocked" ? "text-amber-600" : "text-emerald-600";

  const handleBack = () => {
    const fallbackTier = normalizeBusinessTier(getDashboardTierFromUser(userSession?.user) || normalizedTier);
    setActiveTab(`dashboard-${fallbackTier}`);
  };

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    sessionStorage.setItem("inventra_selected_branch", branch);
  };

  const handleTransfer = (event) => {
    event.preventDefault();
    const productId = transferForm.productId;
    const qty = Number(transferForm.quantity);
    const sourceStock = branchStocks[productId]?.[transferForm.source] || 0;
    if (transferForm.source === selectedBranch || sourceStock < qty) return;

    setTransferStatus("sending");
    window.setTimeout(() => {
      setBranchStocks((current) => {
        const nextProductStock = { ...current[productId] };
        nextProductStock[transferForm.source] = Math.max(0, nextProductStock[transferForm.source] - qty);
        nextProductStock[selectedBranch] = (nextProductStock[selectedBranch] || 0) + qty;
        return { ...current, [productId]: nextProductStock };
      });
      setTransferStatus("success");
      window.setTimeout(() => setTransferStatus("idle"), 2200);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#F6FAF8] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-5 lg:px-8 py-2.5">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-950 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">Dashboard</span>
            </button>
            <div className="hidden sm:block w-px h-7 bg-slate-200" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-700">Enterprise Branch Operations</span>
              <h3 className="text-base md:text-lg font-black leading-tight">{selectedBranch}</h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[10px] font-bold text-slate-400 uppercase tracking-widest">{userDisplayName}</span>
            <span className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white" style={{ background: tierAccent }}>
              {tierBadgeLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="px-5 lg:px-8 xl:pl-[340px] py-4">
        <aside className="xl:fixed xl:left-0 xl:top-[57px] xl:h-[calc(100vh-57px)] xl:w-[316px] xl:flex xl:flex-col xl:overflow-hidden xl:border-r xl:border-slate-200 xl:bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_48%,#f8fafc_100%)] xl:px-4 xl:py-4 xl:shadow-[0_1px_3px_rgba(0,0,0,0.05)] mb-5 xl:mb-0">
          <div className="rounded-[28px] border border-slate-100 bg-white px-5 py-5 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Branch Network</span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5 leading-tight">Operations Rail</h2>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
            </div>
            <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">Select a hub to switch the full branch command workspace.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Active Hub</div>
                <div className="mt-1 text-[11px] font-bold text-slate-800 leading-tight">{selectedBranch}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Health</div>
                <div className={`mt-1 text-[11px] font-black leading-tight ${healthClass}`}>{metrics.health}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            {branchesList.map((branch) => {
              const isActive = selectedBranch === branch;
              const branchHealth = allBranchesMetrics[branch]?.health || "Stable";
              return (
                <button
                  key={branch}
                  onClick={() => handleBranchSelect(branch)}
                  className={`w-full text-left rounded-2xl border px-4 py-3 transition-all cursor-pointer relative overflow-hidden ${
                    isActive ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />}
                  <span className="block text-sm font-black text-slate-950">{branch}</span>
                  <span className={`block text-[10px] font-black uppercase tracking-wider mt-1 ${branchHealth === "Watchlist" ? "text-rose-600" : branchHealth === "Overstocked" ? "text-amber-600" : "text-emerald-600"}`}>
                    {branchHealth}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-white p-5 md:p-6 shadow-[0_14px_44px_rgba(15,23,42,0.06)]">
            <div className="absolute right-10 top-0 h-1.5 w-24 rounded-b-full bg-emerald-500" />
            <div className="absolute -right-16 -top-24 h-60 w-60 rounded-full bg-emerald-100/70 blur-3xl" />
            <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-center">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Command Node</span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mt-1">{selectedBranch} Operations</h2>
                <p className="text-xs md:text-sm font-semibold text-slate-500 leading-relaxed max-w-2xl mt-3">{getDynamicDirective(selectedBranch, branchInventory, capacity)}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  {[
                    ["Revenue", metrics.sales],
                    ["Orders", metrics.orders],
                    ["Growth", metrics.growth],
                    ["Stock Health", metrics.stockLevel],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                      <span className="block text-lg font-black mt-1">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/70 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Operational Health</span>
                  <span className={`text-sm font-black ${healthClass}`}>{metrics.health}</span>
                </div>
                <div className="mt-6 flex items-center gap-5">
                  <div className="relative h-28 w-28 shrink-0">
                    <svg viewBox="0 0 100 100" className="-rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#D1FAE5" strokeWidth="10" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={tierAccent} strokeWidth="10" strokeLinecap="round" strokeDasharray={264} strokeDashoffset={264 - (capacity / 100) * 264} />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center text-2xl font-black">{capacity}%</div>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Capacity</span>
                    <div className="text-2xl font-black mt-1">{totalStock}/{capacityLimit}</div>
                    <p className="text-xs font-semibold text-slate-500 mt-1">{100 - capacity}% space available</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Local Inventory Matrix</span>
                  <h3 className="text-xl font-black mt-1">Stock, Shelf & Safety Status</h3>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">Live Branch Data</span>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Shelf</th>
                      <th className="px-4 py-3 text-center">Stock</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {branchInventory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-4">
                          <span className="block font-black text-slate-950">{item.name}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.category}</span>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs font-bold text-slate-500">{item.shelf}</td>
                        <td className="px-4 py-4 text-center font-black">{item.stock} units</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                            item.status === "Critical Low" ? "bg-rose-50 border-rose-200 text-rose-700" :
                            item.status === "Warning Low" ? "bg-amber-50 border-amber-200 text-amber-700" :
                            item.status === "Overstocked" ? "bg-orange-50 border-orange-200 text-orange-700" :
                            "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}>{item.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {(!userSession?.user?.role || userSession?.user?.role === "owner") && (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Dispatch Desk</span>
                <h3 className="text-xl font-black mt-1">Direct Stock Transfer</h3>
                <form onSubmit={handleTransfer} className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Source Warehouse</span>
                    <CustomDropdown
                      value={transferForm.source}
                      onChange={(val) => setTransferForm({ ...transferForm, source: val })}
                      options={branchesList.filter((branch) => branch !== selectedBranch).map((branch) => ({
                        value: branch,
                        label: branch,
                      }))}
                      theme="emerald"
                      className="mt-1"
                      buttonClassName="rounded-xl font-bold"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Destination</span>
                    <input readOnly value={selectedBranch} className="mt-1 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900 outline-none" />
                  </label>
                  <div className="grid grid-cols-[1fr_120px] gap-3">
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Product SKU</span>
                      <CustomDropdown
                        value={transferForm.productId}
                        onChange={(val) => setTransferForm({ ...transferForm, productId: val })}
                        options={
                          products.filter((p) => p.branchName === transferForm.source).length === 0 ? [
                            { value: "", label: "No items available in source" }
                          ] : products.filter((p) => p.branchName === transferForm.source).map((product) => ({
                            value: product.id,
                            label: `${product.name} (Qty: ${product.stock})`,
                          }))
                        }
                        theme="emerald"
                        className="mt-1"
                        buttonClassName="rounded-xl font-bold"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Qty</span>
                      <input type="number" min="1" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-center outline-none" />
                    </label>
                  </div>
                  {transferStatus === "success" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">Dispatch allocated successfully.</div>}
                  <button type="submit" disabled={transferStatus === "sending"} className="w-full rounded-xl py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg transition-all hover:scale-[1.01] disabled:opacity-60" style={{ background: tierAccent }}>
                    {transferStatus === "sending" ? "Routing Dispatch..." : "Initiate Transfer"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

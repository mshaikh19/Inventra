import React from "react";
import {
  getDashboardTierFromUser,
  getTierBadgeLabel,
  getUserDisplayName,
  normalizeBusinessTier,
} from "../utils/dashboard";
import { getBranchNetwork, getUserBranches } from "../utils/branches";

const branchMetrics = {
  "Mumbai Hub": { sales: "₹0", stockLevel: "0%", health: "New", alerts: 0, growth: "+0.0%", orders: 0 },
  "Delhi Branch": { sales: "₹0", stockLevel: "0%", health: "New", alerts: 0, growth: "+0.0%", orders: 0 },
  "Bangalore Branch": { sales: "₹0", stockLevel: "0%", health: "New", alerts: 0, growth: "+0.0%", orders: 0 },
  "Pune Depot": { sales: "₹0", stockLevel: "0%", health: "New", alerts: 0, growth: "+0.0%", orders: 0 },
  "New York Hub": { sales: "$0", stockLevel: "0%", health: "New", alerts: 0, growth: "+0.0%", orders: 0 },
  "London Branch": { sales: "£0", stockLevel: "0%", health: "New", alerts: 0, growth: "+0.0%", orders: 0 },
  "Tokyo Depot": { sales: "¥0", stockLevel: "0%", health: "New", alerts: 0, growth: "+0.0%", orders: 0 },
  "Singapore Hub": { sales: "S$0", stockLevel: "0%", health: "New", alerts: 0, growth: "+0.0%", orders: 0 },
};

const capacityLimits = {
  "Mumbai Hub": 300,
  "Delhi Branch": 150,
  "Bangalore Branch": 250,
  "Pune Depot": 600,
  "New York Hub": 450,
  "London Branch": 280,
  "Tokyo Depot": 520,
  "Singapore Hub": 380,
};

const productsSeed = [
  { id: 1, name: "Fresh Bread 400g", category: "Bakery", stock: 0, price: 40, sold: 120, expiryDate: "2026-05-24", reorderLevel: 15 },
  { id: 2, name: "Organic Milk 1L", category: "Dairy", stock: 0, price: 60, sold: 240, expiryDate: "2026-05-23", reorderLevel: 20 },
  { id: 3, name: "Coke 500ml", category: "Beverages", stock: 0, price: 40, sold: 310, expiryDate: "2026-11-12", reorderLevel: 10 },
  { id: 4, name: "Potato Chips 150g", category: "Snacks", stock: 0, price: 20, sold: 480, expiryDate: "2026-09-08", reorderLevel: 25 },
  { id: 5, name: "Amul Butter 500g", category: "Dairy", stock: 0, price: 250, sold: 85, expiryDate: "2026-06-15", reorderLevel: 12 },
  { id: 6, name: "Dark Chocolate 100g", category: "Snacks", stock: 0, price: 80, sold: 150, expiryDate: "2026-10-30", reorderLevel: 15 },
];

const shelfCoordinates = {
  1: { "Mumbai Hub": "Aisle A-3", "Delhi Branch": "Aisle A-1", "Bangalore Branch": "Aisle A-2", "Pune Depot": "Aisle A-5", "New York Hub": "Zone B-2", "London Branch": "Section C-1", "Tokyo Depot": "Area D-3", "Singapore Hub": "Bay E-2" },
  2: { "Mumbai Hub": "Cold Rack-1", "Delhi Branch": "Cold Rack-1", "Bangalore Branch": "Cold Rack-3", "Pune Depot": "Cold Room-1", "New York Hub": "Cool Zone A-1", "London Branch": "Fridge B-2", "Tokyo Depot": "Cold Storage C-1", "Singapore Hub": "Chiller D-2" },
  3: { "Mumbai Hub": "Aisle C-2", "Delhi Branch": "Aisle C-1", "Bangalore Branch": "Aisle C-3", "Pune Depot": "Aisle C-5", "New York Hub": "Row E-3", "London Branch": "Lane F-1", "Tokyo Depot": "Path G-2", "Singapore Hub": "Way H-3" },
  4: { "Mumbai Hub": "Aisle D-1", "Delhi Branch": "Aisle D-1", "Bangalore Branch": "Aisle D-3", "Pune Depot": "Aisle D-5", "New York Hub": "Shelf I-2", "London Branch": "Rack J-1", "Tokyo Depot": "Unit K-3", "Singapore Hub": "Spot L-2" },
  5: { "Mumbai Hub": "Cold Rack-2", "Delhi Branch": "Cold Rack-2", "Bangalore Branch": "Cold Rack-4", "Pune Depot": "Cold Room-2", "New York Hub": "Freeze M-1", "London Branch": "Ice N-2", "Tokyo Depot": "Polar O-3", "Singapore Hub": "Frost P-1" },
  6: { "Mumbai Hub": "Aisle E-4", "Delhi Branch": "Aisle E-2", "Bangalore Branch": "Aisle E-1", "Pune Depot": "Aisle E-5", "New York Hub": "Zone Q-2", "London Branch": "Area R-1", "Tokyo Depot": "Sector S-3", "Singapore Hub": "Region T-2" },
};

const allocateStock = (productId, totalStock) => {
  const branchesList = getBranchNetwork("large");

  return branchesList.reduce((acc, branch, index) => {
    acc[branch] = 0;
    return acc;
  }, {});
};

function getDirective(branchName) {
  if (branchName === "Delhi Branch") {
    return "Critical stock buffers are below enterprise policy in Bakery, Dairy, and Snacks. Dispatch from Pune Depot and Mumbai Hub before the next morning sales window.";
  }
  if (branchName === "Pune Depot") {
    return "Depot capacity is running too high. Release Dairy and Bakery surplus into Delhi and London lanes to reduce holding cost and expiry exposure.";
  }
  if (branchName === "London Branch") {
    return "Service level is drifting. Confirm cold-chain supplier SLA and raise safety stock on Dairy for the next two cycles.";
  }
  return "Branch is operating inside target bands. Maintain current reorder policy and keep automated replenishment active.";
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
  const [branchesList, setBranchesList] = React.useState(() => getBranchNetwork(normalizedTier));

  React.useEffect(() => {
    getUserBranches()
      .then((data) => {
        if (data && data.branches) {
          const names = data.branches.map((b) => b.branch_name);
          setBranchesList(names);
          // Auto-select the first branch if current selected branch is not in names list
          setSelectedBranch((current) => {
            return names.includes(current) ? current : (names[0] || current);
          });
        }
      })
      .catch((err) => console.error("Failed to load branches from DB:", err));
  }, [normalizedTier]);

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

  const [selectedBranch, setSelectedBranch] = React.useState(() => {
    if (typeof window === "undefined") return "Mumbai Hub";
    return sessionStorage.getItem("inventra_selected_branch") || "Mumbai Hub";
  });
  const [products] = React.useState(productsSeed);
  const [branchStocks, setBranchStocks] = React.useState(() => {
    const initial = {};
    productsSeed.forEach((product) => {
      initial[product.id] = allocateStock(product.id, product.stock);
    });
    return initial;
  });
  const [transferForm, setTransferForm] = React.useState({
    source: "Pune Depot",
    productId: productsSeed[0].id,
    quantity: 10,
  });
  const [transferStatus, setTransferStatus] = React.useState("idle");

  const metrics = branchMetrics[selectedBranch] || branchMetrics["Mumbai Hub"];
  const userDisplayName = getUserDisplayName(userSession?.user, "Manager");

  const branchInventory = products.map((product) => {
    const stock = branchStocks[product.id]?.[selectedBranch] || 0;
    return {
      ...product,
      stock,
      shelf: shelfCoordinates[product.id]?.[selectedBranch] || "Aisle F-1",
      status: statusFor(stock, product.reorderLevel || 10),
    };
  });

  const totalStock = branchInventory.reduce((sum, item) => sum + item.stock, 0);
  const capacityLimit = capacityLimits[selectedBranch] || 300;
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
    const productId = Number(transferForm.productId);
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
              const branchHealth = branchMetrics[branch]?.health || "Stable";
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
                <p className="text-xs md:text-sm font-semibold text-slate-500 leading-relaxed max-w-2xl mt-3">{getDirective(selectedBranch)}</p>
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

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Dispatch Desk</span>
              <h3 className="text-xl font-black mt-1">Direct Stock Transfer</h3>
              <form onSubmit={handleTransfer} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Source Warehouse</span>
                  <select value={transferForm.source} onChange={(e) => setTransferForm({ ...transferForm, source: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none">
                    {branchesList.filter((branch) => branch !== selectedBranch).map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Destination</span>
                  <input readOnly value={selectedBranch} className="mt-1 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900 outline-none" />
                </label>
                <div className="grid grid-cols-[1fr_120px] gap-3">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Product SKU</span>
                    <select value={transferForm.productId} onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none">
                      {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                    </select>
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
          </div>
        </section>
      </main>
    </div>
  );
}

import React from "react";
import {
  getDashboardTierFromUser,
  getTierBadgeLabel,
  getUserDisplayName,
  normalizeBusinessTier,
} from "../utils/dashboard";
import { getBranchNetwork } from "../utils/branches";

const BRANCH_RATIOS_BY_TIER = {
  small: { "Main Store": 1 },
  medium: { "Mumbai Hub": 0.4, "Delhi Branch": 0.15, "Bangalore Branch": 0.25, "Pune Depot": 0.2 },
  large: {
    "Mumbai Hub": 0.28,
    "Delhi Branch": 0.12,
    "Bangalore Branch": 0.18,
    "Pune Depot": 0.14,
    "New York Hub": 0.1,
    "London Branch": 0.06,
    "Tokyo Depot": 0.07,
    "Singapore Hub": 0.05,
  },
};

const initialProducts = [
  { id: 1, name: "Fresh Bread 400g", category: "Bakery", stock: 8, price: 40, sold: 120, expiryDate: "2026-05-24", reorderLevel: 15, barcode: "8901234567890" },
  { id: 2, name: "Organic Milk 1L", category: "Dairy", stock: 12, price: 60, sold: 240, expiryDate: "2026-05-23", reorderLevel: 20, barcode: "8901234567891" },
  { id: 3, name: "Coke 500ml", category: "Beverages", stock: 85, price: 40, sold: 310, expiryDate: "2026-11-12", reorderLevel: 10, barcode: "8901234567892" },
  { id: 4, name: "Potato Chips 150g", category: "Snacks", stock: 4, price: 20, sold: 480, expiryDate: "2026-09-08", reorderLevel: 25, barcode: "8901234567893" },
  { id: 5, name: "Amul Butter 500g", category: "Dairy", stock: 32, price: 250, sold: 85, expiryDate: "2026-06-15", reorderLevel: 12, barcode: "8901234567894" },
  { id: 6, name: "Dark Chocolate 100g", category: "Snacks", stock: 55, price: 80, sold: 150, expiryDate: "2026-10-30", reorderLevel: 15, barcode: "8901234567895" },
];

const getBranchAllocation = (product, branchNames, ratios) => {
  const totalStock = Number(product.stock || 0);
  let usedStock = 0;

  return branchNames.reduce((allocation, branchName, index) => {
    const isLastBranch = index === branchNames.length - 1;
    const branchStock = isLastBranch ? totalStock - usedStock : Math.floor(totalStock * (ratios[branchName] || 0));
    usedStock += branchStock;
    allocation[branchName] = Math.max(0, branchStock);
    return allocation;
  }, {});
};

const getStatus = (stock, reorderLevel) => {
  if (stock <= Math.max(1, reorderLevel * 0.3)) return "Critical";
  if (stock <= reorderLevel) return "Low Stock";
  if (stock >= reorderLevel * 5) return "Overstock";
  return "Healthy";
};

export default function InventoryOperations({ tier = "small", setActiveTab }) {
  const normalizedTier = normalizeBusinessTier(tier);
  const [branchNames] = React.useState(() => getBranchNetwork(normalizedTier));
  const branchRatios = BRANCH_RATIOS_BY_TIER[normalizedTier] || BRANCH_RATIOS_BY_TIER.small;
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

  const [selectedBranch, setSelectedBranch] = React.useState(() => {
    if (typeof window === "undefined") return branchNames[0];
    const saved = sessionStorage.getItem("inventra_inventory_branch");
    return branchNames.includes(saved) ? saved : branchNames[0];
  });
  const [products, setProducts] = React.useState(initialProducts);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [editingId, setEditingId] = React.useState(null);
  const [editForm, setEditForm] = React.useState({ stock: 0, price: 0, reorderLevel: 0 });
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showScannerModal, setShowScannerModal] = React.useState(false);
  const [scannerInput, setScannerInput] = React.useState("");
  const [scannerFeedback, setScannerFeedback] = React.useState(null);
  const [newProduct, setNewProduct] = React.useState({
    name: "",
    category: "Dairy",
    stock: 20,
    price: 50,
    reorderLevel: 10,
    sold: 0,
    expiryDate: "2026-06-30",
    barcode: "",
  });
  const scannerInputRef = React.useRef(null);

  const userDisplayName = getUserDisplayName(userSession?.user, "Manager");

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
    if (!showScannerModal) return undefined;
    const timer = window.setTimeout(() => scannerInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [showScannerModal]);

  React.useEffect(() => {
    if (!scannerFeedback) return undefined;
    const timer = window.setTimeout(() => setScannerFeedback(null), 2500);
    return () => window.clearTimeout(timer);
  }, [scannerFeedback]);

  const productsWithBranchStock = React.useMemo(() => {
    return products.map((product) => {
      const allocation = getBranchAllocation(product, branchNames, branchRatios);
      const branchStock = allocation[selectedBranch] || 0;
      return {
        ...product,
        branchAllocation: allocation,
        branchStock,
        status: getStatus(branchStock, product.reorderLevel || 10),
      };
    });
  }, [products, branchNames, branchRatios, selectedBranch]);

  const branchSummaries = React.useMemo(() => {
    return branchNames.map((branchName) => {
      const stock = productsWithBranchStock.reduce((sum, product) => sum + (product.branchAllocation[branchName] || 0), 0);
      const lowItems = productsWithBranchStock.filter((product) => {
        const branchStock = product.branchAllocation[branchName] || 0;
        return branchStock <= Math.max(1, Math.ceil((product.reorderLevel || 10) / branchNames.length));
      }).length;
      return { branchName, stock, lowItems };
    });
  }, [branchNames, branchNames.length, productsWithBranchStock]);

  const activeSummary = branchSummaries.find((summary) => summary.branchName === selectedBranch) || branchSummaries[0];
  const categories = ["all", ...new Set(products.map((product) => product.category))];
  const filteredProducts = productsWithBranchStock.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const totalValue = filteredProducts.reduce((sum, product) => sum + product.branchStock * product.price, 0);

  const handleBack = () => {
    const fallbackTier = normalizeBusinessTier(getDashboardTierFromUser(userSession?.user) || normalizedTier);
    setActiveTab(`dashboard-${fallbackTier}`);
  };

  const handleBranchSelect = (branchName) => {
    setSelectedBranch(branchName);
    setEditingId(null);
    sessionStorage.setItem("inventra_inventory_branch", branchName);
  };

  const handleStartEdit = (product) => {
    setEditingId(product.id);
    setEditForm({ stock: product.branchStock, price: product.price, reorderLevel: product.reorderLevel || 10 });
  };

  const handleSaveEdit = (id) => {
    const currentProduct = productsWithBranchStock.find((product) => product.id === id);
    setProducts((current) => current.map((product) => {
      if (product.id !== id) return product;
      const nextBranchStock = Number(editForm.stock);
      const nextTotalStock = Math.max(0, Number(product.stock || 0) + nextBranchStock - Number(currentProduct?.branchStock || 0));
      return {
        ...product,
        stock: nextTotalStock,
        price: Number(editForm.price),
        reorderLevel: Number(editForm.reorderLevel),
      };
    }));
    setEditingId(null);
  };

  const handleAddProduct = (event) => {
    event.preventDefault();
    const nextProduct = {
      ...newProduct,
      id: Math.max(0, ...products.map((product) => product.id)) + 1,
      stock: Number(newProduct.stock),
      price: Number(newProduct.price),
      reorderLevel: Number(newProduct.reorderLevel),
      barcode: String(newProduct.barcode || `${Date.now()}`).trim(),
    };
    setProducts((current) => [...current, nextProduct]);
    setNewProduct({
      name: "",
      category: "Dairy",
      stock: 20,
      price: 50,
      reorderLevel: 10,
      sold: 0,
      expiryDate: "2026-06-30",
      barcode: "",
    });
    setShowAddModal(false);
  };

  const handleScanBarcode = (barcodeValue) => {
    const trimmed = barcodeValue.trim();
    if (!trimmed) return;
    const product = products.find((item) => item.barcode === trimmed);
    if (product) {
      setSearchTerm(product.name);
      setScannerFeedback({ status: "success", message: `Found ${product.name} in inventory.` });
    } else {
      setScannerFeedback({ status: "error", message: `Barcode "${trimmed}" is not registered.` });
    }
    setScannerInput("");
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
              <span className="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-700">Inventory Operations</span>
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
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Branch Inventory</span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5 leading-tight">Inventory Rail</h2>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
            </div>
            <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">Choose a branch to inspect local stock, reorder pressure, and shelf value.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Units</div>
                <div className="mt-1 text-[11px] font-black text-slate-800 leading-tight">{activeSummary?.stock || 0}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Low Items</div>
                <div className={`mt-1 text-[11px] font-black leading-tight ${(activeSummary?.lowItems || 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}>{activeSummary?.lowItems || 0}</div>
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
                    isActive ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />}
                  <span className="block text-sm font-black text-slate-950">{summary.branchName}</span>
                  <span className={`block text-[10px] font-black uppercase tracking-wider mt-1 ${summary.lowItems > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {summary.stock} units | {summary.lowItems} low
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
            <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Inventory Command Desk</span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mt-1">{selectedBranch} Stock Ledger</h2>
                <p className="text-xs md:text-sm font-semibold text-slate-500 leading-relaxed max-w-2xl mt-3">
                  Branch-specific SKU visibility with local stock counts, threshold status, expiry context, and editable inventory controls.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    + Add Product
                  </button>
                  <button
                    onClick={() => setShowScannerModal(true)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer"
                  >
                    Scan Barcode (F8)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 min-w-0 lg:min-w-[430px]">
                {[
                  ["Local Units", activeSummary?.stock || 0],
                  ["Shelf Value", `₹${totalValue.toLocaleString("en-IN")}`],
                  ["Low Signals", activeSummary?.lowItems || 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                    <span className="block text-lg font-black mt-1">{value}</span>
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
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category === "all" ? "All Categories" : category}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Barcode</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-center">Branch Stock</th>
                    <th className="px-4 py-3 text-center">Threshold</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => {
                    const isEditing = editingId === product.id;
                    return (
                      <tr key={product.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-4">
                          <span className="block font-black text-slate-950">{product.name}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Expires {product.expiryDate || "N/A"}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{product.category}</span>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs font-bold text-slate-500">{product.barcode || "N/A"}</td>
                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            <input value={editForm.price} type="number" onChange={(event) => setEditForm({ ...editForm, price: event.target.value })} className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs font-black outline-none" />
                          ) : (
                            <span className="font-black">₹{product.price}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isEditing ? (
                            <input value={editForm.stock} type="number" onChange={(event) => setEditForm({ ...editForm, stock: event.target.value })} className="mx-auto block w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-black outline-none" />
                          ) : (
                            <span className="font-black">{product.branchStock} units</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isEditing ? (
                            <input value={editForm.reorderLevel} type="number" onChange={(event) => setEditForm({ ...editForm, reorderLevel: event.target.value })} className="mx-auto block w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-black outline-none" />
                          ) : (
                            <span className="font-bold text-slate-500">{product.reorderLevel || 10}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                            product.status === "Critical" ? "bg-rose-50 border-rose-200 text-rose-700" :
                            product.status === "Low Stock" ? "bg-amber-50 border-amber-200 text-amber-700" :
                            product.status === "Overstock" ? "bg-orange-50 border-orange-200 text-orange-700" :
                            "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}>{product.status}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleSaveEdit(product.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">Save</button>
                              <button onClick={() => setEditingId(null)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => handleStartEdit(product)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">Edit</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Inventory Intake</span>
                <h3 className="text-xl font-black text-slate-950 mt-1">Add New Product</h3>
                <p className="text-xs font-semibold text-slate-500 mt-2">Register product details, stock threshold, expiry, and barcode for scanner workflows.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-900 cursor-pointer">Close</button>
            </div>

            <form onSubmit={handleAddProduct} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Product Name</span>
                <input required value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} placeholder="e.g. Soy Milk 1L" className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:bg-white" />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Category</span>
                <select value={newProduct.category} onChange={(event) => setNewProduct({ ...newProduct, category: event.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none">
                  {["Dairy", "Bakery", "Snacks", "Beverages", "Other"].map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Barcode</span>
                <input value={newProduct.barcode} onChange={(event) => setNewProduct({ ...newProduct, barcode: event.target.value })} placeholder="Scan or enter barcode" className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono font-bold outline-none focus:border-emerald-300 focus:bg-white" />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Stock Qty</span>
                <input required type="number" value={newProduct.stock} onChange={(event) => setNewProduct({ ...newProduct, stock: event.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none" />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Unit Price</span>
                <input required type="number" value={newProduct.price} onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none" />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reorder Min</span>
                <input required type="number" value={newProduct.reorderLevel} onChange={(event) => setNewProduct({ ...newProduct, reorderLevel: event.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none" />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Expiry Date</span>
                <input type="date" value={newProduct.expiryDate} onChange={(event) => setNewProduct({ ...newProduct, expiryDate: event.target.value })} className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none" />
              </label>
              <button type="submit" className="md:col-span-2 rounded-xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-700 transition-all cursor-pointer">
                Create Product
              </button>
            </form>
          </div>
        </div>
      )}

      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-400">Barcode Scanner</span>
                <h3 className="text-xl font-black mt-1">Inventory Scan Terminal</h3>
                <p className="text-xs font-semibold text-slate-400 mt-1">Use a hardware scanner, type a code, or simulate a product scan.</p>
              </div>
              <button onClick={() => { setShowScannerModal(false); setScannerFeedback(null); }} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-slate-300 hover:text-white cursor-pointer">Close</button>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
              <div className="relative min-h-52 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden grid place-items-center">
                <div className="absolute inset-x-8 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.9)]" />
                <div className="text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 grid place-items-center text-2xl font-black text-emerald-300">|||</div>
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Scanner Ready</p>
                </div>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {products.slice(0, 8).map((product) => (
                  <button key={product.id} onClick={() => handleScanBarcode(product.barcode)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-left hover:border-emerald-400/50 cursor-pointer">
                    <span className="block text-xs font-black text-white">{product.name}</span>
                    <span className="block text-[10px] font-mono font-bold text-slate-500 mt-0.5">{product.barcode}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={(event) => { event.preventDefault(); handleScanBarcode(scannerInput); }} className="mt-4 flex gap-2">
              <input ref={scannerInputRef} value={scannerInput} onChange={(event) => setScannerInput(event.target.value)} placeholder="Enter barcode or wedge scan here..." className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-mono font-bold text-white outline-none focus:border-emerald-400" />
              <button type="submit" className="rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-950 cursor-pointer">Scan</button>
            </form>

            {scannerFeedback && (
              <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-black ${scannerFeedback.status === "success" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-rose-400/40 bg-rose-400/10 text-rose-300"}`}>
                {scannerFeedback.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

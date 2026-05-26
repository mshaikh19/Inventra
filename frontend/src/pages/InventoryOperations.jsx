import React from "react";
import {
  getDashboardTierFromUser,
  getTierBadgeLabel,
  getUserDisplayName,
  normalizeBusinessTier,
} from "../utils/dashboard";
import {
  createBranchInventoryItem,
  deleteBranchInventoryItem,
  getBranchInventory,
  getBranchNetwork,
  getUserBranches,
  updateBranchInventoryItem,
} from "../utils/branches";
import {
  hydrateInventoryProducts,
  loadScopedInventoryProducts,
  normalizeInventoryProducts,
  saveScopedInventoryProducts,
} from "../utils/inventory";

const getStatus = (stock, reorderLevel) => {
  if (stock <= Math.max(1, reorderLevel * 0.3)) return "Critical";
  if (stock <= reorderLevel) return "Low Stock";
  if (stock >= reorderLevel * 5) return "Overstock";
  return "Healthy";
};

const summarizeInventoryItems = (items = []) => {
  const normalizedItems = normalizeInventoryProducts(items);
  const stock = normalizedItems.reduce(
    (sum, item) => sum + Number(item.stock || 0),
    0,
  );
  const lowItems = normalizedItems.filter(
    (item) =>
      Number(item.stock || 0) <= Math.max(1, Number(item.reorderLevel || 10)),
  ).length;
  return { stock, lowItems };
};

export default function InventoryOperations({ tier = "small", setActiveTab }) {
  const normalizedTier = normalizeBusinessTier(tier);
  const [branchNames, setBranchNames] = React.useState(() =>
    getBranchNetwork(normalizedTier),
  );
  const [branchSummariesMap, setBranchSummariesMap] = React.useState({});
  const [isLoadingInventory, setIsLoadingInventory] = React.useState(false);
  const [inventoryNotice, setInventoryNotice] = React.useState(
    "Inventory starts empty for new branches.",
  );
  const [inventoryError, setInventoryError] = React.useState("");
  const skipNextInventorySaveRef = React.useRef(false);
  const tierAccent =
    normalizedTier === "medium"
      ? "#D97706"
      : normalizedTier === "large"
        ? "#059669"
        : "#0284C7";
  const tierBadgeLabel = getTierBadgeLabel(normalizedTier);

  const userSession = (() => {
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
  })();

  const [selectedBranch, setSelectedBranch] = React.useState(() => {
    if (typeof window === "undefined") return branchNames[0];
    const saved = sessionStorage.getItem("inventra_inventory_branch");
    return branchNames.includes(saved) ? saved : branchNames[0];
  });
  const [products, setProducts] = React.useState(() =>
    loadScopedInventoryProducts([], selectedBranch),
  );
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [editingId, setEditingId] = React.useState(null);
  const [editForm, setEditForm] = React.useState({
    quantity: 0,
    selling_price: 0,
    minimum_stock: 0,
  });
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showScannerModal, setShowScannerModal] = React.useState(false);
  const [scannerInput, setScannerInput] = React.useState("");
  const [scannerFeedback, setScannerFeedback] = React.useState(null);
  const [newProduct, setNewProduct] = React.useState({
    product_name: "",
    category: "Dairy",
    quantity: 0,
    purchase_price: 0,
    selling_price: 0,
    minimum_stock: 0,
    maximum_stock: 0,
    unit: "Units",
    barcode: "",
    sku: "",
    expiry_date: "",
  });
  const scannerInputRef = React.useRef(null);

  const loadBranchInventory = React.useCallback(
    async (branchName) => {
      if (!branchName) return;
      setIsLoadingInventory(true);
      setInventoryError("");
      try {
        const payload = await getBranchInventory(branchName);
        const nextProducts = hydrateInventoryProducts(payload, []);
        skipNextInventorySaveRef.current = true;
        setProducts(nextProducts);
        saveScopedInventoryProducts(nextProducts, branchName);
        setBranchSummariesMap((current) => ({
          ...current,
          [branchName]: summarizeInventoryItems(nextProducts),
        }));
        setInventoryNotice(
          nextProducts.length > 0
            ? `Loaded ${nextProducts.length} item(s) for ${branchName}.`
            : `${branchName} inventory is empty. Add the first item to begin.`,
        );
      } catch (error) {
        const cachedProducts = loadScopedInventoryProducts([], branchName);
        skipNextInventorySaveRef.current = true;
        setProducts(cachedProducts);
        setInventoryError(
          error?.message || "Unable to load branch inventory from the server.",
        );
        setInventoryNotice(
          cachedProducts.length > 0
            ? `Loaded cached inventory for ${branchName}.`
            : `${branchName} inventory is empty.`,
        );
      } finally {
        setIsLoadingInventory(false);
      }
    },
    [
      setBranchSummariesMap,
      setInventoryError,
      setInventoryNotice,
      setIsLoadingInventory,
      setProducts,
    ],
  );

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const data = await getUserBranches();
        if (cancelled || !data || !Array.isArray(data.branches)) return;

        const branches = data.branches;
        const names = branches.map((branch) => branch.branch_name);
        const fallbackNames =
          names.length > 0 ? names : getBranchNetwork(normalizedTier);
        setBranchNames(fallbackNames);

        const nextBranch = fallbackNames.includes(selectedBranch)
          ? selectedBranch
          : fallbackNames[0] || selectedBranch;
        if (nextBranch !== selectedBranch) {
          setSelectedBranch(nextBranch);
        }

        await loadBranchInventory(nextBranch);

        const summaries = await Promise.all(
          branches.map(async (branch) => {
            try {
              const payload = await getBranchInventory(branch.branch_name);
              return [
                branch.branch_name,
                summarizeInventoryItems(hydrateInventoryProducts(payload, [])),
              ];
            } catch {
              return [branch.branch_name, { stock: 0, lowItems: 0 }];
            }
          }),
        );

        if (!cancelled) {
          setBranchSummariesMap(Object.fromEntries(summaries));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load branches from DB:", error);
          setInventoryError(error?.message || "Failed to load branch network.");
          setBranchNames(getBranchNetwork(normalizedTier));
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [loadBranchInventory, normalizedTier, selectedBranch]);

  React.useEffect(() => {
    if (!selectedBranch) return;
    sessionStorage.setItem("inventra_inventory_branch", selectedBranch);
  }, [selectedBranch]);

  const playScanSound = (isSuccess) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (isSuccess) {
        // Success Beep: nice 1000Hz pure sine wave for 100ms
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        // Error Buzz: low-pitch dual-tone square wave at 120Hz for 250ms
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn("Web Audio API not supported or blocked: ", e);
    }
  };

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
      const branchStock = Number(product.stock || 0);
      return {
        ...product,
        branchStock,
        status: getStatus(branchStock, product.reorderLevel || 10),
      };
    });
  }, [products]);

  const branchSummaries = React.useMemo(() => {
    return branchNames
      .map((branchName) => {
        if (branchName === selectedBranch) {
          return (
            branchSummariesMap[branchName] ||
            summarizeInventoryItems(productsWithBranchStock)
          );
        }
        return branchSummariesMap[branchName] || { stock: 0, lowItems: 0 };
      })
      .map((summary, index) => ({
        branchName: branchNames[index],
        ...summary,
      }));
  }, [
    branchNames,
    branchSummariesMap,
    productsWithBranchStock,
    selectedBranch,
  ]);

  const activeSummary = branchSummaries.find(
    (summary) => summary.branchName === selectedBranch,
  ) || { stock: 0, lowItems: 0 };
  const categories = [
    "all",
    ...new Set(products.map((product) => product.category)),
  ];
  const filteredProducts = productsWithBranchStock.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const totalValue = filteredProducts.reduce(
    (sum, product) => sum + product.branchStock * product.price,
    0,
  );

  const handleBack = () => {
    const fallbackTier = normalizeBusinessTier(
      getDashboardTierFromUser(userSession?.user) || normalizedTier,
    );
    setActiveTab(`dashboard-${fallbackTier}`);
  };

  const handleBranchSelect = (branchName) => {
    setSelectedBranch(branchName);
    setEditingId(null);
    void loadBranchInventory(branchName);
  };

  React.useEffect(() => {
    if (!selectedBranch) return;
    if (skipNextInventorySaveRef.current) {
      skipNextInventorySaveRef.current = false;
      return;
    }
    saveScopedInventoryProducts(products, selectedBranch);
  }, [products, selectedBranch]);

  const handleStartEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      quantity: product.branchStock,
      selling_price: product.price,
      minimum_stock: product.reorderLevel || 10,
    });
  };

  const handleSaveEdit = async (id) => {
    const currentProduct = productsWithBranchStock.find(
      (product) => product.id === id,
    );
    if (!currentProduct) return;

    const nextPayload = {
      product_name: currentProduct.name,
      category: currentProduct.category,
      barcode: currentProduct.barcode || undefined,
      quantity: Number(editForm.quantity),
      selling_price: Number(editForm.selling_price),
      minimum_stock: Number(editForm.minimum_stock),
      sku: currentProduct.sku || undefined,
      expiry_date: currentProduct.expiryDate || undefined,
    };

    try {
      const response = await updateBranchInventoryItem(
        selectedBranch,
        currentProduct.id,
        nextPayload,
      );
      const nextProducts = hydrateInventoryProducts(
        response.inventory || response.items || [],
        [],
      );
      setProducts(nextProducts);
      saveScopedInventoryProducts(nextProducts, selectedBranch);
      setBranchSummariesMap((current) => ({
        ...current,
        [selectedBranch]: summarizeInventoryItems(nextProducts),
      }));
      setInventoryNotice(`Updated ${currentProduct.name}.`);
      setEditingId(null);
    } catch (error) {
      setInventoryError(error?.message || "Unable to update inventory item.");
    }
  };

  const handleAddProduct = async (event) => {
    event.preventDefault();
    const payload = {
      product_name: String(newProduct.product_name || "").trim(),
      category: String(newProduct.category || "Uncategorized").trim(),
      quantity: Number(newProduct.quantity || 0),
      purchase_price: Number(newProduct.purchase_price || 0),
      selling_price: Number(newProduct.selling_price || 0),
      minimum_stock: Number(newProduct.minimum_stock || 0),
      maximum_stock: Number(newProduct.maximum_stock || 0),
      unit: String(newProduct.unit || "Units").trim(),
      barcode: String(newProduct.barcode || "").trim() || undefined,
      sku: String(newProduct.sku || "").trim() || undefined,
      expiry_date: newProduct.expiry_date || undefined,
    };

    try {
      const response = await createBranchInventoryItem(selectedBranch, payload);
      const nextProducts = hydrateInventoryProducts(
        response.inventory || response.items || [],
        [],
      );
      setProducts(nextProducts);
      saveScopedInventoryProducts(nextProducts, selectedBranch);
      setBranchSummariesMap((current) => ({
        ...current,
        [selectedBranch]: summarizeInventoryItems(nextProducts),
      }));
      setNewProduct({
        product_name: "",
        category: "Dairy",
        quantity: 0,
        purchase_price: 0,
        selling_price: 0,
        minimum_stock: 0,
        maximum_stock: 0,
        unit: "Units",
        barcode: "",
        sku: "",
        expiry_date: "",
      });
      setShowAddModal(false);
      setInventoryNotice(`Added ${payload.product_name} to ${selectedBranch}.`);
    } catch (error) {
      setInventoryError(error?.message || "Unable to add inventory item.");
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    try {
      const response = await deleteBranchInventoryItem(
        selectedBranch,
        product.id,
      );
      const nextProducts = hydrateInventoryProducts(
        response.inventory || response.items || [],
        [],
      );
      setProducts(nextProducts);
      saveScopedInventoryProducts(nextProducts, selectedBranch);
      setBranchSummariesMap((current) => ({
        ...current,
        [selectedBranch]: summarizeInventoryItems(nextProducts),
      }));
      setInventoryNotice(`Deleted ${product.name}.`);
      if (editingId === product.id) {
        setEditingId(null);
      }
    } catch (error) {
      setInventoryError(error?.message || "Unable to delete inventory item.");
    }
  };

  const handleScanBarcode = (barcodeValue) => {
    const trimmed = barcodeValue.trim();
    if (!trimmed) return;
    const product = products.find((item) => item.barcode === trimmed);
    if (product) {
      setSearchTerm(product.name);
      playScanSound(true);
      setScannerFeedback({
        status: "success",
        message: `Found ${product.name} in inventory.`,
      });
    } else {
      playScanSound(false);
      setScannerFeedback({
        status: "error",
        message: `Barcode "${trimmed}" is not registered.`,
      });
    }
    setScannerInput("");
  };

  return (
    <div className="min-h-screen bg-[#F6FAF8] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-5 lg:px-8 py-2.5">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-950 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                Dashboard
              </span>
            </button>
            <div className="hidden sm:block w-px h-7 bg-slate-200" />
            <div>
              <span className="text-[8px] font-black uppercase tracking-[0.22em] text-emerald-700">
                Inventory Operations
              </span>
              <h3 className="text-base md:text-lg font-black leading-tight">
                {selectedBranch}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {userDisplayName}
            </span>
            <span
              className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white"
              style={{ background: tierAccent }}
            >
              {tierBadgeLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="px-5 lg:px-8 xl:pl-85 py-4">
        <aside className="xl:fixed xl:left-0 xl:top-14.25 xl:h-[calc(100vh-57px)] xl:w-79 xl:flex xl:flex-col xl:overflow-hidden xl:border-r xl:border-slate-200 xl:bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_48%,#f8fafc_100%)] xl:px-4 xl:py-4 xl:shadow-[0_1px_3px_rgba(0,0,0,0.05)] mb-5 xl:mb-0">
          <div className="rounded-[28px] border border-slate-100 bg-white px-5 py-5 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Branch Inventory
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5 leading-tight">
                  Inventory Rail
                </h2>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
            </div>
            <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">
              Choose a branch to inspect local stock, reorder pressure, and
              shelf value.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Units
                </div>
                <div className="mt-1 text-[11px] font-black text-slate-800 leading-tight">
                  {activeSummary?.stock || 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Low Items
                </div>
                <div
                  className={`mt-1 text-[11px] font-black leading-tight ${(activeSummary?.lowItems || 0) > 0 ? "text-amber-600" : "text-emerald-600"}`}
                >
                  {activeSummary?.lowItems || 0}
                </div>
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
                    isActive
                      ? "border-emerald-500 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />
                  )}
                  <span className="block text-sm font-black text-slate-950">
                    {summary.branchName}
                  </span>
                  <span
                    className={`block text-[10px] font-black uppercase tracking-wider mt-1 ${summary.lowItems > 0 ? "text-amber-600" : "text-emerald-600"}`}
                  >
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
                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Inventory Command Desk
                </span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mt-1">
                  {selectedBranch} Stock Ledger
                </h2>
                <p className="text-xs md:text-sm font-semibold text-slate-500 leading-relaxed max-w-2xl mt-3">
                  Branch-specific SKU visibility with local stock counts,
                  threshold status, expiry context, and editable inventory
                  controls.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    {isLoadingInventory
                      ? "Syncing branch inventory"
                      : inventoryNotice}
                  </span>
                  {inventoryError ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-rose-700">
                      {inventoryError}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    + Add Inventory
                  </button>
                  <button
                    onClick={() => setShowScannerModal(true)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer"
                  >
                    Scan Barcode (F8)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 min-w-0 lg:min-w-107.5">
                {[
                  ["Local Units", activeSummary?.stock || 0],
                  ["Shelf Value", `₹${totalValue.toLocaleString("en-IN")}`],
                  ["Low Signals", activeSummary?.lowItems || 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"
                  >
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {label}
                    </span>
                    <span className="block text-lg font-black mt-1">
                      {value}
                    </span>
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
                  <option key={category} value={category}>
                    {category === "all" ? "All Categories" : category}
                  </option>
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
                          <span className="block font-black text-slate-950">
                            {product.name}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Expires {product.expiryDate || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs font-bold text-slate-500">
                          {product.barcode || "N/A"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            <input
                              value={editForm.selling_price}
                              type="number"
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  selling_price: event.target.value,
                                })
                              }
                              className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs font-black outline-none"
                            />
                          ) : (
                            <span className="font-black">₹{product.price}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isEditing ? (
                            <input
                              value={editForm.quantity}
                              type="number"
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  quantity: event.target.value,
                                })
                              }
                              className="mx-auto block w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-black outline-none"
                            />
                          ) : (
                            <span className="font-black">
                              {product.branchStock} units
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isEditing ? (
                            <input
                              value={editForm.minimum_stock}
                              type="number"
                              onChange={(event) =>
                                setEditForm({
                                  ...editForm,
                                  minimum_stock: event.target.value,
                                })
                              }
                              className="mx-auto block w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-black outline-none"
                            />
                          ) : (
                            <span className="font-bold text-slate-500">
                              {product.reorderLevel || 10}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                              product.status === "Critical"
                                ? "bg-rose-50 border-rose-200 text-rose-700"
                                : product.status === "Low Stock"
                                  ? "bg-amber-50 border-amber-200 text-amber-700"
                                  : product.status === "Overstock"
                                    ? "bg-orange-50 border-orange-200 text-orange-700"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                            }`}
                          >
                            {product.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleSaveEdit(product.id)}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleStartEdit(product)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product)}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                              >
                                Delete
                              </button>
                            </div>
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
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">
                  Inventory Intake
                </span>
                <h3 className="text-xl font-black text-slate-950 mt-1">
                  Add New Product
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-2">
                  Register product details, stock threshold, expiry, and barcode
                  for scanner workflows.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleAddProduct}
              className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <label className="block md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Product Name
                </span>
                <input
                  required
                  value={newProduct.product_name}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      product_name: event.target.value,
                    })
                  }
                  placeholder="e.g. Soy Milk 1L"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Category
                </span>
                <select
                  value={newProduct.category}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      category: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none"
                >
                  {["Dairy", "Bakery", "Snacks", "Beverages", "Other"].map(
                    (category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Barcode
                </span>
                <input
                  value={newProduct.barcode}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      barcode: event.target.value,
                    })
                  }
                  placeholder="Scan or enter barcode"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono font-bold outline-none focus:border-emerald-300 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Opening Qty
                </span>
                <input
                  required
                  type="number"
                  value={newProduct.quantity}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      quantity: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Unit Price
                </span>
                <input
                  required
                  type="number"
                  value={newProduct.selling_price}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      selling_price: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Reorder Min
                </span>
                <input
                  required
                  type="number"
                  value={newProduct.minimum_stock}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      minimum_stock: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Purchase Price
                </span>
                <input
                  type="number"
                  value={newProduct.purchase_price}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      purchase_price: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Maximum Qty
                </span>
                <input
                  type="number"
                  value={newProduct.maximum_stock}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      maximum_stock: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Unit
                </span>
                <input
                  value={newProduct.unit}
                  onChange={(event) =>
                    setNewProduct({ ...newProduct, unit: event.target.value })
                  }
                  placeholder="Units / Packs / Bottles"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Expiry Date
                </span>
                <input
                  type="date"
                  value={newProduct.expiry_date}
                  onChange={(event) =>
                    setNewProduct({
                      ...newProduct,
                      expiry_date: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none"
                />
              </label>
              <button
                type="submit"
                className="md:col-span-2 rounded-xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-700 transition-all cursor-pointer"
              >
                Create Product
              </button>
            </form>
          </div>
        </div>
      )}

      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)] text-slate-200 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <div>
                  <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-white">
                    INVENTORY BARCODE SCANNER
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Simulate scans or use hardware wedge
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowScannerModal(false);
                  setScannerFeedback(null);
                }}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scanning Viewport */}
            <div className="relative aspect-video max-w-sm w-full mx-auto rounded-2xl bg-slate-955 border border-slate-800 overflow-hidden flex items-center justify-center scanner-grid-pattern">
              {/* Sweeping Laser Line */}
              <div className="scan-laser-line" />

              {/* Corner Targets */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-rose-500 rounded-tl" />
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-rose-500 rounded-tr" />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-rose-500 rounded-bl" />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-rose-500 rounded-br" />

              {/* Central text indicator */}
              <div className="text-center z-20 pointer-events-none select-none">
                <div className="text-[9px] font-black uppercase text-rose-500 tracking-[0.25em] animate-pulse-soft">
                  CAMERA PREVIEW ACTIVE
                </div>
                <div className="text-[8px] font-bold text-slate-500 tracking-wider mt-1">
                  READY FOR EAN-13 TRANSMISSION
                </div>
              </div>
            </div>

            {/* Quick Simulation Options */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2 select-none">
                Click to Simulate Product Scan
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {products.map((p) => {
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleScanBarcode(p.barcode)}
                      className="flex items-center justify-between text-left p-2 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/85 hover:border-slate-700 transition-all text-xs font-semibold text-slate-300 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[11px] truncate">
                          {p.name}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono tracking-wider mt-0.5">
                          {p.barcode}
                        </div>
                      </div>
                      <span className="text-[8px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded shrink-0 uppercase tracking-widest ml-1 select-none">
                        Scan
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual scan form */}
            <div className="border-t border-slate-800 pt-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleScanBarcode(scannerInput);
                }}
                className="flex gap-2"
              >
                <input
                  ref={scannerInputRef}
                  type="text"
                  placeholder="Enter barcode or wedge scan here..."
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer select-none"
                >
                  Scan Code
                </button>
              </form>
            </div>

            {/* Scan Feedback notification */}
            {scannerFeedback && (
              <div
                className={`rounded-xl border p-3 flex items-start gap-2.5 animate-fade-in ${
                  scannerFeedback.status === "success"
                    ? "border-emerald-500/20 bg-emerald-950/40 text-emerald-300"
                    : "border-rose-500/20 bg-rose-950/40 text-rose-300"
                }`}
              >
                <span className="text-sm shrink-0">
                  {scannerFeedback.status === "success" ? "✓" : "⚠️"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest leading-none">
                    {scannerFeedback.status === "success"
                      ? "Scan Success"
                      : "Scan Error"}
                  </div>
                  <p className="text-[10.5px] font-bold mt-1 text-white truncate">
                    {scannerFeedback.message}
                  </p>
                </div>
              </div>
            )}

            {/* Close footer info */}
            <div className="text-center text-[9px] font-bold text-slate-500 tracking-wider">
              Press <span className="text-slate-400 font-black">F8</span>{" "}
              anytime to dismiss
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

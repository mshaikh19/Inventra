import React, { useMemo, useState } from "react";



const BRANCHES_BY_TIER = {

  small: ["Main Store"],

  medium: ["Mumbai Hub", "Delhi Branch", "Bangalore Branch", "Pune Depot"],

  large: ["Mumbai Hub", "Delhi Branch", "Bangalore Branch", "Pune Depot", "New York Hub", "London Branch", "Tokyo Depot", "Singapore Hub"],

};



const BRANCH_RATIOS_BY_TIER = {

  small: { "Main Store": 1 },

  medium: {

    "Mumbai Hub": 0.4,

    "Delhi Branch": 0.15,

    "Bangalore Branch": 0.25,

    "Pune Depot": 0.2,

  },

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



const getBranchAllocation = (product, branchNames, ratios) => {

  const totalStock = Number(product.stock || 0);

  let usedStock = 0;



  return branchNames.reduce((allocation, branchName, index) => {

    const isLastBranch = index === branchNames.length - 1;

    const branchStock = isLastBranch

      ? totalStock - usedStock

      : Math.floor(totalStock * (ratios[branchName] || 0));



    usedStock += branchStock;

    allocation[branchName] = Math.max(0, branchStock);

    return allocation;

  }, {});

};



export default function InventoryTable({ products, onUpdateProducts, tier = "small", tierAccent, tierAccentSoft }) {

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("all");

  const [selectedBranch, setSelectedBranch] = useState("all");

  const [showAddModal, setShowAddModal] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [editForm, setEditForm] = useState({ stock: 0, price: 0, reorderLevel: 0 });



  const [newProduct, setNewProduct] = useState({

    name: "",

    category: "Dairy",

    stock: 20,

    price: 50,

    reorderLevel: 10,

    sold: 0,

    expiryDate: "2026-06-30"

  });



  const normalizedTier = BRANCHES_BY_TIER[tier] ? tier : "small";

  const branchNames = BRANCHES_BY_TIER[normalizedTier];

  const branchRatios = BRANCH_RATIOS_BY_TIER[normalizedTier];



  const productsWithBranchStock = useMemo(() => {

    return products.map((product) => {

      const allocation = getBranchAllocation(product, branchNames, branchRatios);

      const visibleStock = selectedBranch === "all" ? product.stock : allocation[selectedBranch] || 0;



      return {

        ...product,

        branchAllocation: allocation,

        visibleStock,

      };

    });

  }, [products, branchNames, branchRatios, selectedBranch]);



  const branchSummaries = useMemo(() => {

    return branchNames.map((branchName) => {

      const stock = productsWithBranchStock.reduce((sum, product) => {

        return sum + (product.branchAllocation[branchName] || 0);

      }, 0);

      const lowItems = productsWithBranchStock.filter((product) => {

        const branchStock = product.branchAllocation[branchName] || 0;

        return branchStock <= Math.max(1, Math.ceil((product.reorderLevel || 10) / branchNames.length));

      }).length;



      return { branchName, stock, lowItems };

    });

  }, [branchNames, productsWithBranchStock]);



  const selectedBranchSummary = selectedBranch === "all"

    ? null

    : branchSummaries.find((summary) => summary.branchName === selectedBranch);



  const categories = ["all", ...new Set(products.map(p => p.category))];



  const handleSearch = (e) => setSearchTerm(e.target.value);

  const handleCategoryChange = (e) => setSelectedCategory(e.target.value);



  const filteredProducts = productsWithBranchStock.filter(p => {

    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 

                          p.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;

    return matchesSearch && matchesCategory;

  });



  const handleStartEdit = (p) => {

    setEditingId(p.id);

    setEditForm({ stock: p.visibleStock, price: p.price, reorderLevel: p.reorderLevel || 10 });

  };



  const handleSaveEdit = (id) => {

    const visibleProduct = productsWithBranchStock.find(p => p.id === id);



    onUpdateProducts(products.map(p => {

      if (p.id === id) {

        const nextVisibleStock = Number(editForm.stock);

        const nextTotalStock = selectedBranch === "all"

          ? nextVisibleStock

          : Math.max(0, Number(p.stock || 0) + nextVisibleStock - Number(visibleProduct?.visibleStock || 0));



        return { 

          ...p, 

          stock: nextTotalStock, 

          price: Number(editForm.price),

          reorderLevel: Number(editForm.reorderLevel)

        };

      }

      return p;

    }));

    setEditingId(null);

  };



  const handleAddProduct = (e) => {

    e.preventDefault();

    const productToAdd = {

      ...newProduct,

      id: products.length + 1,

      stock: Number(newProduct.stock),

      price: Number(newProduct.price),

      reorderLevel: Number(newProduct.reorderLevel)

    };

    onUpdateProducts([...products, productToAdd]);

    setShowAddModal(false);

    setNewProduct({

      name: "",

      category: "Dairy",

      stock: 20,

      price: 50,

      reorderLevel: 10,

      sold: 0,

      expiryDate: "2026-06-30"

    });

  };



  return (

    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] text-left">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">

        <div>

          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-450">Database Controls</span>

          <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-1">

            {selectedBranch === "all" ? "Live Inventory Management" : `${selectedBranch} Inventory`}

          </h2>

          <p className="text-xs text-slate-500 font-semibold mt-1">

            {selectedBranch === "all"

              ? "View consolidated stock or switch into any branch ledger."

              : `${selectedBranchSummary?.stock || 0} units tracked locally across ${filteredProducts.length} SKU records.`}

          </p>

        </div>

        <button 

          onClick={() => setShowAddModal(true)}

          className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition-all duration-300 hover:scale-[1.02] shadow-sm cursor-pointer"

          style={{ background: tierAccent }}

        >

          + Add Product

        </button>

      </div>



      {/* Filters bar */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">

        <div className="relative">

          <input 

            type="text" 

            placeholder="Search products..." 

            value={searchTerm}

            onChange={handleSearch}

            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 placeholder-slate-400 font-semibold text-sm outline-none transition-all"

          />

          <svg className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">

            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />

          </svg>

        </div>



        <div>

          <select 

            value={selectedCategory} 

            onChange={handleCategoryChange}

            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-450 text-slate-800 font-semibold text-sm outline-none transition-all cursor-pointer"

          >

            <option value="all">All Categories</option>

            {categories.filter(c => c !== "all").map(c => (

              <option key={c} value={c}>{c}</option>

            ))}

          </select>

        </div>

        <div>

          <select

            value={selectedBranch}

            onChange={(e) => {

              setSelectedBranch(e.target.value);

              setEditingId(null);

            }}

            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-450 text-slate-800 font-semibold text-sm outline-none transition-all cursor-pointer"

          >

            <option value="all">All Branches - Consolidated</option>

            {branchNames.map(branchName => (

              <option key={branchName} value={branchName}>{branchName}</option>

            ))}

          </select>

        </div>

      </div>



      {branchNames.length > 1 && (

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">

          {branchSummaries.map((summary) => {

            const isActive = selectedBranch === summary.branchName;

            const healthTone = summary.lowItems > 2 ? "text-amber-600" : "text-emerald-600";



            return (

              <button

                key={summary.branchName}

                type="button"

                onClick={() => {

                  setSelectedBranch(summary.branchName);

                  setEditingId(null);

                }}

                className={`relative overflow-hidden text-left rounded-2xl border px-5 py-5 min-h-32 transition-all cursor-pointer ${

                  isActive

                    ? "bg-emerald-50/70 border-emerald-500 shadow-[0_16px_36px_rgba(16,185,129,0.12)]"

                    : "bg-slate-50 border-slate-200 hover:bg-emerald-50/40 hover:border-emerald-300"

                }`}

              >

                {isActive && <span className="absolute right-8 top-0 h-2 w-20 rounded-b-full bg-emerald-500" />}

                <div className="flex items-start justify-between gap-3">

                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Branch Ledger</span>

                  {isActive && <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Manage Hub &rarr;</span>}

                </div>

                <span className="block text-base font-black mt-5 text-slate-950">{summary.branchName}</span>

                <div className="grid grid-cols-2 gap-4 mt-7">

                  <span>

                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Stock Units</span>

                    <span className="block text-sm font-black text-slate-700 mt-1">{summary.stock} units</span>

                  </span>

                  <span className="text-right">

                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Health</span>

                    <span className={`block text-sm font-black mt-1 ${healthTone}`}>{summary.lowItems} low</span>

                  </span>

                </div>

              </button>

            );

          })}

        </div>

      )}



      {/* Table grid */}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">

        <table className="w-full text-left border-collapse">

          <thead>

            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider">

              <th className="py-4 px-5">Product Details</th>

              <th className="py-4 px-5">Category</th>

              <th className="py-4 px-5 text-right">Unit Price</th>

              {selectedBranch === "all" && <th className="py-4 px-5">Branch Split</th>}

              <th className="py-4 px-5 text-center">Stock Status</th>

              <th className="py-4 px-5 text-center">Min Threshold</th>

              <th className="py-4 px-5 text-right">Actions</th>

            </tr>

          </thead>

          <tbody className="divide-y divide-slate-100 text-sm font-semibold">

            {filteredProducts.length === 0 ? (

              <tr>

                <td colSpan={selectedBranch === "all" ? 7 : 6} className="py-8 text-center text-slate-400">No matching products found in stock database.</td>

              </tr>

            ) : (

              filteredProducts.map(p => {

                const isEditing = editingId === p.id;

                const branchThreshold = selectedBranch === "all"

                  ? (p.reorderLevel || 10)

                  : Math.max(1, Math.ceil((p.reorderLevel || 10) / branchNames.length));

                const isLowStock = p.visibleStock <= branchThreshold;

                const isModerate = p.visibleStock < Math.max(8, branchThreshold * 2);

                

                return (

                  <tr key={p.id} className="hover:bg-slate-50/80 transition-all group text-slate-700">

                    <td className="py-4 px-5">

                      <div className="font-bold text-slate-900 group-hover:translate-x-0.5 transition-transform">{p.name}</div>

                      <div className="text-xs text-slate-400 mt-0.5 font-medium">Expires: {p.expiryDate || "N/A"}</div>

                    </td>

                    <td className="py-4 px-5">

                      <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-black bg-slate-50 border border-slate-200 text-slate-650">

                        {p.category}

                      </span>

                    </td>

                    <td className="py-4 px-5 text-right">

                      {isEditing ? (

                        <input 

                          type="number" 

                          value={editForm.price} 

                          onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}

                          className="w-20 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-900 text-right outline-none text-xs font-black"

                        />

                      ) : (

                        <span className="text-slate-950 font-bold">₹{p.price}</span>

                      )}

                    </td>

                    {selectedBranch === "all" && (

                      <td className="py-4 px-5 min-w-52">

                        <div className="space-y-1.5">

                          {branchNames.map(branchName => {

                            const branchStock = p.branchAllocation[branchName] || 0;

                            const branchWidth = p.stock > 0 ? Math.max(4, (branchStock / p.stock) * 100) : 0;



                            return (

                              <button

                                type="button"

                                key={branchName}

                                onClick={() => {

                                  setSelectedBranch(branchName);

                                  setEditingId(null);

                                }}

                                className="grid grid-cols-[88px_1fr_36px] items-center gap-2 w-full text-left cursor-pointer group/branch"

                              >

                                <span className="text-[10px] font-black text-slate-500 truncate group-hover/branch:text-slate-900">{branchName}</span>

                                <span className="h-1.5 rounded-full bg-slate-100 overflow-hidden">

                                  <span

                                    className="block h-full rounded-full"

                                    style={{ width: `${branchWidth}%`, backgroundColor: tierAccent }}

                                  />

                                </span>

                                <span className="text-[10px] font-black text-slate-500 text-right">{branchStock}</span>

                              </button>

                            );

                          })}

                        </div>

                      </td>

                    )}

                    <td className="py-4 px-5 text-center">

                      {isEditing ? (

                        <input 

                          type="number" 

                          value={editForm.stock} 

                          onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}

                          className="w-20 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-900 text-center outline-none text-xs font-black mx-auto block"

                        />

                      ) : (

                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-bold"

                          style={{

                            background: isLowStock ? '#FFF5F5' : isModerate ? '#FFFBEB' : '#ECFDF5',

                            color: isLowStock ? '#E11D48' : isModerate ? '#D97706' : '#059669',

                            borderColor: isLowStock ? '#FECDD3' : isModerate ? '#FDE68A' : '#A7F3D0'

                          }}

                        >

                          <span className={`h-1.5 w-1.5 rounded-full ${isLowStock ? 'bg-rose-500 animate-pulse' : isModerate ? 'bg-amber-500' : 'bg-emerald-500'}`} />

                          <span>{p.visibleStock} units</span>

                        </div>

                      )}

                    </td>

                    <td className="py-4 px-5 text-center">

                      {isEditing ? (

                        <input 

                          type="number" 

                          value={editForm.reorderLevel} 

                          onChange={(e) => setEditForm({ ...editForm, reorderLevel: e.target.value })}

                          className="w-16 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-900 text-center outline-none text-xs font-black mx-auto block"

                        />

                      ) : (

                        <span className="text-slate-400">{p.reorderLevel || 10}</span>

                      )}

                    </td>

                    <td className="py-4 px-5 text-right">

                      {isEditing ? (

                        <div className="flex justify-end gap-2">

                          <button 

                            onClick={() => handleSaveEdit(p.id)}

                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer shadow-sm"

                          >

                            Save

                          </button>

                          <button 

                            onClick={() => setEditingId(null)}

                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-655 text-xs font-bold cursor-pointer"

                          >

                            Cancel

                          </button>

                        </div>

                      ) : (

                        <button 

                          onClick={() => handleStartEdit(p)}

                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-550 hover:text-slate-900 hover:bg-slate-50 text-xs cursor-pointer hover:border-slate-350 transition-all font-bold shadow-sm"

                        >

                          Edit

                        </button>

                      )}

                    </td>

                  </tr>

                );

              })

            )}

          </tbody>

        </table>

      </div>



      {/* Add New Product Modal */}

      {showAddModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">

          <div className="w-full max-w-md bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative">

            <button 

              onClick={() => setShowAddModal(false)}

              className="absolute top-4 right-4 text-slate-450 hover:text-slate-800 p-2 cursor-pointer transition-colors"

            >

              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />

              </svg>

            </button>

            

            <h3 className="text-lg font-black text-slate-900 mb-4">Add New Inventory Item</h3>

            <form onSubmit={handleAddProduct} className="space-y-4 text-sm font-semibold text-slate-600">

              <div className="flex flex-col gap-1">

                <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Product Name</label>

                <input 

                  type="text" 

                  required

                  value={newProduct.name}

                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}

                  placeholder="e.g. Soy Milk 1L"

                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 outline-none"

                />

              </div>



              <div className="grid grid-cols-2 gap-3">

                <div className="flex flex-col gap-1">

                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Category</label>

                  <select 

                    value={newProduct.category}

                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}

                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-800 outline-none cursor-pointer"

                  >

                    <option value="Dairy">Dairy</option>

                    <option value="Bakery">Bakery</option>

                    <option value="Snacks">Snacks</option>

                    <option value="Beverages">Beverages</option>

                    <option value="Other">Other</option>

                  </select>

                </div>

                

                <div className="flex flex-col gap-1">

                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Expiry Date</label>

                  <input 

                    type="date"

                    value={newProduct.expiryDate}

                    onChange={(e) => setNewProduct({ ...newProduct, expiryDate: e.target.value })}

                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-850 outline-none cursor-pointer"

                  />

                </div>

              </div>



              <div className="grid grid-cols-3 gap-3">

                <div className="flex flex-col gap-1">

                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Stock Qty</label>

                  <input 

                    type="number" 

                    required

                    value={newProduct.stock}

                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}

                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 outline-none text-center font-black"

                  />

                </div>

                

                <div className="flex flex-col gap-1">

                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Price (₹)</label>

                  <input 

                    type="number" 

                    required

                    value={newProduct.price}

                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}

                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 outline-none text-center font-black"

                  />

                </div>



                <div className="flex flex-col gap-1">

                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Reorder Min</label>

                  <input 

                    type="number" 

                    required

                    value={newProduct.reorderLevel}

                    onChange={(e) => setNewProduct({ ...newProduct, reorderLevel: e.target.value })}

                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 outline-none text-center font-black"

                  />

                </div>

              </div>



              <button 

                type="submit"

                className="w-full py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider text-white shadow-md cursor-pointer transition-all duration-300 hover:scale-[1.01] mt-4"

                style={{ background: tierAccent }}

              >

                Create Product Item

              </button>

            </form>

          </div>

        </div>

      )}

    </div>

  );

}


import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";

import "leaflet/dist/leaflet.css";
import CustomDropdown from "./CustomDropdown";

import L from "leaflet";



// Dynamic stock mapping helper for branches
const allocateStock = (p, branchesList) => {
  const allocation = {};
  const branches = branchesList || [];
  branches.forEach(b => {
    allocation[b] = 0;
  });
  
  if (!p || typeof p !== "object") return allocation;
  
  const pBranch = p.branchName || p.branch_name;
  if (pBranch && branches.includes(pBranch)) {
    allocation[pBranch] = p.stock;
  } else {
    if (branches.length > 0) {
      allocation[branches[0]] = p.stock;
    }
  }
  return allocation;
};



export default function LargeDashboard({ products, onUpdateProducts, tierAccent, tierAccentSoft, onOpenBranchPage, branchNetwork, branchesList: branchesListFromDB = [], isOwner = true }) {

  const branchesNames = branchNetwork?.length
    ? branchNetwork
    : (branchesListFromDB && branchesListFromDB.length > 0 ? branchesListFromDB.map(b => b.branch_name) : []);

  const branchesList = branchesNames;

  const branchCapacityLimits = {};
  branchesList.forEach((b, i) => {
    branchCapacityLimits[b.branch_name || `Branch ${i + 1}`] = 200 + (i * 50);
  });



  const getShelfForProduct = (productName) => {
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
  };



  // Navigation View State: null means Consolidated View, otherwise Branch Name
  const [selectedBranchPage, setSelectedBranchPage] = useState(null);
  const [activeBranch, setActiveBranch] = useState(() => branchesNames[0] || "");
  const [hoveredNode, setHoveredNode] = useState(null);

  // Stateful Branch-Specific Inventory Allocations
  const [branchStocksMap, setBranchStocksMap] = useState(() => {
    const initialMap = {};
    products.forEach(p => {
      initialMap[p.id] = allocateStock(p, branchesList);
    });
    return initialMap;
  });

  const [transferForm, setTransferForm] = useState(() => {
    const src = branchesList[0] || "";
    const dest = branchesList[1] || branchesList[0] || "";
    return {
      source: src,
      destination: dest,
      productId: products[0]?.id || "",
      quantity: 10
    };
  });

  const [transferStatus, setTransferStatus] = useState("idle"); // idle, sending, success
  const [transferError, setTransferError] = useState("");
  const [forecastBranch, setForecastBranch] = useState(() => branchesList[0] || "");

  // Sync transferForm source/destination when branches change
  useEffect(() => {
    if (branchesList.length > 0) {
      setTransferForm(prev => {
        const updates = {};
        if (!prev.source || !branchesList.includes(prev.source)) {
          updates.source = branchesList[0];
        }
        if (!prev.destination || !branchesList.includes(prev.destination)) {
          updates.destination = branchesList[1] || branchesList[0];
        }
        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    }
  }, [branchesList]);

  // Keep branchStocksMap synchronized reactively when global products total stock changes
  useEffect(() => {
    setBranchStocksMap(prev => {
      let changed = false;
      const updated = { ...prev };
      products.forEach(p => {
        const current = prev[p.id];
        const currentSum = current
          ? branchesList.reduce((sum, b) => sum + (current[b] || 0), 0)
          : -1;

        if (currentSum !== p.stock) {
          updated[p.id] = allocateStock(p, branchesList);
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [products, branchesList]);

  // Sync activeBranch and forecastBranch when branches list updates
  useEffect(() => {
    if (branchesList.length > 0) {
      if (!activeBranch || !branchesList.includes(activeBranch)) {
        setActiveBranch(branchesList[0]);
      }
      if (!forecastBranch || !branchesList.includes(forecastBranch)) {
        setForecastBranch(branchesList[0]);
      }
    }
  }, [branchesList, activeBranch, forecastBranch]);

  // Sync transferForm productId if products list changes or shifts
  useEffect(() => {
    if (products.length > 0 && !transferForm.productId) {
      setTransferForm(prev => ({ ...prev, productId: products[0].id }));
    }
  }, [products, transferForm.productId]);



  // Compute branch-specific inventory items dynamically

  const getBranchInventory = (branchName) => {

    return products.map(p => {

      const stock = branchStocksMap[p.id]?.[branchName] ?? 0;

      const shelf = getShelfForProduct(p.name);

      

      // Determine status pill

      let status = "Stable";

      if (stock === 0 || stock <= p.reorderLevel * 0.3) {

        status = "Critical Low";

      } else if (stock <= p.reorderLevel) {

        status = "Warning Low";

      } else if (stock >= p.reorderLevel * 5) {

        status = "Overstocked";

      }



      return {

        ...p,

        stock,

        shelf,

        status,

        safetyLimit: p.reorderLevel

      };

    });

  };



  // Compute branch metrics dynamically based on actual products and branch networks
  const branchMetrics = React.useMemo(() => {
    const metrics = {};
    branchesList.forEach(branchName => {
      // Filter products belonging to this branch
      const branchProducts = products.filter(p => p.branchName === branchName);
      
      const totalSalesVal = branchProducts.reduce((sum, p) => sum + (p.price * (p.sold || 0)), 0);
      const totalStock = branchProducts.reduce((sum, p) => sum + p.stock, 0);
      
      // Stock level percentage
      const capacity = branchCapacityLimits[branchName] || 500;
      const stockLevelPct = Math.round((totalStock / capacity) * 100);
      
      // Health check
      let health = "Optimal";
      if (totalStock === 0) {
        health = "Onboarding";
      } else if (branchProducts.some(p => p.stock <= (p.reorderLevel || 10))) {
        health = "Watchlist";
      } else if (stockLevelPct > 95) {
        health = "Overstocked";
      }
      
      // Alerts count
      const alerts = branchProducts.filter(p => p.stock <= (p.reorderLevel || 10)).length;
      
      // Format sales values
      let salesStr = "₹0";
      if (totalSalesVal >= 10000000) salesStr = `₹${(totalSalesVal / 10000000).toFixed(1)}Cr`;
      else if (totalSalesVal >= 100000) salesStr = `₹${(totalSalesVal / 100000).toFixed(1)}L`;
      else salesStr = `₹${totalSalesVal.toLocaleString()}`;
      
      metrics[branchName] = {
        sales: salesStr,
        stockLevel: `${stockLevelPct}%`,
        health,
        alerts
      };
    });
    return metrics;
  }, [products, branchesList]);

  const handleStockTransfer = (e) => {
    e.preventDefault();
    if (transferForm.source === transferForm.destination) {
      setTransferError("Source and destination branches must be different.");
      setTransferStatus("error");
      return;
    }

    const qty = Number(transferForm.quantity);
    const prodId = transferForm.productId;

    // Verify source has enough stock
    const sourceStock = branchStocksMap[prodId]?.[transferForm.source] || 0;
    if (sourceStock < qty) {
      setTransferError(`Only ${sourceStock} units are available in ${transferForm.source}.`);
      setTransferStatus("error");
      return;
    }



  setTransferError("");
  setTransferStatus("sending");



    setTimeout(() => {

      // 1. Shift stocks in our branchStocksMap

      setBranchStocksMap(prev => {

        const prodAlloc = { ...prev[prodId] };

        prodAlloc[transferForm.source] = Math.max(0, prodAlloc[transferForm.source] - qty);

        prodAlloc[transferForm.destination] = (prodAlloc[transferForm.destination] || 0) + qty;

        return { ...prev, [prodId]: prodAlloc };

      });



      // 2. Keep the parent consolidated products in sync (total stock is conserved, but let's notify components)

      const updatedProducts = products.map(p => {

        if (p.id === prodId) {

          // Total stock remains the same, but let's re-save to trigger state render triggers

          return { ...p };

        }

        return p;

      });

      onUpdateProducts(updatedProducts);



      setTransferStatus("success");

      setTimeout(() => setTransferStatus("idle"), 3000);

    }, 1200);

  };


  setTransferError("");

  // Trigger quick transfer request from the branch list

  const triggerQuickTransferFill = (productId, destBranch) => {

    // Find a source that has abundance of this product (usually Pune Depot or Mumbai Hub)

    let source = "Pune Depot";

    if (destBranch === "Pune Depot") source = "Mumbai Hub";



    setTransferForm({

      source,

      destination: destBranch,

      productId: String(productId),

      quantity: 15

    });



    // Scroll to the dispatch container smoothly

    const element = document.getElementById("transfer-desk-container");

    if (element) {

      element.scrollIntoView({ behavior: "smooth" });

    }

  };



  // Helper: get node color & alert state based on live branch health

  const getNodeStyle = (branchName) => {

    const m = branchMetrics[branchName];

    if (!m) return { fill: "#38bdf8", isAlert: false };

    if (m.health === "Watchlist") return { fill: "#ef4444", isAlert: true };

    if (m.health === "Overstocked") return { fill: "#f59e0b", isAlert: false };

    return { fill: "#10b981", isAlert: false };

  };



  // Full-width World supply chain map using Leaflet

  const renderRegionalMap = () => {

    // Branch locations with dynamic coordinates (latitude, longitude)
    const branchLocations = branchesListFromDB
      .filter((branch) => {
        const lat = Number(branch.latitude);
        const lng = Number(branch.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      })
      .map((branch) => ({
        name: branch.branch_name,
        branch: branch.branch_name,
        position: [Number(branch.latitude), Number(branch.longitude)],
        ...getNodeStyle(branch.branch_name)
      }));

    // Dynamic Route connections between branches (hub-and-spoke from first branch)
    const routes = [];
    if (branchLocations.length > 1) {
      const hq = branchLocations[0].position;
      for (let i = 1; i < branchLocations.length; i++) {
        routes.push([hq, branchLocations[i].position]);
      }
    }



    // Create custom marker icons

    const createCustomIcon = (color, isAlert) => {

      return L.divIcon({

        className: 'custom-marker',

        html: `<div style="

          background-color: ${color};

          width: ${isAlert ? '20px' : '14px'};

          height: ${isAlert ? '20px' : '14px'};

          border-radius: 50%;

          border: 3px solid #0f172a;

          box-shadow: 0 0 10px ${color};

          ${isAlert ? 'animation: pulse 2s infinite;' : ''}

        "></div>

        <style>

          @keyframes pulse {

            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }

            70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }

            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }

          }

        </style>`,

        iconSize: [isAlert ? 20 : 14, isAlert ? 20 : 14],

        iconAnchor: [isAlert ? 10 : 7, isAlert ? 10 : 7],

      });

    };



    return (

      <div className="relative w-full h-full">

        <MapContainer

          center={[20, 20]}

          zoom={2}

          style={{ height: '100%', width: '100%', backgroundColor: '#0f172a' }}

          className="dark-map"

        >

          {/* Dark-themed map tiles */}

          <TileLayer

            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

            subdomains="abcd"

            maxZoom={19}

          />



          {/* Route lines */}

          {routes.map((route, i) => (

            <Polyline

              key={i}

              positions={route}

              color={i % 2 === 0 ? "#38bdf8" : "#10b981"}

              weight={2}

              opacity={0.6}

              dashArray="5, 5"

            />

          ))}



          {/* Branch markers */}

          {branchLocations.map((location) => {

            const m = branchMetrics[location.branch];

            const markerColor = location.isAlert ? "#ef4444" : location.fill === "#f59e0b" ? "#f59e0b" : "#10b981";



            return (

              <Marker

                key={location.name}

                position={location.position}

                icon={createCustomIcon(markerColor, location.isAlert)}

                eventHandlers={{

                  click: () => setSelectedBranchPage(location.branch),

                  mouseover: () => setHoveredNode(location.name),

                  mouseout: () => setHoveredNode(null),

                }}

              >

                <Popup>

                  <div className="text-slate-900">

                    <div className="font-bold text-sm">{location.name}</div>

                    <div className="text-xs mt-1">Sales Today: {m.sales}</div>

                    <div className={`text-xs font-semibold ${location.isAlert ? 'text-red-600' : 'text-emerald-600'}`}>

                      Status: {m.health} · {m.alerts > 0 ? `${m.alerts} Alerts` : "No Alerts"}

                    </div>

                    <div className="text-xs text-sky-600 font-bold mt-2">Click to manage branch →</div>

                  </div>

                </Popup>

              </Marker>

            );

          })}

        </MapContainer>

      </div>

    );

  };



  const computedForecastData = React.useMemo(() => {
    const forecast = {};
    branchesList.forEach(branchName => {
      const branchProducts = products.filter(p => p.branchName === branchName);
      const actualSales = branchProducts.reduce((sum, p) => sum + (p.price * (p.sold || 0)), 0);
      
      const refVal = actualSales > 0 ? actualSales : branchProducts.reduce((sum, p) => sum + (p.price * p.stock), 0) * 0.25;
      
      const q1 = Math.round(refVal * 0.75);
      const q2 = Math.round(refVal * 0.95);
      const q3 = Math.round(refVal * 1.15);
      const q4 = Math.round(refVal * 1.35);
      
      const formatVal = (val) => {
        if (val === 0) return "₹0";
        if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
        return `₹${val}`;
      };

      const growthVal = actualSales > 0 ? `+${(((refVal * 1.35) / actualSales - 1) * 100).toFixed(1)}%` : "—";
      const marginTarget = actualSales > 0 ? `${((refVal * 1.35 * 0.25 / actualSales) * 100).toFixed(1)}%` : "—";

      const maxQ = Math.max(1, q4);
      const getPointsVal = (qVal) => Math.max(0.5, Math.min(5.5, (qVal / maxQ) * 5));

      forecast[branchName] = {
        projectedNet: formatVal(q4),
        growth: growthVal,
        marginTarget: marginTarget,
        actualSales: actualSales,
        points: [
          { label: "Q1", value: getPointsVal(q1), display: formatVal(q1) },
          { label: "Q2", value: getPointsVal(q2), display: formatVal(q2) },
          { label: "Q3", value: getPointsVal(q3), display: formatVal(q3) },
          { label: "Q4", value: getPointsVal(q4), display: formatVal(q4) }
        ]
      };
    });
    return forecast;
  }, [products, branchesList]);

  const renderAdvancedProfitForecast = () => {

    const data = computedForecastData[forecastBranch];
    if (!data) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-400">No forecast data available yet.</p>
        </div>
      );
    }

    const points = data.points;
    const hasSales = data.actualSales > 0;

    const getY = (val) => 115 - (val / 6.0) * 85;



    // Generate SVG path for line

    const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${40 + idx * 60},${getY(p.value)}`).join(' ');

    // Generate SVG path for area fill under the line

    const areaD = `${pathD} L 220,120 L 40,120 Z`;



    return (

      <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col justify-between h-full">

        <div>

          <div className="flex justify-between items-start">

            <div>

              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 font-extrabold">Executive Forecasting</span>

              <h3 className="text-lg font-black text-slate-900 mt-1">Advanced Profit Projections</h3>

            </div>

            <CustomDropdown
              value={forecastBranch}
              onChange={setForecastBranch}
              options={branchesList.map(b => ({ value: b, label: b }))}
              theme="emerald"
              size="sm"
              buttonClassName="rounded-lg font-bold text-[11px]"
              className="w-auto min-w-[130px]"
            />

          </div>



          {/* Quick Margins / Target Performance Stats */}

          <div className="grid grid-cols-3 gap-2 mt-4 py-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl">

            <div>

              <span className="text-[9px] text-slate-400 font-bold uppercase block">Net Projected</span>

              <span className="text-xs font-black text-slate-800">{hasSales ? data.projectedNet : "—"}</span>

            </div>

            <div>

              <span className="text-[9px] text-slate-400 font-bold uppercase block">Growth Rate</span>

              <span className={`text-xs font-black flex items-center gap-0.5 ${hasSales ? "text-emerald-600" : "text-slate-405"}`}>

                {hasSales ? (
                  <>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />

                    </svg>

                    {data.growth}
                  </>
                ) : "—"}

              </span>

            </div>

            <div>

              <span className="text-[9px] text-slate-400 font-bold uppercase block">Margin Target</span>

              <span className="text-xs font-black text-slate-800">{hasSales ? data.marginTarget : "—"}</span>

            </div>

          </div>

        </div>



        {/* Custom High-Fidelity SVG Chart */}

        <div className="relative mt-4 flex items-center justify-center bg-emerald-50/20 border border-emerald-100/30 rounded-2xl p-2">

          <svg width="100%" height="135" viewBox="0 0 260 135" className="overflow-visible select-none">

            <defs>

              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">

                <stop offset="0%" stopColor="#10B981" stopOpacity={hasSales ? 0.25 : 0.05} />

                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />

              </linearGradient>

            </defs>



            {/* Grid lines */}

            <line x1="40" y1="35" x2="220" y2="35" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />

            <line x1="40" y1="75" x2="220" y2="75" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />

            <line x1="40" y1="115" x2="220" y2="115" stroke="#E2E8F0" strokeWidth="1" />



            {/* Area under curve */}

            <path d={areaD} fill="url(#chartGradient)" />



            {/* Line Path */}

            <path d={pathD} fill="none" stroke={hasSales ? "#059669" : "#cbd5e1"} strokeWidth="2.5" strokeDasharray={hasSales ? "none" : "3 3"} strokeLinecap="round" strokeLinejoin="round" />



            {/* Points & Hover Tooltips */}

            {points.map((p, idx) => {

              const x = 40 + idx * 60;

              const y = getY(p.value);

              return (

                <g key={p.label} className="group cursor-pointer">

                  {/* Outer circle for hover effect */}

                  <circle cx={x} cy={y} r="8" fill="rgba(16, 185, 129, 0.15)" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                  {/* Point circle */}

                  <circle cx={x} cy={y} r="4.5" fill={hasSales ? "#059669" : "#cbd5e1"} stroke="#FFF" strokeWidth="1.5" />

                  {/* Value Text Badge */}

                  {hasSales && (
                    <text x={x} y={y - 9} fill="#047857" fontSize="8.5" fontWeight="bold" textAnchor="middle" className="transition-all duration-300">

                      {p.display}

                    </text>
                  )}

                  {/* Label Text below axis */}

                  <text x={x} y="130" fill="#64748B" fontSize="8.5" fontWeight="bold" textAnchor="middle">

                    {p.label}

                  </text>

                </g>

              );

            })}

          </svg>

        </div>

        {!hasSales ? (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[3px] flex flex-col items-center justify-center text-center p-6 z-10 border border-slate-100/50">
            <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm text-sm mb-2">📈</div>
            <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Cannot Forecast Now</span>
            <p className="text-xs font-semibold text-slate-500 mt-2 max-w-xs leading-relaxed">
              Advanced profit projections will activate once transactions are recorded in Billing POS.
            </p>
          </div>
        ) : null}

      </div>

    );

  };



  // ----------------------------------------------------

  // DEDICATED BRANCH PAGE VIEW

  // ----------------------------------------------------

  if (selectedBranchPage !== null) {

    const branchInventory = getBranchInventory(selectedBranchPage);

    const metrics = branchMetrics[selectedBranchPage];

    const capacityLimit = branchCapacityLimits[selectedBranchPage];

    

    // Calculate total stock items currently in the branch

    const totalLocalStockSum = branchInventory.reduce((acc, item) => acc + item.stock, 0);

    const capacityPercentage = Math.min(100, Math.round((totalLocalStockSum / capacityLimit) * 100));



    // Dynamic AI operational directives based on selected branch
    let aiDirective = "";
    if (branchInventory.length === 0) {
      aiDirective = "This branch has no inventory items. Populate the inventory by adding items or recording purchase orders to start tracking stock operations.";
    } else {
      const criticalItems = branchInventory.filter(p => p.stock === 0 || p.stock <= p.reorderLevel * 0.3);
      const warningItems = branchInventory.filter(p => p.stock > p.reorderLevel * 0.3 && p.stock <= p.reorderLevel);
      
      if (criticalItems.length > 0) {
        const itemNames = criticalItems.slice(0, 2).map(p => p.name).join(" and ");
        const moreCount = criticalItems.length > 2 ? ` and ${criticalItems.length - 2} more` : "";
        aiDirective = `⚠️ CRITICAL WARNING: ${itemNames}${moreCount} stock levels have fell under safety thresholds. AI routing engine suggests immediate stock dispatch or vendor purchase order to restore safety buffers.`;
      } else if (warningItems.length > 0) {
        const itemNames = warningItems.slice(0, 2).map(p => p.name).join(" and ");
        aiDirective = `⚠️ Stock buffer warning: ${itemNames} is approaching safety limit. Replenishment logic is monitoring velocity.`;
      } else if (capacityPercentage > 90) {
        aiDirective = `⚠️ OVERSTOCK ALERT: Holdings are currently exceeding safety levels (${capacityPercentage}% capacity utilization). AI recommends dispatching excess inventory to other branches to optimize consolidation margins.`;
      } else {
        aiDirective = "Operations running at peak efficiency. Local supply streams are optimal. Suggest setting up proactive automated reorder cycles for the next operational period.";
      }
    }



    // Radial Progress Ring formulas

    const r = 42;

    const circ = 2 * Math.PI * r;

    const offset = circ - (capacityPercentage / 100) * circ;



    // Capacity color

    let capacityColor = "#10B981"; // green

    if (capacityPercentage >= 90) capacityColor = "#EF4444"; // red

    else if (capacityPercentage >= 75) capacityColor = "#F59E0B"; // amber



    return (

      <div className="space-y-6 text-left animate-fadeIn">

        {/* Navigation Breadcrumbs Header */}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">

          <div>

            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-slate-400 tracking-wider">

              <span>Enterprise Command</span>

              <span>/</span>

              <span>Branch Hubs</span>

              <span>/</span>

              <span className="text-emerald-600 font-black">{selectedBranchPage}</span>

            </div>

            <h2 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">

              {selectedBranchPage} Operations Center

              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />

            </h2>

          </div>

          <button

            onClick={() => setSelectedBranchPage(null)}

            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm hover:scale-[1.02] cursor-pointer"

          >

            ← Back to Consolidated Overview

          </button>

        </div>



        {/* Quick Branch Switcher Horizontal Tab Bar */}

        <div className="flex gap-2 pb-2 overflow-x-auto select-none border-b border-slate-100">

          {branchesList.map(b => (

            <button

              key={b}

              onClick={() => setSelectedBranchPage(b)}

              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all ${

                selectedBranchPage === b

                  ? "bg-emerald-600 text-white shadow-sm scale-102"

                  : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"

              }`}

            >

              {b}

            </button>

          ))}

        </div>



        {/* KPI Panel Row */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Sales Performance Card */}

          <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex items-center justify-between">

            <div className="space-y-1">

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Branch Revenue Today</span>

              <div className="text-3xl font-black text-slate-900">{metrics.sales}</div>

              <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1">

                <span>✓ High Velocity</span>

                <span>•</span>

                <span className="text-slate-400">Target hit</span>

              </div>

            </div>

            {/* Sparkline Visual */}

            <svg width="60" height="36" viewBox="0 0 60 36" className="overflow-visible stroke-emerald-600 stroke-[2.5]" fill="none">

              <path d="M 0,30 Q 15,10 30,22 T 60,8" strokeLinecap="round" />

            </svg>

          </div>



          {/* Buffer Alert Indicators */}

          <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex items-center justify-between">

            <div className="space-y-1">

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Operational Health Status</span>

              <div className={`text-2xl font-black ${metrics.health === "Watchlist" ? "text-rose-600" : metrics.health === "Overstocked" ? "text-amber-600" : "text-emerald-600"}`}>

                {metrics.health}

              </div>

              <div className="text-xs font-semibold text-slate-500">

                {selectedBranchPage === "Delhi Branch" 

                  ? "4 critical items below safety limit"

                  : selectedBranchPage === "Pune Depot"

                  ? "1 category severely overfilled"

                  : "All local stocks balanced"}

              </div>

            </div>

            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg ${

              metrics.health === "Watchlist" ? "bg-rose-50 text-rose-600" : metrics.health === "Overstocked" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"

            }`}>

              {metrics.health === "Watchlist" ? "⚠" : metrics.health === "Overstocked" ? "📦" : "✓"}

            </div>

          </div>



          {/* SVG Radial Capacity Donut Chart */}

          <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex items-center justify-between">

            <div className="space-y-1">

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Warehouse Storage Occupancy</span>

              <div className="text-2xl font-black text-slate-900">

                {totalLocalStockSum} <span className="text-xs text-slate-400 font-bold">/ {capacityLimit} Units</span>

              </div>

              <div className="text-xs font-semibold text-slate-500">

                Effective space availability: {100 - capacityPercentage}%

              </div>

            </div>

            

            {/* Custom SVG Donut */}

            <div className="relative h-16 w-16 flex items-center justify-center shrink-0">

              <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible transform -rotate-90">

                {/* Background Ring */}

                <circle cx="50" cy="50" r={r} fill="transparent" stroke="#F1F5F9" strokeWidth="8" />

                {/* Foreground Progress */}

                <circle 

                  cx="50" 

                  cy="50" 

                  r={r} 

                  fill="transparent" 

                  stroke={capacityColor} 

                  strokeWidth="8.5"

                  strokeDasharray={circ}

                  strokeDashoffset={offset}

                  strokeLinecap="round"

                  className="transition-all duration-700 ease-out"

                />

              </svg>

              <div className="absolute inset-0 flex items-center justify-center text-[10.5px] font-black text-slate-800">

                {capacityPercentage}%

              </div>

            </div>

          </div>

        </div>



        {/* AI Directive Notification Widget */}

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-start gap-3 shadow-inner">

          <span className="h-6 w-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 text-xs shrink-0 mt-0.5 font-bold">✨</span>

          <div>

            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">AI Copilot Recommendation Directive</span>

            <p className="text-xs font-bold text-slate-700 leading-relaxed">{aiDirective}</p>

          </div>

        </div>



        {/* Main Work Area Grid: Left local table, Right Transfer dispatch */}

        <div className={isOwner ? "grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6 items-start" : "grid grid-cols-1 gap-6 items-start"}>

          {/* Local Shelf Inventory Table */}

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] space-y-4">

            <div>

              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Warehouse Inventory Matrix</span>

              <h3 className="text-lg font-black text-slate-900 mt-1">Local Stock & Shelf Layout</h3>

            </div>



            <div className="overflow-x-auto">

              <table className="w-full text-left text-xs border-collapse">

                <thead>

                  <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider bg-slate-50/50">

                    <th className="py-3 px-4">SKU Product</th>

                    <th className="py-3 px-2">Aisle / Shelf</th>

                    <th className="py-3 px-2 text-center">Local Stock</th>

                    <th className="py-3 px-2 text-center">Safety Min</th>

                    <th className="py-3 px-2 text-center">Status</th>

                    {isOwner && <th className="py-3 px-4 text-right">Action</th>}

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">

                  {branchInventory.map(item => {

                    const progressWidth = Math.min(100, Math.round((item.stock / (item.safetyLimit * 3)) * 100));

                    

                    return (

                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">

                        <td className="py-3.5 px-4">

                          <div className="font-bold text-slate-900">{item.name}</div>

                          <span className="text-[8.5px] uppercase font-black px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md mt-1 inline-block">

                            {item.category}

                          </span>

                        </td>

                        <td className="py-3.5 px-2 font-mono text-slate-500 text-[11px]">{item.shelf}</td>

                        

                        <td className="py-3.5 px-2 text-center">

                          <div className="font-black text-slate-900">{item.stock} Units</div>

                          {/* Mini Progress bar */}

                          <div className="w-16 h-1.5 bg-slate-100 rounded-full mx-auto mt-1 overflow-hidden">

                            <div 

                              className={`h-full rounded-full ${

                                item.status.includes("Critical") ? "bg-rose-500" : item.status.includes("Warning") ? "bg-amber-500" : item.status.includes("Overstocked") ? "bg-red-600" : "bg-emerald-500"

                              }`}

                              style={{ width: `${progressWidth}%` }}

                            />

                          </div>

                        </td>



                        <td className="py-3.5 px-2 text-center text-slate-500">{item.safetyLimit}</td>

                        

                        <td className="py-3.5 px-2 text-center">

                          <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border tracking-wider ${

                            item.status === "Critical Low"

                              ? "bg-rose-50 border-rose-200 text-rose-700"

                              : item.status === "Warning Low"

                              ? "bg-amber-50 border-amber-200 text-amber-700"

                              : item.status === "Overstocked"

                              ? "bg-amber-100 border-amber-300 text-amber-800"

                              : "bg-emerald-50 border-emerald-200 text-emerald-700"

                          }`}>

                            {item.status}

                          </span>

                        </td>



                        {isOwner && (
                          <td className="py-3.5 px-4 text-right">

                            <button

                              onClick={() => triggerQuickTransferFill(item.id, selectedBranchPage)}

                              className="px-2.5 py-1.5 rounded-lg border border-emerald-600 text-emerald-800 font-bold text-[10px] uppercase hover:bg-emerald-50 tracking-wider transition-all cursor-pointer"

                            >

                              Quick Refill

                            </button>

                          </td>
                        )}

                      </tr>

                    );

                  })}

                </tbody>

              </table>

            </div>

          </div>



          {/* Quick Dispatch Desk Box */}

          {isOwner && (
            <div id="transfer-desk-container" className="bg-white border border-slate-200 rounded-3xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">

            <div className="mb-4">

              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Direct logistics desk</span>

              <h3 className="text-lg font-black text-slate-900 mt-1">Direct Stock Transfer</h3>

            </div>



            <form onSubmit={handleStockTransfer} className="space-y-4 text-xs font-semibold text-slate-600">

              <div className="flex flex-col gap-1">

                <label className="text-[9px] font-black uppercase text-slate-400">Source (Supply Warehouse)</label>

                <CustomDropdown
                  value={transferForm.source}
                  onChange={(val) => setTransferForm({ ...transferForm, source: val })}
                  options={branchesList.map(b => ({ value: b, label: b }))}
                  theme="emerald"
                  buttonClassName="rounded-lg font-bold"
                />

              </div>



              <div className="flex flex-col gap-1">

                <label className="text-[9px] font-black uppercase text-slate-400">Destination (Target Branch)</label>

                <input

                  type="text"

                  readOnly

                  value={selectedBranchPage}

                  className="px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 outline-none font-black w-full"

                />

              </div>



              <div className="grid grid-cols-[1.3fr_0.7fr] gap-3">

                <div className="flex flex-col gap-1">

                  <label className="text-[9px] font-black uppercase text-slate-400">Product SKU</label>

                  <CustomDropdown
                    value={transferForm.productId}
                    onChange={(val) => setTransferForm({ ...transferForm, productId: val })}
                    options={products.map(p => {
                      const sourceStock = branchStocksMap[p.id]?.[transferForm.source] ?? 0;
                      return { value: p.id, label: `${p.name} (Source Stock: ${sourceStock})` };
                    })}
                    theme="emerald"
                    buttonClassName="rounded-lg font-bold"
                  />

                </div>



                <div className="flex flex-col gap-1">

                  <label className="text-[9px] font-black uppercase text-slate-400">Transfer Qty</label>

                  <input

                    type="number"

                    required

                    min="1"

                    value={transferForm.quantity}

                    onChange={(e) => setTransferForm({ ...transferForm, quantity: Math.max(1, e.target.value) })}

                    className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none font-black text-center w-full"

                  />

                </div>

              </div>



              <div className="pt-2">

                {transferStatus === "sending" && (

                  <div className="text-center font-bold text-slate-400 py-3 animate-pulse">

                    Routing dispatch allocation transfer...

                  </div>

                )}



                {transferStatus === "success" && (

                  <div className="text-center font-black text-emerald-700 py-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl">

                    ✓ Dispatch Allocated & Completed!

                  </div>

                )}

                {transferStatus === "error" && transferError && (

                  <div className="text-center font-black text-rose-700 py-2.5 bg-rose-50 border border-rose-200 rounded-2xl">

                    {transferError}

                  </div>

                )}



                <button

                  type="submit"

                  disabled={transferStatus === "sending"}

                  className="w-full py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider text-white shadow-md hover:scale-[1.01] transition-all cursor-pointer"

                  style={{ background: tierAccent }}

                >

                  {transferStatus === "sending" ? "Transferring Stock..." : "Initiate Stock Dispatch"}

                </button>

              </div>

            </form>

          </div>
          )}

        </div>

      </div>

    );

  }



  if (!branchesList || branchesList.length === 0) {
    return (
      <div className="rounded-3xl border border-sky-100 bg-sky-50/20 p-8 text-center max-w-2xl mx-auto space-y-4 my-12 animate-fadeIn">
        <div className="text-4xl">🏢</div>
        <h3 className="text-xl font-black text-slate-900">Configure Your Branch Network</h3>
        <p className="text-sm text-slate-500 font-semibold leading-relaxed">
          It looks like you haven't set up any branches yet. Inventra's premium multi-branch consolidated intelligence is active, but requires at least one registered branch.
        </p>
        <button
          onClick={() => onOpenBranchPage && onOpenBranchPage()}
          className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Setup Branches Now
        </button>
      </div>
    );
  }

  return (

    <div className="space-y-6 text-left animate-fadeIn">

      {/* Top executive dashboard branch selector nodes bar */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {branchesList.map(branch => {

          const m = branchMetrics[branch] || { sales: "₹0", stockLevel: "New", health: "Onboarding", alerts: 0 };

          const isWatch = m.health === "Watchlist";

          const isOver = m.health === "Overstocked";

          const isActive = activeBranch === branch;

          

          return (

            <button

              key={branch}

              onClick={() => {

                setActiveBranch(branch);

                if (onOpenBranchPage) {

                  onOpenBranchPage(branch);

                } else {

                  setSelectedBranchPage(branch);

                }

              }}

              className={`min-h-44 p-5 rounded-[22px] border text-left transition-all duration-300 relative group overflow-hidden cursor-pointer ${

                isActive 

                  ? "border-emerald-600 bg-emerald-50/60 shadow-[0_16px_34px_rgba(16,185,129,0.11)]" 

                  : "border-slate-200 bg-slate-50 hover:bg-white hover:border-emerald-300 hover:shadow-[0_16px_34px_rgba(15,23,42,0.06)]"

              }`}

            >

              <div className={`absolute top-0 right-7 h-2 w-20 bg-emerald-600 rounded-b-full transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />

              <span className="text-[9px] font-black uppercase text-slate-400 flex justify-between items-center">

                <span>Branch Node</span>

                <span className="text-emerald-700 font-extrabold opacity-0 group-hover:opacity-100 transition-opacity">MANAGE HUB &rarr;</span>

              </span>

              <h4 className="text-base font-black mt-5 text-slate-950">{branch}</h4>

              

              <div className="mt-8 grid grid-cols-2 gap-2 text-xs">

                <div>

                  <span className="text-[9px] text-slate-400 font-extrabold uppercase">Sales today</span>

                  <div className="font-black text-slate-950 mt-1 text-sm">{m.sales}</div>

                </div>

                <div className="text-right">

                  <span className="text-[9px] text-slate-400 font-extrabold uppercase">Health</span>

                  <div className={`font-black mt-1 text-sm ${isWatch ? 'text-rose-600' : isOver ? 'text-amber-600' : 'text-emerald-600'}`}>

                    {m.health}

                  </div>

                </div>

              </div>

            </button>

          );

        })}

      </div>



      {/* Row 2: Full-width Regional Supply Chain Map */}

      <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">

        <div className="flex justify-between items-center flex-wrap gap-2">

          <div>

            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Geographical analysis</span>

            <h3 className="text-lg font-black text-slate-900 mt-1">Regional Supply Chain Map</h3>

          </div>

          <div className="flex items-center gap-1.5">

            <span className="bg-sky-500 text-white rounded-full px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider">Live Data</span>

            <span className="bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider">4 Branches Active</span>

            <span className="text-[8.5px] font-bold text-slate-400">Hover to preview · Click to manage</span>

          </div>

        </div>



        {/* Map canvas */}

        <div className="bg-slate-950 rounded-2xl border border-slate-800 mt-4 relative overflow-hidden" style={{ height: '480px' }}>

          {renderRegionalMap()}

        </div>



        {/* KPI row beneath the map */}

        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100">

          <div className="border-l-[3px] border-emerald-500 pl-2.5">

            <span className="text-[8.5px] uppercase font-bold text-slate-400 tracking-wider block">Top Performer</span>

            <span className="text-[13px] font-black text-slate-900 block leading-tight mt-0.5">Bangalore Branch</span>

            <span className="text-[9.5px] font-bold text-emerald-600 block mt-0.5">+14.5% Growth</span>

          </div>

          <div className="border-l-[3px] border-rose-500 pl-2.5">

            <span className="text-[8.5px] uppercase font-bold text-slate-400 tracking-wider block">Lowest Stock</span>

            <span className="text-[13px] font-black text-slate-900 block leading-tight mt-0.5">Delhi Branch</span>

            <span className="text-[9.5px] font-bold text-rose-600 block mt-0.5">Critical Buffer</span>

          </div>

          <div className="border-l-[3px] border-slate-300 pl-2.5">

            <span className="text-[8.5px] uppercase font-bold text-slate-400 tracking-wider block">Est. Demand</span>

            <span className="text-[13px] font-black text-slate-900 block leading-tight mt-0.5">₹35L</span>

            <span className="text-[9.5px] font-bold text-slate-500 block mt-0.5">Next 72 Hours</span>

          </div>

        </div>

      </div>



      {/* Row 3: Operations & Actions Grid */}

      <div className={isOwner ? "grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>

        {/* Centralized Stock Transfer Desk */}

        {isOwner && (
          <div id="transfer-desk-container" className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col h-[400px] overflow-hidden">

          <div className="mb-4">

            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Logistics dispatch</span>

            <h3 className="text-lg font-black text-slate-900 mt-1">Inter-Branch Stock Transfers</h3>

          </div>



          <form onSubmit={handleStockTransfer} className="space-y-4 text-xs font-semibold text-slate-600 flex-1 flex flex-col justify-between">

            <div className="grid grid-cols-2 gap-3">

              <div className="flex flex-col gap-1">

                <label className="text-[9px] font-black uppercase text-slate-400">Source Branch (Overstock)</label>

                <CustomDropdown
                  value={transferForm.source}
                  onChange={(val) => setTransferForm({ ...transferForm, source: val })}
                  options={branchesList.map(b => ({ value: b, label: b }))}
                  theme="emerald"
                  buttonClassName="rounded-lg font-bold"
                  size="sm"
                />

              </div>



              <div className="flex flex-col gap-1">

                <label className="text-[9px] font-black uppercase text-slate-400">Destination Branch</label>

                <CustomDropdown
                  value={transferForm.destination}
                  onChange={(val) => setTransferForm({ ...transferForm, destination: val })}
                  options={branchesList.map(b => ({ value: b, label: b }))}
                  theme="emerald"
                  buttonClassName="rounded-lg font-bold"
                  size="sm"
                />

              </div>

            </div>



            <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">

              <div className="flex flex-col gap-1">

                <label className="text-[9px] font-black uppercase text-slate-400">Select Product SKU</label>

                <CustomDropdown
                  value={transferForm.productId}
                  onChange={(val) => setTransferForm({ ...transferForm, productId: val })}
                  options={products.map(p => {
                    const sourceStock = branchStocksMap[p.id]?.[transferForm.source] ?? 0;
                    return { value: p.id, label: `${p.name} (Source Stock: ${sourceStock})` };
                  })}
                  theme="emerald"
                  buttonClassName="rounded-lg font-bold"
                  size="sm"
                />

              </div>



              <div className="flex flex-col gap-1">

                <label className="text-[9px] font-black uppercase text-slate-400">Transfer Qty</label>

                <input

                  type="number"

                  required

                  min="1"

                  value={transferForm.quantity}

                  onChange={(e) => setTransferForm({ ...transferForm, quantity: Math.max(1, e.target.value) })}

                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none font-black text-center w-full"

                />

              </div>

            </div>



            <div className="mt-4 flex-1 flex flex-col justify-end">

              {transferStatus === "sending" && (

                <div className="text-center font-bold text-slate-400 py-3 animate-pulse">

                  Initiating branch shipping allocation transfer...

                </div>

              )}



              {transferStatus === "success" && (

                <div className="text-center font-black text-emerald-700 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">

                  ✓ Transfer Successful! Delhi buffer increased, Pune buffer rebalanced.

                </div>

              )}



              <button

                type="submit"

                disabled={transferStatus === "sending"}

                className="w-full py-4 rounded-xl font-bold uppercase text-xs tracking-wider text-white shadow-md hover:scale-[1.01] transition-all cursor-pointer mt-4"

                style={{ background: tierAccent }}

              >

                {transferStatus === "sending" ? "Transferring Stock..." : "Initiate Stock Transfer"}

              </button>

            </div>

          </form>

        </div>
        )}



        {/* Live branch ticker monitoring & critical alerts */}

        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col h-[400px] overflow-hidden">

          <div className="mb-4">

            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Live monitoring</span>

            <h3 className="text-lg font-black text-slate-900 mt-1">Enterprise Alert Escalation Feed</h3>

          </div>



          <div className="space-y-3 text-xs overflow-y-auto flex-1 pr-1">

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-950 font-medium">

              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 mt-1.5 animate-ping" />

              <div>

                <span className="font-bold text-rose-950 block mb-0.5">Delhi Branch Buffer Shortage</span>

                Sweets and snack buffers fell under **5%** reorder levels. Automated stock transfer recommend immediately.

              </div>

            </div>



            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-950 font-medium">

              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />

              <div>

                <span className="font-bold text-amber-950 block mb-0.5">Pune Depot Stock Idle</span>

                Dairy and butter stocks are aging in Pune warehouse lanes (turnover ratio fell below 0.35). Recommended: Initiate price discounts or stock transfer.

              </div>

            </div>

          </div>

        </div>

        {/* Advanced Profit Forecasting Card */}

        {renderAdvancedProfitForecast()}

      </div>

    </div>

  );

}




import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Standard allocation ratios for branches
const allocateStock = (productId, totalStock) => {
  let m = 0, d = 0, b = 0, p = 0;
  if (productId === 1) { // Bread (typically 8 total initially)
    m = Math.floor(totalStock * 0.4);
    b = Math.floor(totalStock * 0.25);
    p = Math.floor(totalStock * 0.25);
    d = totalStock - (m + b + p);
  } else if (productId === 2) { // Milk (typically 12 total initially)
    m = Math.floor(totalStock * 0.4);
    b = Math.floor(totalStock * 0.25);
    p = Math.floor(totalStock * 0.25);
    d = totalStock - (m + b + p);
  } else if (productId === 3) { // Coke (typically 85 total initially)
    m = Math.floor(totalStock * 0.4);
    b = Math.floor(totalStock * 0.3);
    p = Math.floor(totalStock * 0.25);
    d = totalStock - (m + b + p);
  } else if (productId === 4) { // Chips (typically 4 total initially)
    m = Math.floor(totalStock * 0.5);
    b = Math.floor(totalStock * 0.25);
    p = Math.floor(totalStock * 0.25);
    d = totalStock - (m + b + p);
  } else if (productId === 5) { // Butter (typically 32 total initially)
    m = Math.floor(totalStock * 0.4);
    b = Math.floor(totalStock * 0.3);
    p = Math.floor(totalStock * 0.25);
    d = totalStock - (m + b + p);
  } else if (productId === 6) { // Chocolate (typically 55 total initially)
    m = Math.floor(totalStock * 0.4);
    b = Math.floor(totalStock * 0.3);
    p = Math.floor(totalStock * 0.25);
    d = totalStock - (m + b + p);
  } else {
    // General fallback for new products added via importer
    m = Math.floor(totalStock * 0.4);
    b = Math.floor(totalStock * 0.3);
    p = Math.floor(totalStock * 0.2);
    d = totalStock - (m + b + p);
  }

  return {
    "Mumbai Hub": Math.max(0, m),
    "Delhi Branch": Math.max(0, d),
    "Bangalore Branch": Math.max(0, b),
    "Pune Depot": Math.max(0, p)
  };
};

export default function LargeDashboard({ products, onUpdateProducts, tierAccent, tierAccentSoft, onOpenBranchPage, branchNetwork }) {
  // Navigation View State: null means Consolidated View, otherwise Branch Name
  const [selectedBranchPage, setSelectedBranchPage] = useState(null);
  const [activeBranch, setActiveBranch] = useState("Mumbai Hub");
  const [hoveredNode, setHoveredNode] = useState(null);

  const branchesList = branchNetwork?.length
    ? branchNetwork
    : ["Mumbai Hub", "Delhi Branch", "Bangalore Branch", "Pune Depot", "New York Hub", "London Branch", "Tokyo Depot", "Singapore Hub"];
  const branchCapacityLimits = {
    "Mumbai Hub": 300,
    "Delhi Branch": 150,
    "Bangalore Branch": 250,
    "Pune Depot": 600,
    "New York Hub": 450,
    "London Branch": 280,
    "Tokyo Depot": 520,
    "Singapore Hub": 380
  };

  // Branch Shelf Coordinates Mapper for a realistic warehouse grid
  const shelfCoordinates = {
    1: { "Mumbai Hub": "Aisle A-3", "Delhi Branch": "Aisle A-1", "Bangalore Branch": "Aisle A-2", "Pune Depot": "Aisle A-5", "New York Hub": "Zone B-2", "London Branch": "Section C-1", "Tokyo Depot": "Area D-3", "Singapore Hub": "Bay E-2" },
    2: { "Mumbai Hub": "Cold Rack-1", "Delhi Branch": "Cold Rack-1", "Bangalore Branch": "Cold Rack-3", "Pune Depot": "Cold Room-1", "New York Hub": "Cool Zone A-1", "London Branch": "Fridge B-2", "Tokyo Depot": "Cold Storage C-1", "Singapore Hub": "Chiller D-2" },
    3: { "Mumbai Hub": "Aisle C-2", "Delhi Branch": "Aisle C-1", "Bangalore Branch": "Aisle C-3", "Pune Depot": "Aisle C-5", "New York Hub": "Row E-3", "London Branch": "Lane F-1", "Tokyo Depot": "Path G-2", "Singapore Hub": "Way H-3" },
    4: { "Mumbai Hub": "Aisle D-1", "Delhi Branch": "Aisle D-1", "Bangalore Branch": "Aisle D-3", "Pune Depot": "Aisle D-5", "New York Hub": "Shelf I-2", "London Branch": "Rack J-1", "Tokyo Depot": "Unit K-3", "Singapore Hub": "Spot L-2" },
    5: { "Mumbai Hub": "Cold Rack-2", "Delhi Branch": "Cold Rack-2", "Bangalore Branch": "Cold Rack-4", "Pune Depot": "Cold Room-2", "New York Hub": "Freeze M-1", "London Branch": "Ice N-2", "Tokyo Depot": "Polar O-3", "Singapore Hub": "Frost P-1" },
    6: { "Mumbai Hub": "Aisle E-4", "Delhi Branch": "Aisle E-2", "Bangalore Branch": "Aisle E-1", "Pune Depot": "Aisle E-5", "New York Hub": "Zone Q-2", "London Branch": "Area R-1", "Tokyo Depot": "Sector S-3", "Singapore Hub": "Region T-2" },
  };

  // Stateful Branch-Specific Inventory Allocations
  const [branchStocksMap, setBranchStocksMap] = useState(() => {
    const initialMap = {};
    products.forEach(p => {
      initialMap[p.id] = allocateStock(p.id, p.stock);
    });
    return initialMap;
  });

  const [transferForm, setTransferForm] = useState({
    source: "Pune Depot",
    destination: "Delhi Branch",
    productId: products[0]?.id || "",
    quantity: 10
  });

  const [transferStatus, setTransferStatus] = useState("idle"); // idle, sending, success
  const [forecastBranch, setForecastBranch] = useState("Mumbai Hub");

  // Keep branchStocksMap synchronized reactively when global products total stock changes
  useEffect(() => {
    setBranchStocksMap(prev => {
      let changed = false;
      const updated = { ...prev };
      products.forEach(p => {
        const current = prev[p.id];
        const currentSum = current
          ? (current["Mumbai Hub"] + current["Delhi Branch"] + current["Bangalore Branch"] + current["Pune Depot"])
          : -1;

        if (currentSum !== p.stock) {
          updated[p.id] = allocateStock(p.id, p.stock);
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [products]);

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
      const shelf = shelfCoordinates[p.id]?.[branchName] ?? "Aisle F-1";
      
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

  // Mock data for branch sales comparison
  const branchMetrics = {
    "Mumbai Hub": { sales: "₹4.8L", stockLevel: "94%", health: "Optimal", alerts: 0 },
    "Delhi Branch": { sales: "₹3.6L", stockLevel: "68%", health: "Watchlist", alerts: 4 },
    "Bangalore Branch": { sales: "₹4.2L", stockLevel: "88%", health: "Optimal", alerts: 0 },
    "Pune Depot": { sales: "₹1.9L", stockLevel: "98%", health: "Overstocked", alerts: 1 },
    "New York Hub": { sales: "$8.2M", stockLevel: "91%", health: "Optimal", alerts: 0 },
    "London Branch": { sales: "£5.4M", stockLevel: "76%", health: "Watchlist", alerts: 2 },
    "Tokyo Depot": { sales: "¥6.8M", stockLevel: "89%", health: "Optimal", alerts: 1 },
    "Singapore Hub": { sales: "S$3.9M", stockLevel: "95%", health: "Optimal", alerts: 0 },
  };

  const handleStockTransfer = (e) => {
    e.preventDefault();
    if (transferForm.source === transferForm.destination) {
      alert("Source and Destination branches cannot be the same.");
      return;
    }

    const qty = Number(transferForm.quantity);
    const prodId = Number(transferForm.productId);

    // Verify source has enough stock
    const sourceStock = branchStocksMap[prodId]?.[transferForm.source] || 0;
    if (sourceStock < qty) {
      alert(`Source branch (${transferForm.source}) only has ${sourceStock} units of this item. Cannot transfer ${qty} units.`);
      return;
    }

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
    // Branch locations with accurate geographic coordinates [latitude, longitude]
    const branchLocations = [
      { name: "New York Hub",    branch: "New York Hub",    position: [40.7128, -74.006], ...getNodeStyle("New York Hub") },
      { name: "London Branch",   branch: "London Branch",   position: [51.5074, -0.1276], ...getNodeStyle("London Branch") },
      { name: "Mumbai Hub",      branch: "Mumbai Hub",      position: [19.0760, 72.8777], ...getNodeStyle("Mumbai Hub") },
      { name: "Delhi Branch",   branch: "Delhi Branch",   position: [28.6139, 77.2090], ...getNodeStyle("Delhi Branch") },
      { name: "Bangalore Branch", branch: "Bangalore Branch", position: [12.9716, 77.5946], ...getNodeStyle("Bangalore Branch") },
      { name: "Pune Depot",      branch: "Pune Depot",      position: [18.5204, 73.8567], ...getNodeStyle("Pune Depot") },
      { name: "Singapore Hub",  branch: "Singapore Hub",  position: [1.3521, 103.8198], ...getNodeStyle("Singapore Hub") },
      { name: "Tokyo Depot",     branch: "Tokyo Depot",     position: [35.6895, 139.6917], ...getNodeStyle("Tokyo Depot") },
    ];

    // Route connections between global branches using coordinates
    const routes = [
      [[40.7128, -74.006], [51.5074, -0.1276]],  // New York to London
      [[51.5074, -0.1276], [19.0760, 72.8777]],  // London to Mumbai
      [[19.0760, 72.8777], [28.6139, 77.2090]],  // Mumbai to Delhi
      [[19.0760, 72.8777], [18.5204, 73.8567]],  // Mumbai to Pune
      [[19.0760, 72.8777], [12.9716, 77.5946]],  // Mumbai to Bangalore
      [[12.9716, 77.5946], [1.3521, 103.8198]],  // Bangalore to Singapore
      [[1.3521, 103.8198], [35.6895, 139.6917]],  // Singapore to Tokyo
      [[51.5074, -0.1276], [35.6895, 139.6917]],  // London to Tokyo
      [[40.7128, -74.006], [1.3521, 103.8198]],  // New York to Singapore
    ];

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

  const forecastData = {
    "Mumbai Hub": {
      projectedNet: "₹18.4L",
      growth: "+16.8%",
      marginTarget: "28.5%",
      points: [
        { label: "Q1", value: 3.2, display: "₹3.2L" },
        { label: "Q2", value: 4.5, display: "₹4.5L" },
        { label: "Q3", value: 5.1, display: "₹5.1L" },
        { label: "Q4", value: 5.6, display: "₹5.6L" }
      ]
    },
    "Delhi Branch": {
      projectedNet: "₹12.1L",
      growth: "+11.2%",
      marginTarget: "22.0%",
      points: [
        { label: "Q1", value: 2.1, display: "₹2.1L" },
        { label: "Q2", value: 2.8, display: "₹2.8L" },
        { label: "Q3", value: 3.4, display: "₹3.4L" },
        { label: "Q4", value: 3.8, display: "₹3.8L" }
      ]
    },
    "Bangalore Branch": {
      projectedNet: "₹15.8L",
      growth: "+14.5%",
      marginTarget: "26.2%",
      points: [
        { label: "Q1", value: 2.8, display: "₹2.8L" },
        { label: "Q2", value: 3.9, display: "₹3.9L" },
        { label: "Q3", value: 4.3, display: "₹4.3L" },
        { label: "Q4", value: 4.8, display: "₹4.8L" }
      ]
    },
    "Pune Depot": {
      projectedNet: "₹7.4L",
      growth: "+8.9%",
      marginTarget: "19.5%",
      points: [
        { label: "Q1", value: 1.4, display: "₹1.4L" },
        { label: "Q2", value: 1.8, display: "₹1.8L" },
        { label: "Q3", value: 2.0, display: "₹2.0L" },
        { label: "Q4", value: 2.2, display: "₹2.2L" }
      ]
    },
    "New York Hub": {
      projectedNet: "$32.5M",
      growth: "+18.2%",
      marginTarget: "31.0%",
      points: [
        { label: "Q1", value: 6.8, display: "$6.8M" },
        { label: "Q2", value: 8.2, display: "$8.2M" },
        { label: "Q3", value: 8.9, display: "$8.9M" },
        { label: "Q4", value: 8.6, display: "$8.6M" }
      ]
    },
    "London Branch": {
      projectedNet: "£21.3M",
      growth: "+12.5%",
      marginTarget: "24.8%",
      points: [
        { label: "Q1", value: 4.5, display: "£4.5M" },
        { label: "Q2", value: 5.3, display: "£5.3M" },
        { label: "Q3", value: 5.7, display: "£5.7M" },
        { label: "Q4", value: 5.8, display: "£5.8M" }
      ]
    },
    "Tokyo Depot": {
      projectedNet: "¥28.7M",
      growth: "+15.3%",
      marginTarget: "27.5%",
      points: [
        { label: "Q1", value: 6.2, display: "¥6.2M" },
        { label: "Q2", value: 7.1, display: "¥7.1M" },
        { label: "Q3", value: 7.6, display: "¥7.6M" },
        { label: "Q4", value: 7.8, display: "¥7.8M" }
      ]
    },
    "Singapore Hub": {
      projectedNet: "S$16.8M",
      growth: "+19.7%",
      marginTarget: "29.2%",
      points: [
        { label: "Q1", value: 3.5, display: "S$3.5M" },
        { label: "Q2", value: 4.2, display: "S$4.2M" },
        { label: "Q3", value: 4.5, display: "S$4.5M" },
        { label: "Q4", value: 4.6, display: "S$4.6M" }
      ]
    }
  };

  const renderAdvancedProfitForecast = () => {
    const data = forecastData[forecastBranch] || forecastData["Mumbai Hub"];
    const points = data.points;
    const getY = (val) => 115 - (val / 6.0) * 85;

    // Generate SVG path for line
    const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${40 + idx * 60},${getY(p.value)}`).join(' ');
    // Generate SVG path for area fill under the line
    const areaD = `${pathD} L 220,120 L 40,120 Z`;

    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col justify-between h-full">
        <div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 font-extrabold">Executive Forecasting</span>
              <h3 className="text-lg font-black text-slate-900 mt-1">Advanced Profit Projections</h3>
            </div>
            {/* Branch Selector Dropdown */}
            <select
              value={forecastBranch}
              onChange={(e) => setForecastBranch(e.target.value)}
              className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-[11px] font-black outline-none cursor-pointer"
            >
              {branchesList.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Quick Margins / Target Performance Stats */}
          <div className="grid grid-cols-3 gap-2 mt-4 py-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Net Projected</span>
              <span className="text-xs font-black text-slate-800">{data.projectedNet}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Growth Rate</span>
              <span className="text-xs font-black text-emerald-600 flex items-center gap-0.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
                {data.growth}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Margin Target</span>
              <span className="text-xs font-black text-slate-800">{data.marginTarget}</span>
            </div>
          </div>
        </div>

        {/* Custom High-Fidelity SVG Chart */}
        <div className="relative mt-4 flex items-center justify-center bg-emerald-50/20 border border-emerald-100/30 rounded-2xl p-2">
          <svg width="100%" height="135" viewBox="0 0 260 135" className="overflow-visible select-none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
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
            <path d={pathD} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Points & Hover Tooltips */}
            {points.map((p, idx) => {
              const x = 40 + idx * 60;
              const y = getY(p.value);
              return (
                <g key={p.label} className="group cursor-pointer">
                  {/* Outer circle for hover effect */}
                  <circle cx={x} cy={y} r="8" fill="rgba(16, 185, 129, 0.15)" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  {/* Point circle */}
                  <circle cx={x} cy={y} r="4.5" fill="#059669" stroke="#FFF" strokeWidth="1.5" />
                  {/* Value Text Badge */}
                  <text x={x} y={y - 9} fill="#047857" fontSize="8.5" fontWeight="bold" textAnchor="middle" className="transition-all duration-300">
                    {p.display}
                  </text>
                  {/* Label Text below axis */}
                  <text x={x} y="130" fill="#64748B" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
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
    if (selectedBranchPage === "Delhi Branch") {
      aiDirective = "⚠️ CRITICAL WARNING: Fresh bread, organic milk, and potato chips stocks have fell under 10% safety thresholds. AI routing engine suggests immediate stock dispatch of 30 units of Coke and 15 units of Bread from Pune Depot.";
    } else if (selectedBranchPage === "Pune Depot") {
      aiDirective = "⚠️ OVERSTOCK ALERT: Dairy holdings are currently exceeding safety levels by 4x (98% capacity utilization). AI recommends dispatching excess Butter and Milk to Delhi Branch to prevent expiration and optimize consolidation margins.";
    } else if (selectedBranchPage === "Mumbai Hub") {
      aiDirective = "Operations running at peak efficiency. Local beverage supply streams are optimal. Suggest setting up proactive automated reorder cycles for next week's expected rainfall period.";
    } else {
      aiDirective = "Performance metrics calibrated. Average safety stock levels are at 24% over buffer. Category health score is high. Recommended: Maintain current standard inventory policies.";
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
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6 items-start">
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
                    <th className="py-3 px-4 text-right">Action</th>
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

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => triggerQuickTransferFill(item.id, selectedBranchPage)}
                            className="px-2.5 py-1.5 rounded-lg border border-emerald-600 text-emerald-800 font-bold text-[10px] uppercase hover:bg-emerald-50 tracking-wider transition-all cursor-pointer"
                          >
                            Quick Refill
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Dispatch Desk Box */}
          <div id="transfer-desk-container" className="bg-white border border-slate-200 rounded-3xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Direct logistics desk</span>
              <h3 className="text-lg font-black text-slate-900 mt-1">Direct Stock Transfer</h3>
            </div>

            <form onSubmit={handleStockTransfer} className="space-y-4 text-xs font-semibold text-slate-600">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Source (Supply Warehouse)</label>
                <select
                  value={transferForm.source}
                  onChange={(e) => setTransferForm({ ...transferForm, source: e.target.value })}
                  className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none cursor-pointer font-bold w-full"
                >
                  {branchesList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
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
                  <select
                    value={transferForm.productId}
                    onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                    className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none cursor-pointer font-bold w-full"
                  >
                    {products.map(p => {
                      const sourceStock = branchStocksMap[p.id]?.[transferForm.source] ?? 0;
                      return <option key={p.id} value={p.id}>{p.name} (Source Stock: {sourceStock})</option>;
                    })}
                  </select>
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
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // CONSOLIDATED OVERVIEW VIEW (DEFAULT)
  // ----------------------------------------------------
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
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        {/* Centralized Stock Transfer Desk */}
        <div id="transfer-desk-container" className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col h-[400px] overflow-hidden">
          <div className="mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Logistics dispatch</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Inter-Branch Stock Transfers</h3>
          </div>

          <form onSubmit={handleStockTransfer} className="space-y-4 text-xs font-semibold text-slate-600 flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Source Branch (Overstock)</label>
                <select
                  value={transferForm.source}
                  onChange={(e) => setTransferForm({ ...transferForm, source: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none cursor-pointer font-bold w-full"
                >
                  {branchesList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Destination Branch</label>
                <select
                  value={transferForm.destination}
                  onChange={(e) => setTransferForm({ ...transferForm, destination: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none cursor-pointer font-bold w-full"
                >
                  {branchesList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Select Product SKU</label>
                <select
                  value={transferForm.productId}
                  onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none cursor-pointer font-bold w-full"
                >
                  {products.map(p => {
                    const sourceStock = branchStocksMap[p.id]?.[transferForm.source] ?? 0;
                    return <option key={p.id} value={p.id}>{p.name} (Source Stock: {sourceStock})</option>;
                  })}
                </select>
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


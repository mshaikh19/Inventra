import React, { useState } from "react";

export default function MediumDashboard({ products, onUpdateProducts, tierAccent, tierAccentSoft }) {
  const [selectedRange, setSelectedRange] = useState("30d");
  const [approvedPOs, setApprovedPOs] = useState([]);
  const [poApprovalsLoading, setPoApprovalsLoading] = useState(false);
  const [showPOSuccess, setShowPOSuccess] = useState(false);

  // Supplier Database
  const [suppliers, setSuppliers] = useState([
    { name: "Apex Foods Distributor", category: "Dairy & Perishables", fillRate: "98.2%", leadTime: "1.5 Days", score: 95 },
    { name: "Standard Flour Mills", category: "Bakery Staples", fillRate: "91.5%", leadTime: "3.2 Days", score: 84 },
    { name: "Metro Beverages Inc.", category: "Beverages", fillRate: "97.8%", leadTime: "2.0 Days", score: 92 },
    { name: "Snacks Group India", category: "Snacks & Munchies", fillRate: "89.4%", leadTime: "4.5 Days", score: 79 },
  ]);

  // Employee action logs
  const logs = [
    { time: "12:44 PM", user: "Manager Sameer", action: "Updated stock for Bread", target: "+50 units" },
    { time: "11:15 AM", user: "Cashier Priya", action: "Generated Invoice #INV-1002", target: "₹2,480" },
    { time: "09:30 AM", user: "Manager Sameer", action: "Triggered ML Demand Calibrator", target: "Success" },
    { time: "Yesterday", user: "System Scheduler", action: "Consolidated Daily Tax Ledger", target: "Synced" },
  ];

  // Dynamic PO Recommendations for products that are low stock
  const poRecommendations = products
    .filter(p => p.stock <= (p.reorderLevel || 10))
    .map(p => ({
      ...p,
      suggestedOrder: Math.ceil(((p.reorderLevel || 10) * 3) - p.stock),
      supplier: p.category === "Dairy" ? "Apex Foods Distributor" : p.category === "Bakery" ? "Standard Flour Mills" : "Metro Beverages Inc."
    }));

  const handleTogglePOSelection = (id) => {
    setApprovedPOs(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllPOs = () => {
    if (approvedPOs.length === poRecommendations.length) {
      setApprovedPOs([]);
    } else {
      setApprovedPOs(poRecommendations.map(r => r.id));
    }
  };

  const handleApproveSelectedPOs = () => {
    if (approvedPOs.length === 0) return;
    setPoApprovalsLoading(true);

    setTimeout(() => {
      // Update stock levels of approved products
      const updatedProducts = products.map(p => {
        if (approvedPOs.includes(p.id)) {
          const rec = poRecommendations.find(r => r.id === p.id);
          const addedStock = rec ? rec.suggestedOrder : 50;
          return { ...p, stock: p.stock + addedStock };
        }
        return p;
      });

      onUpdateProducts(updatedProducts);
      setPoApprovalsLoading(false);
      setApprovedPOs([]);
      setShowPOSuccess(true);
      setTimeout(() => setShowPOSuccess(false), 3000);
    }, 1500);
  };

  // Custom Double-Path Area SVG Chart (Actual + Confidence Interval Band)
  const renderAdvancedChart = () => {
    const width = 450;
    const height = 150;
    const padding = 20;

    // Data points representing forecasting forecast bounds
    const dates = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const baseLine = [120, 145, 130, 185, 220, 290, 310];
    const upperLine = [140, 170, 155, 215, 255, 335, 355];
    const lowerLine = [100, 120, 105, 155, 185, 245, 265];

    const maxVal = Math.max(...upperLine);
    const minVal = Math.min(...lowerLine);
    const range = maxVal - minVal || 1;

    const getX = (index) => padding + (index / (dates.length - 1)) * (width - padding * 2);
    const getY = (val) => height - padding - ((val - minVal) / range) * (height - padding * 2);

    // Generate Path descriptions
    const baseCoords = baseLine.map((val, idx) => `${getX(idx)},${getY(val)}`);
    const upperCoords = upperLine.map((val, idx) => `${getX(idx)},${getY(val)}`);
    const lowerCoords = lowerLine.map((val, idx) => `${getX(idx)},${getY(val)}`);

    // Confidence interval shading: upper coordinates followed by lower coordinates reversed
    const shadePath = [
      `M ${upperCoords[0]}`,
      ...upperCoords.slice(1).map(c => `L ${c}`),
      ...lowerCoords.reverse().map(c => `L ${c}`),
      "Z"
    ].join(" ");

    const baseD = `M ${baseCoords.join(" L ")}`;

    return (
      <div className="w-full overflow-x-auto">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible select-none">
          {/* Grids */}
          {Array.from({ length: 4 }).map((_, i) => {
            const y = padding + (i / 3) * (height - padding * 2);
            return <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />;
          })}
          
          {/* Shaded confidence interval band */}
          <path d={shadePath} fill="rgba(217, 119, 6, 0.04)" />

          {/* Actual forecast line */}
          <path d={baseD} fill="none" stroke={tierAccent} strokeWidth="3" strokeLinecap="round" />

          {/* Points for actual line */}
          {baseLine.map((val, idx) => (
            <circle key={idx} cx={getX(idx)} cy={getY(val)} r="3.5" fill="#FFFFFF" stroke={tierAccent} strokeWidth="2.5" />
          ))}

          {/* Date Labels */}
          {dates.map((date, idx) => (
            <text key={idx} x={getX(idx)} y={height - 2} fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">
              {date}
            </text>
          ))}
        </svg>
      </div>
    );
  };

  // Segmented Ring / Donut SVG Chart for Category Sales
  const renderCategoryRing = () => {
    const size = 120;
    const center = size / 2;
    const radius = 40;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * radius;
    
    // Segment percentages: Dairy 40%, Beverages 30%, Snacks 20%, Bakery 10%
    const categories = [
      { label: "Dairy", val: 40, color: "#10B981" },
      { label: "Beverages", val: 30, color: "#0EA5E9" },
      { label: "Snacks", val: 20, color: "#D97706" },
      { label: "Bakery", val: 10, color: "#EC4899" },
    ];

    let currentOffset = 0;

    return (
      <div className="flex items-center gap-6">
        <svg width={size} height={size}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
          {categories.map((c, i) => {
            const dashArray = `${(c.val / 100) * circumference} ${circumference}`;
            const dashOffset = currentOffset;
            currentOffset -= (c.val / 100) * circumference;
            return (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={c.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${center} ${center})`}
                strokeLinecap="round"
              />
            );
          })}
          {/* Middle text overlay */}
          <text x={center} y={center + 4} textAnchor="middle" fill="#0F172A" fontSize="10" fontWeight="900">
            SALES
          </text>
        </svg>

        <div className="space-y-1.5 text-xs font-semibold text-slate-600">
          {categories.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              <span className="text-slate-800">{c.label}</span>
              <span className="text-slate-400 font-black">{c.val}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-left">
      {/* Dynamic Alerts and PO Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        {/* SVG Advanced Forecast Chart */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">ML Predictions</span>
              <h3 className="text-lg font-black text-slate-900 mt-1">Holiday-Aware Demand Forecast</h3>
            </div>
            <div className="flex gap-1.5 bg-slate-100 p-1 border border-slate-200 rounded-xl">
              {["7d", "30d"].map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRange(r)}
                  className={`px-2.5 py-1 text-[10px] uppercase font-black tracking-wider rounded-lg transition-colors cursor-pointer ${selectedRange === r ? 'bg-white text-slate-900 border border-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
            <p className="text-xs text-slate-600 leading-normal font-semibold">
              <span className="text-slate-900 font-bold block mb-0.5">Holiday Spillover Detected</span>
              Forecasting models calculated seasonal weekend multipliers incorporating upcoming state holidays. Confidence bounds adjusted within standard 95% threshold.
            </p>
          </div>

          {renderAdvancedChart()}
        </div>

        {/* PO Reordering System */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col h-[348px] overflow-hidden">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Procurement desk</span>
              <h3 className="text-lg font-black text-slate-900 mt-1">Smart Reorder Recommendations</h3>
            </div>
            {poRecommendations.length > 0 && (
              <button 
                onClick={handleSelectAllPOs} 
                className="text-[10px] font-black uppercase tracking-wider text-amber-600 hover:text-amber-700 transition-colors cursor-pointer font-bold"
              >
                {approvedPOs.length === poRecommendations.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {/* List of recommendations */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
            {poRecommendations.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-slate-400 text-xs font-semibold text-center">
                <svg className="h-8 w-8 text-slate-300 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                </svg>
                All stock levels exceed minimum reorder limits.
              </div>
            ) : (
              poRecommendations.map(r => (
                <div 
                  key={r.id} 
                  onClick={() => handleTogglePOSelection(r.id)}
                  className={`flex justify-between items-center p-3 rounded-2xl border transition-all cursor-pointer ${approvedPOs.includes(r.id) ? 'bg-amber-50/70 border-amber-300 shadow-[0_2px_8px_rgba(217,119,6,0.04)]' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/70 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      checked={approvedPOs.includes(r.id)}
                      onChange={() => {}} // Handled by outer click
                      className="h-4 w-4 text-amber-600 rounded border-slate-300 bg-white cursor-pointer"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 leading-tight">{r.name}</h4>
                      <span className="text-[10px] text-slate-400 mt-0.5 font-semibold">Stock: {r.stock} / PO: +{r.suggestedOrder} units</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md">
                    {r.category === "Dairy" ? "Apex" : r.category === "Bakery" ? "Standard" : "Metro"}
                  </span>
                </div>
              ))
            )}
          </div>

          {showPOSuccess && (
            <div className="text-center text-xs font-bold text-emerald-600 py-2 animate-bounce">
              ✓ Selected Purchase Orders approved and sent to Suppliers!
            </div>
          )}

          <button
            onClick={handleApproveSelectedPOs}
            disabled={approvedPOs.length === 0 || poApprovalsLoading}
            className="w-full py-3.5 rounded-xl font-bold uppercase text-xs tracking-wider text-white shadow-md hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: tierAccent }}
          >
            {poApprovalsLoading ? "Approving POs..." : `Approve Selected POs (${approvedPOs.length})`}
          </button>
        </div>
      </div>

      {/* Row 2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Category segment ring chart */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Inventory Health</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Category-wise Sales share</h3>
          </div>
          <div className="py-2 flex justify-center">
            {renderCategoryRing()}
          </div>
        </div>

        {/* Supplier analytics */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Logistics KPIs</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Supplier Performance Analytics</h3>
          </div>

          <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
            {suppliers.map((s, idx) => (
              <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">{s.name}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">{s.category} • Lead: {s.leadTime}</span>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Fill Rate</span>
                    <span className="text-xs font-black text-slate-800">{s.fillRate}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${s.score >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-250'}`}>
                    {s.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Employee action log */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Operations Feed</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Employee Activity Logs</h3>
          </div>

          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
            {logs.map((l, idx) => (
              <div key={idx} className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0 text-xs font-semibold">
                <div>
                  <div className="text-slate-850 font-bold">{l.action}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{l.user} • {l.time}</div>
                </div>
                <span className="px-2 py-1 rounded bg-slate-50 border border-slate-200 font-black text-[10px] text-slate-500">
                  {l.target}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

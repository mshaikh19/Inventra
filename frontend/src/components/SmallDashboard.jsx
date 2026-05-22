import React from "react";

export default function SmallDashboard({ products, salesCount, salesRevenue, notifications, tierAccent, tierAccentSoft }) {
  // Simple analytics logic
  const lowStockProducts = products.filter(p => p.stock <= (p.reorderLevel || 10));
  
  // Expiry dates checklist
  const upcomingExpiries = products
    .filter(p => p.expiryDate)
    .map(p => {
      const expDate = new Date(p.expiryDate);
      const today = new Date("2026-05-22"); // Fixed mock date matching context
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { ...p, daysLeft: diffDays };
    })
    .filter(p => p.daysLeft > 0 && p.daysLeft <= 10)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Fast moving products
  const fastMoving = [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 3);

  // Custom SVG Sparkline for Basic Demand Forecasting
  const renderSparkline = (points, color) => {
    const width = 140;
    const height = 40;
    const maxVal = Math.max(...points);
    const minVal = Math.min(...points);
    const range = maxVal - minVal || 1;
    
    const coordinates = points.map((p, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((p - minVal) / range) * (height - 6) - 3;
      return `${x},${y}`;
    }).join(" ");

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coordinates}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-6 text-left">
      {/* Festival Demand Alert Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-sky-50 p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Soft blue light mode background glow */}
        <div className="absolute w-64 h-64 bg-sky-500/5 blur-[80px] rounded-full -top-10 -left-10 pointer-events-none" />
        
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center shrink-0 text-sky-600 shadow-sm">
            <svg className="h-6 w-6 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.24em] text-sky-600">AI Festival Demand Trigger</span>
            <h3 className="text-base font-black text-slate-900 mt-0.5">Upcoming Weekend Peak & Regional Festival Season</h3>
            <p className="text-xs text-slate-655 font-semibold mt-1 leading-relaxed max-w-2xl">
              Demand models predict a <span className="text-sky-600 font-black">+1.8x multiplier</span> on all soft beverage stocks and dairy products over the next 4 days.
            </p>
          </div>
        </div>
        <div className="relative z-10">
          <div className="px-3.5 py-1.5 rounded-xl bg-sky-100/50 border border-sky-200 text-[10px] uppercase font-black tracking-widest text-sky-700 select-none">
            Active Warning
          </div>
        </div>
      </div>

      {/* Grid widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* KPI Panel */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">At a Glance</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Daily Sales Summary</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Gross revenue</span>
              <div className="text-2xl font-black text-slate-950 mt-1">₹{salesRevenue.toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Transactions</span>
              <div className="text-2xl font-black text-slate-950 mt-1">{salesCount}</div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex justify-between items-center text-xs font-semibold text-slate-600">
            <span>Low-Stock Alerts</span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${lowStockProducts.length > 0 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              {lowStockProducts.length} items
            </span>
          </div>
        </div>

        {/* Basic Demand Forecasting */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Starter Forecasting</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Basic Demand Sparklines</h3>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Bakery Goods</span>
                <span className="text-[10px] text-slate-400 font-semibold">Stability: 92%</span>
              </div>
              {renderSparkline([10, 15, 8, 22, 14, 25, 30], "#0284C7")}
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Dairy Items</span>
                <span className="text-[10px] text-slate-400 font-semibold">Stability: 85%</span>
              </div>
              {renderSparkline([40, 32, 45, 55, 38, 62, 58], "#10B981")}
            </div>
          </div>
        </div>

        {/* Smart stock suggestions */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">AI Recommender</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Smart Stock Suggestions</h3>
          </div>

          <div className="space-y-2.5">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <span className="h-2 w-2 rounded-full shrink-0 mt-2" style={{ backgroundColor: tierAccent }} />
              <div className="text-xs font-semibold leading-relaxed text-slate-600">
                <span className="text-slate-800 font-bold block mb-0.5">Dairy Order Recommendation</span>
                Restock 20 units of <span className="font-bold" style={{ color: tierAccent }}>Milk 1L</span>. Daily consumption velocity is outpacing standard morning supply cycles.
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <span className="h-2 w-2 rounded-full shrink-0 mt-2" style={{ backgroundColor: tierAccent }} />
              <div className="text-xs font-semibold leading-relaxed text-slate-600">
                <span className="text-slate-800 font-bold block mb-0.5">Snacks Reorder</span>
                Purchase order size should double for <span className="font-bold" style={{ color: tierAccent }}>Potato Chips</span> due to high weekend evening leisure trends.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiry notifications */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Inventory Health</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Expiry Notifications</h3>
          </div>

          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
            {upcomingExpiries.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No perishables near expiration currently in stock database.</p>
            ) : (
              upcomingExpiries.map(p => (
                <div key={p.id} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{p.category} • {p.stock} units in stock</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-black tracking-wider border ${p.daysLeft <= 2 ? 'bg-rose-50 text-rose-600 border-rose-250' : 'bg-amber-50 text-amber-600 border-amber-250'}`}>
                    {p.daysLeft} days left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fast-Moving products tracking */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Operations Control</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Fast-Moving Product Tracking</h3>
          </div>

          <div className="space-y-4 max-h-48 overflow-y-auto pr-1">
            {fastMoving.map(p => {
              // Calculate percent of maximum possible sold (say 500 max)
              const percent = Math.min(100, Math.round(((p.sold || 0) / 500) * 100));
              return (
                <div key={p.id} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-800">{p.name}</span>
                    <span className="text-slate-400">{p.sold || 0} sold</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, background: tierAccent }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

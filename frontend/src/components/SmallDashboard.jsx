import React from "react";

export default function SmallDashboard({ products, salesCount, salesRevenue, notifications, tierAccent }) {
  const lowStockProducts = products.filter((p) => p.stock <= (p.reorderLevel || 10));

  const upcomingExpiries = products
    .filter((p) => p.expiryDate)
    .map((p) => {
      const expDate = new Date(p.expiryDate);
      const today = new Date("2026-05-22");
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { ...p, daysLeft: diffDays };
    })
    .filter((p) => p.daysLeft > 0 && p.daysLeft <= 10)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const fastMoving = [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 4);

  const topMetrics = [
    { label: "Daily Sales Summary", value: `₹${salesRevenue.toLocaleString()}`, note: "+12.4% vs yesterday", icon: "💳" },
    { label: "Inventory Tracking", value: products.length.toLocaleString(), note: "Live SKU count", icon: "📦" },
    { label: "Low Stock Alerts", value: lowStockProducts.length.toString(), note: "Action required", icon: "⚠️" },
    { label: "Expiry Notifications", value: upcomingExpiries.length.toString(), note: "Expiring soon", icon: "⏳" },
  ];

  return (
    <div className="space-y-6 text-left">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {topMetrics.map((card, index) => (
          <div
            key={card.label}
            className={`rounded-3xl border bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] ${
              index === 2 ? "border-rose-100" : index === 3 ? "border-amber-100" : "border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{card.label}</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{card.value}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{card.note}</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-lg border border-slate-100">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.85fr] gap-6 items-start">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-black text-slate-900">Demand Forecasting</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">Short-range sales pulse for bakery, dairy, and snacks.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500">
              <span className="rounded-full bg-white px-2 py-1 text-slate-700 shadow-sm">7 Days</span>
              <span className="px-2 py-1">30 Days</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 h-[220px] items-end rounded-3xl bg-slate-50/70 border border-slate-100 p-4">
            {[48, 36, 60, 52, 74, 44, 39].map((height, i) => (
              <div key={i} className="flex flex-col items-center justify-end h-full">
                <div
                  className="w-full rounded-t-2xl bg-gradient-to-t from-sky-100 to-slate-200/80 border border-slate-200/80"
                  style={{ height: `${height}%`, minHeight: 28 }}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 flex items-start gap-3">
            <div className="mt-0.5 text-sky-600">🏛️</div>
            <div>
              <div className="text-xs font-black text-slate-900">Festival Demand Alert</div>
              <div className="mt-1 text-xs font-medium text-slate-600">
                Regional holiday on Friday. Suggested 22% stock increase for dairy and snacks.
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-sky-200 bg-white p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2">
            <span className="text-sky-500 text-lg">✦</span>
            <h3 className="text-lg font-black text-slate-900">Smart Stock</h3>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-black text-slate-900">Fast-Moving: Organic Milk</div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Optimize</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">Velocity increased by 40%. Restock by Wednesday to avoid stockout.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-black text-slate-900">Bulk Order: Paper Towels</div>
                <span className="rounded-full bg-sky-100 px-2 py-1 text-[9px] font-black uppercase text-sky-700">Savings</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">Vendor discount active. Save ₹45 by ordering 12 units now.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-black text-slate-900">Slow Item: Greek Yogurt</div>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-700">Promo</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">Expiry approaching in 5 days. Run a buy 1 get 1 offer to clear stock.</p>
            </div>
          </div>

          <button className="mt-4 w-full rounded-2xl border border-slate-200 bg-white py-3 text-xs font-black uppercase tracking-[0.24em] text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
            View All Suggestions
          </button>
        </aside>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-black text-slate-900">Fast-Moving Inventory</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">Top performing products based on sales velocity.</p>
            </div>
          </div>

          <div className="space-y-3">
            {fastMoving.map((p) => {
              const percent = Math.min(100, Math.round(((p.sold || 0) / 500) * 100));
              return (
                <div key={p.id} className="grid grid-cols-[1.5fr_0.6fr_0.6fr_0.3fr] gap-3 items-center rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs">
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="font-semibold text-slate-600 text-right">{p.sold || 0} sold</div>
                  <div className="font-semibold text-slate-600 text-right">{p.stock} left</div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${percent}%`, background: tierAccent }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-black text-slate-900">Recent Activity</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">Operational events captured from the live session.</p>
            </div>
            <div className="h-11 w-11 rounded-full bg-sky-600 text-white grid place-items-center font-black shadow-md">+</div>
          </div>

          <div className="space-y-3">
            {notifications.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-sky-100 text-sky-700 grid place-items-center font-black">
                  {item.type === "expiry" ? "!" : item.type === "low_stock" ? "▲" : "•"}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 leading-snug">{item.text}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {item.type.replace("_", " ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

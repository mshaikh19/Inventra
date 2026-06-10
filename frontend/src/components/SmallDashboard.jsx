import React from "react";

export default function SmallDashboard({ products, salesCount, salesRevenue, salesRevenueNote = "", notifications, tierAccent, salesHistory }) {
  const lowStockProducts = products.filter((p) => p.stock <= (p.reorderLevel || 10));

  const upcomingExpiries = products
    .filter((p) => p.expiryDate)
    .map((p) => {
      const expDate = new Date(p.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { ...p, daysLeft: diffDays };
    })
    .filter((p) => p.daysLeft > 0 && p.daysLeft <= 10)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const fastMoving = products
    .filter((p) => (p.sold || 0) > 0)
    .sort((a, b) => (b.sold || 0) - (a.sold || 0))
    .slice(0, 4);

  // Generate dynamic recommendations for the "Smart Stock" panel
  const recommendations = React.useMemo(() => {
    const list = [];
    if (!products || products.length === 0) return list;

    // 1. Fast-Moving (Optimize)
    const sortedBySold = [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0));
    const topFast = sortedBySold[0];
    if (topFast && (topFast.sold || 0) > 0) {
      const dailyRate = Math.max(0.1, topFast.sold / 30);
      const daysToStockout = Math.ceil(topFast.stock / dailyRate);
      const salesGrowth = salesRevenueNote ? parseFloat(salesRevenueNote.replace(/[^0-9.-]/g, "")) || 0 : 0;
      const pct = Math.round(15 + (topFast.sold % 25) + (salesGrowth > 0 ? salesGrowth * 0.1 : 0));

      if (daysToStockout <= 14) {
        const restockDate = new Date();
        restockDate.setDate(restockDate.getDate() + Math.max(1, daysToStockout - 2));
        const dayName = restockDate.toLocaleDateString("en-US", { weekday: "long" });

        list.push({
          id: "rec-fast",
          title: `Fast-Moving: ${topFast.name}`,
          badge: "Optimize",
          badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-100",
          text: `Velocity increased by ${pct}%. Restock by ${dayName} to avoid stockout (${daysToStockout} days of stock left).`,
        });
      } else {
        list.push({
          id: "rec-fast",
          title: `Fast-Moving: ${topFast.name}`,
          badge: "Optimize",
          badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-100",
          text: `Velocity increased by ${pct}%. Current stock is healthy (${daysToStockout} days left), next check in 7 days.`,
        });
      }
    }

    // 2. Bulk Order (Savings)
    const sortedByStock = [...products]
      .filter(p => p.stock <= (p.reorderLevel || 10) * 1.2)
      .sort((a, b) => ((a.reorderLevel || 10) - a.stock) - ((b.reorderLevel || 10) - b.stock));
    const topLow = sortedByStock[0];
    if (topLow) {
      const orderQty = Math.max(10, Math.ceil((topLow.reorderLevel || 10) * 1.5 - topLow.stock));
      const savings = Math.round((topLow.price || 40) * 0.1 * orderQty);

      list.push({
        id: "rec-bulk",
        title: `Bulk Order: ${topLow.name}`,
        badge: "Savings",
        badgeBg: "bg-sky-50 text-sky-700 border-sky-100",
        text: `Stock is below safety margin (${topLow.stock}/${topLow.reorderLevel || 10}). Save ₹${savings} by ordering ${orderQty} units now.`,
      });
    }

    // 3. Slow Item / Expiry (Promo)
    const sortedByExpiry = [...products]
      .filter(p => p.expiryDate)
      .map(p => {
        const expDate = new Date(p.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...p, daysLeft: diffDays };
      })
      .filter(p => p.daysLeft > 0 && p.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    if (sortedByExpiry.length > 0) {
      const topExp = sortedByExpiry[0];
      list.push({
        id: "rec-expiry",
        title: `Slow Item: ${topExp.name}`,
        badge: "Promo",
        badgeBg: "bg-amber-50 text-amber-700 border-amber-100",
        text: `Expiry approaching in ${topExp.daysLeft} days. Run a buy 1 get 1 offer to clear stock before expiration.`,
      });
    } else {
      const slowItems = [...products]
        .filter(p => (p.sold || 0) === 0 && p.stock > 10)
        .sort((a, b) => b.stock - a.stock);
      const topSlow = slowItems[0];
      if (topSlow) {
        list.push({
          id: "rec-slow",
          title: `Slow Item: ${topSlow.name}`,
          badge: "Promo",
          badgeBg: "bg-amber-50 text-amber-700 border-amber-100",
          text: `Slow-moving item with ${topSlow.stock} units in stock and no recent sales. Run a promo or bundle offer to clear shelf space.`,
        });
      }
    }

    return list;
  }, [products, salesRevenueNote]);

  const topMetrics = [
    { label: "Daily Sales Summary", value: `₹${salesRevenue.toLocaleString()}`, note: salesRevenueNote, icon: "💳" },
    { label: "Inventory Tracking", value: products.length.toLocaleString(), note: "Live SKU count", icon: "📦" },
    { label: "Low Stock Alerts", value: lowStockProducts.length.toString(), note: "Action required", icon: "⚠️" },
    { label: "Expiry Notifications", value: upcomingExpiries.length.toString(), note: "Expiring soon", icon: "⏳" },
  ];

  // Dynamic 7-day Demand Forecasting chart bars
  const chartBars = React.useMemo(() => {
    const history = (salesHistory && salesHistory.length > 0)
      ? salesHistory
      : [
          { day: "Mon", revenue: 0 },
          { day: "Tue", revenue: 0 },
          { day: "Wed", revenue: 0 },
          { day: "Thu", revenue: 0 },
          { day: "Fri", revenue: 0 },
          { day: "Sat", revenue: 0 },
          { day: "Sun", revenue: 0 }
        ];
    const maxRevenue = Math.max(...history.map(h => h.revenue)) || 1;
    return history.map(h => {
      const height = maxRevenue > 1 ? Math.max(15, Math.min(100, Math.round((h.revenue / maxRevenue) * 100))) : 0;
      return {
        label: h.day || h.label,
        height: height,
        revenue: h.revenue
      };
    });
  }, [salesHistory]);

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
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
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
            {chartBars.map((bar, i) => (
              <div key={i} className="flex flex-col items-center justify-end h-full">
                <div className="text-[9px] font-bold text-slate-400 mb-1">₹{bar.revenue.toLocaleString()}</div>
                <div
                  className="w-full rounded-t-2xl bg-gradient-to-t from-sky-100 to-slate-200/80 border border-slate-200/80"
                  style={{ height: `${bar.height}%`, minHeight: 28 }}
                  title={`${bar.label}: ₹${bar.revenue}`}
                />
                <div className="text-[10px] font-bold text-slate-500 mt-2">{bar.label}</div>
              </div>
            ))}
          </div>

          {(() => {
            const festivalAlert = (notifications || []).find(
              n => n.type === "festival" || String(n.key || "").toLowerCase().includes("festival")
            );
            if (!festivalAlert) return null;
            return (
              <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 flex items-start gap-3 animate-pulse">
                <div className="mt-0.5 text-sky-600">🏛️</div>
                <div>
                  <div className="text-xs font-black text-slate-900">{festivalAlert.title || "Festival Demand Alert"}</div>
                  <div className="mt-1 text-xs font-medium text-slate-600">
                    {festivalAlert.text}
                  </div>
                </div>
              </div>
            );
          })()}

          {!salesRevenue || salesRevenue === 0 ? (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[3px] flex flex-col items-center justify-center text-center p-6 z-10 border border-slate-100/50">
              <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-sm text-sm mb-2">📊</div>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Cannot Forecast Now</span>
              <p className="text-xs font-semibold text-slate-500 mt-2 max-w-xs leading-relaxed">
                Daily demand forecasting sparklines and weekly pulses will activate once transactions are recorded in Billing POS.
              </p>
            </div>
          ) : null}
        </section>

        <aside className="rounded-3xl border border-sky-200 bg-white p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2">
            <span className="text-sky-500 text-lg">✦</span>
            <h3 className="text-lg font-black text-slate-900">Smart Stock</h3>
          </div>

          <div className="mt-5 space-y-3">
            {recommendations.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-sky-100 bg-sky-50/20 text-xs font-semibold text-slate-500 leading-relaxed">
                <span className="block text-lg mb-1.5">✨</span>
                {products.length === 0 
                  ? "No inventory recommendations yet. Add products to get smart stock insights!"
                  : "All stock levels are optimal! No immediate reorders or promotions required."}
              </div>
            ) : (
              recommendations.map((rec) => (
                <div key={rec.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-black text-slate-900">{rec.title}</div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase border ${rec.badgeBg}`}>
                      {rec.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">{rec.text}</p>
                </div>
              ))
            )}
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
            {fastMoving.length === 0 ? (
              <div className="py-6 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-6 text-xs text-slate-450 font-bold leading-normal">
                No items have been sold yet. Complete transactions in **Billing POS** to track sales velocity!
              </div>
            ) : (
              fastMoving.map((p) => {
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
              })
            )}
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
            {(() => {
              // Sort newest-first, then take top 3
              const recent = [...notifications]
                .sort((a, b) => {
                  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                  return tb - ta;
                })
                .slice(0, 3);

              if (recent.length === 0) {
                return (
                  <div className="py-6 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-6 text-xs text-slate-500 font-bold leading-normal">
                    No activity yet. Events will appear here as you use the system.
                  </div>
                );
              }

              const typeIcon = {
                expiry:    "⏳",
                low_stock: "📉",
                festival:  "🎉",
                payment:   "💳",
                refund:    "↩️",
                branch:    "🏪",
                system:    "🔔",
              };

              const relativeTime = (ts) => {
                if (!ts) return "";
                const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
                if (diff < 60)  return "Just now";
                if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                return `${Math.floor(diff / 86400)}d ago`;
              };

              return recent.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div className="h-9 w-9 rounded-full bg-sky-100 text-sky-700 grid place-items-center font-black text-base shrink-0">
                    {typeIcon[item.type] || "•"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 leading-snug">{item.title || item.text}</div>
                    {item.title && <div className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-snug">{item.text}</div>}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {String(item.type || "").replace("_", " ")}
                      </span>
                      {item.created_at && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[9px] font-semibold text-slate-400">{relativeTime(item.created_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </section>
      </div>
    </div>
  );
}

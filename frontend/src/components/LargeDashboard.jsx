import React, { useState } from "react";

export default function LargeDashboard({ products, onUpdateProducts, tierAccent, tierAccentSoft }) {
  const [activeBranch, setActiveBranch] = useState("Mumbai Hub");
  const [transferForm, setTransferForm] = useState({
    source: "Pune Depot",
    destination: "Delhi Branch",
    productId: products[0]?.id || "",
    quantity: 10
  });
  
  const [transferStatus, setTransferStatus] = useState("idle"); // idle, sending, success
  const [aiChat, setAiChat] = useState([
    { sender: "ai", text: "Hello Executive. Enterprise forecasting models are calibrated. You can ask me any question about branch performance, overstocks, or transfer recommendations." }
  ]);
  const [chatInput, setChatInput] = useState("");

  const branchesList = ["Mumbai Hub", "Delhi Branch", "Bangalore Branch", "Pune Depot"];

  // Mock data for branch sales comparison
  const branchMetrics = {
    "Mumbai Hub": { sales: "₹4.8L", stockLevel: "94%", health: "Optimal", alerts: 1 },
    "Delhi Branch": { sales: "₹3.6L", stockLevel: "68%", health: "Watchlist", alerts: 3 },
    "Bangalore Branch": { sales: "₹4.2L", stockLevel: "88%", health: "Optimal", alerts: 0 },
    "Pune Depot": { sales: "₹1.9L", stockLevel: "98%", health: "Overstocked", alerts: 2 },
  };

  const handleStockTransfer = (e) => {
    e.preventDefault();
    if (transferForm.source === transferForm.destination) {
      alert("Source and Destination branches cannot be the same.");
      return;
    }

    setTransferStatus("sending");

    setTimeout(() => {
      // Deduct stock from global products (simulating localized branch update)
      const updatedProducts = products.map(p => {
        if (p.id === Number(transferForm.productId)) {
          // If transfer leads to change in general stock levels
          return { ...p, stock: Math.max(0, p.stock - Number(transferForm.quantity)) };
        }
        return p;
      });

      onUpdateProducts(updatedProducts);
      setTransferStatus("success");
      setTimeout(() => setTransferStatus("idle"), 3000);
    }, 1500);
  };

  const handleAiSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setAiChat(prev => [...prev, { sender: "user", text: userText }]);
    setChatInput("");

    setTimeout(() => {
      let replyText = "I have scanned the multi-branch inventory database. Let me help you with that.";
      const query = userText.toLowerCase();

      if (query.includes("overstock") || query.includes("excess")) {
        replyText = "AI Audit identifies **Pune Depot** as overstocked by **34%** in the Bakery category (specifically Bread and Butter items). Recommended: Transfer 30 units of Bread to **Delhi Branch**, which is currently running at 10% inventory buffer.";
      } else if (query.includes("perform") || query.includes("highest") || query.includes("best")) {
        replyText = "Consolidated reports indicate **Mumbai Hub** is our highest performing node this week, logging **₹4.8L** in sales (41% of consolidated group revenue). Snacks and Beverages are leading growth velocity at 14% week-on-week.";
      } else if (query.includes("rule") || query.includes("allocate") || query.includes("allocation")) {
        replyText = "Enterprise allocation rule established: Incoming dairy consignments will auto-allocate at a ratio of **50% Mumbai Hub**, **30% Bangalore Branch**, and **20% Delhi Branch** based on historical sales indexes.";
      } else {
        replyText = "Forecasting model predicts stable demand vectors for the next 7 days across all active branch networks. Suggesting maintenance of standard 15% buffer thresholds.";
      }

      setAiChat(prev => [...prev, { sender: "ai", text: replyText }]);
    }, 1000);
  };

  const selectSuggestedPrompt = (prompt) => {
    setChatInput(prompt);
  };

  // Custom Geographical SVG Heatmap representation of branch nodes
  const renderRegionalMap = () => {
    return (
      <svg width="100%" height="160" viewBox="0 0 300 160" className="overflow-visible select-none">
        {/* Geographic background shapes */}
        <path d="M 50,20 Q 90,10 150,30 T 250,20 T 280,60 T 260,120 T 180,150 T 80,130 T 30,80 Z" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 4" />
        
        {/* Connection networks */}
        <line x1="80" y1="50" x2="160" y2="90" stroke="#E2E8F0" strokeWidth="1.5" />
        <line x1="160" y1="90" x2="220" y2="70" stroke="#E2E8F0" strokeWidth="1.5" />
        <line x1="160" y1="90" x2="120" y2="120" stroke="#E2E8F0" strokeWidth="1.5" />
        <line x1="80" y1="50" x2="120" y2="120" stroke="#E2E8F0" strokeWidth="1.5" />

        {/* Branch hotspots */}
        {/* Mumbai Hub */}
        <circle cx="80" cy="50" r="10" fill="rgba(16, 185, 129, 0.08)" />
        <circle cx="80" cy="50" r="4" fill="#059669" />
        <text x="80" y="36" fill="#334155" fontSize="8" fontWeight="bold" textAnchor="middle">Mumbai Hub</text>

        {/* Delhi Branch */}
        <circle cx="160" cy="90" r="16" fill="rgba(244, 63, 94, 0.08)" className="animate-pulse" />
        <circle cx="160" cy="90" r="5" fill="#E11D48" />
        <text x="160" y="112" fill="#E11D48" fontSize="8" fontWeight="black" textAnchor="middle">Delhi (Watchlist)</text>

        {/* Bangalore Branch */}
        <circle cx="220" cy="70" r="9" fill="rgba(16, 185, 129, 0.08)" />
        <circle cx="220" cy="70" r="4" fill="#059669" />
        <text x="220" y="56" fill="#334155" fontSize="8" fontWeight="bold" textAnchor="middle">Bangalore</text>

        {/* Pune Depot */}
        <circle cx="120" cy="120" r="14" fill="rgba(217, 119, 6, 0.08)" />
        <circle cx="120" cy="120" r="4" fill="#D97706" />
        <text x="120" y="136" fill="#334155" fontSize="8" fontWeight="bold" textAnchor="middle">Pune Depot</text>
      </svg>
    );
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top executive dashboard metrics bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {branchesList.map(branch => {
          const m = branchMetrics[branch];
          const isWatch = m.health === "Watchlist";
          const isOver = m.health === "Overstocked";
          const isActive = activeBranch === branch;
          
          return (
            <button
              key={branch}
              onClick={() => setActiveBranch(branch)}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 relative group overflow-hidden cursor-pointer ${
                isActive 
                  ? "border-emerald-600 bg-emerald-50/30" 
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
              }`}
            >
              {isActive && (
                <div className="absolute top-0 right-0 h-1.5 w-16 bg-emerald-600 rounded-bl-lg" />
              )}
              <span className="text-[9px] font-black uppercase text-slate-400">Branch Node</span>
              <h4 className={`text-[13.5px] font-bold mt-1 ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{branch}</h4>
              
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase">Sales today</span>
                  <div className="font-black text-slate-800 mt-0.5">{m.sales}</div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-extrabold uppercase">Health</span>
                  <div className={`font-black mt-0.5 ${isWatch ? 'text-rose-600' : isOver ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {m.health}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Command Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        {/* Conversational NLP AI Chat Assistant */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col h-[400px] overflow-hidden">
          <div className="mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">NLP AI Co-Pilot</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">AI-Powered Business Insights</h3>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 text-xs">
            {aiChat.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`p-3 rounded-2xl max-w-sm leading-relaxed border ${
                  msg.sender === "user" 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-950 font-bold" 
                    : "bg-slate-50 border-slate-150 text-slate-650"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Prompts suggests */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              "Identify overstocked branches",
              "Which branch leads in sales today?",
              "What is our dairy allocation rule?"
            ].map(p => (
              <button
                key={p}
                onClick={() => selectSuggestedPrompt(p)}
                className="px-2.5 py-1 text-[9px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input form */}
          <form onSubmit={handleAiSubmit} className="flex gap-2">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask AI assistant about inventory allocations..." 
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-800 placeholder-slate-400 font-semibold text-xs outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md cursor-pointer"
              style={{ background: tierAccent }}
            >
              Ask AI
            </button>
          </form>
        </div>

        {/* Centralized Stock Transfer Desk */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col h-[400px] overflow-hidden">
          <div className="mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Logistics dispatch</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Inter-Branch Stock Transfers</h3>
          </div>

          <form onSubmit={handleStockTransfer} className="space-y-4 text-xs font-semibold text-slate-600 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Source Branch (Overstock)</label>
                <select
                  value={transferForm.source}
                  onChange={(e) => setTransferForm({ ...transferForm, source: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none cursor-pointer font-bold"
                >
                  {branchesList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase text-slate-400">Destination Branch</label>
                <select
                  value={transferForm.destination}
                  onChange={(e) => setTransferForm({ ...transferForm, destination: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none cursor-pointer font-bold"
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
                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none cursor-pointer font-bold"
                >
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
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
                  className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none font-black text-center"
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
      </div>

      {/* Row 3 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SVG Geographical Heatmap */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Geographical analysis</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Regional Demand Heatmap</h3>
          </div>
          <div className="py-3 flex justify-center bg-slate-50 rounded-2xl border border-slate-100">
            {renderRegionalMap()}
          </div>
        </div>

        {/* Live branch ticker monitoring & critical alerts */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Live monitoring</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">Enterprise Alert Escalation Feed</h3>
          </div>

          <div className="space-y-3 max-h-48 overflow-y-auto pr-1 text-xs">
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
      </div>
    </div>
  );
}

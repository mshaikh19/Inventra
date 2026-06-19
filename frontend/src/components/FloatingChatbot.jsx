import React, { useState, useEffect, useRef } from "react";

const getBranchesAndProducts = () => {
  if (typeof window === "undefined") return { branches: [], productsMap: {} };
  try {
    const stored = localStorage.getItem("inventra_branches_list");
    if (!stored) return { branches: [], productsMap: {} };
    const branches = JSON.parse(stored);
    if (!Array.isArray(branches)) return { branches: [], productsMap: {} };
    
    const productsMap = {};
    branches.forEach((b) => {
      const slug = String(b.branch_name || "")
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const storedProds = localStorage.getItem(`inventra_inventory_products__${slug}`);
      if (storedProds) {
        try {
          const parsed = JSON.parse(storedProds);
          if (Array.isArray(parsed)) {
            productsMap[b.branch_name] = parsed.map((item, index) => {
              const sellingPrice = Number(item.selling_price ?? item.price ?? 0) || 0;
              const reorderLevel = Number(item.minimum_stock ?? item.reorderLevel ?? item.reorder_level ?? 0) || 0;
              const sold = Number(item.total_sales ?? item.sold ?? 0) || 0;
              return {
                id: item._id || item.product_id || item.id || `chatbot-p-${index}`,
                name: item.product_name || item.name || "Unknown Product",
                stock: Number(item.quantity ?? item.stock ?? 0) || 0,
                price: sellingPrice,
                sold: sold,
                reorderLevel: reorderLevel,
                expiryDate: item.expiry_date || item.expiryDate || ""
              };
            });
          }
        } catch {
          productsMap[b.branch_name] = [];
        }
      } else {
        productsMap[b.branch_name] = [];
      }
    });
    return { branches, productsMap };
  } catch (e) {
    console.error("Failed to load branches and products for chatbot:", e);
    return { branches: [], productsMap: {} };
  }
};

export default function FloatingChatbot({ activeTier }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Hello! I am your Inventra Co-Pilot. I can analyze inventory health, suggest branch stock transfers, forecast seasonal demands, or check expiry dates. What can I help you with today?"
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Play Web Audio chime natively
  const playChime = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === "open") {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === "close") {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "message") {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "incoming") {
        osc.frequency.setValueAtTime(680, ctx.currentTime);
        osc.frequency.setValueAtTime(780, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {
      console.log("AudioContext blocked or failed", e);
    }
  };

  // Auto-scroll on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const toggleChat = () => {
    if (!isOpen) {
      playChime("open");
    } else {
      playChime("close");
    }
    setIsOpen(!isOpen);
  };

  // Get accent styles according to business tier
  const getTierAccent = () => {
    if (activeTier === "large") {
      return { 
        bg: "bg-emerald-600 hover:bg-emerald-700", 
        border: "border-emerald-200", 
        text: "text-emerald-700", 
        ring: "bg-emerald-500/20", 
        hex: "#10B981" 
      };
    }
    if (activeTier === "medium") {
      return { 
        bg: "bg-orange-500 hover:bg-orange-600", 
        border: "border-orange-200", 
        text: "text-orange-700", 
        ring: "bg-orange-500/20", 
        hex: "#F97316" 
      };
    }
    return { 
      bg: "bg-sky-500 hover:bg-sky-600", 
      border: "border-sky-200", 
      text: "text-sky-700", 
      ring: "bg-sky-500/20", 
      hex: "#0EA5E9" 
    };
  };

  const accent = getTierAccent();

  const handleQuery = (queryText) => {
    const query = queryText.toLowerCase();
    const { branches, productsMap } = getBranchesAndProducts();
    
    if (branches.length === 0) {
      return {
        text: "I checked the Inventra log database. No active branches are set up yet. Please add a branch using the setup wizard to enable real-time operational tracking.",
        payload: null
      };
    }
    
    // 1. Health / Status / Capacity
    if (query.includes("health") || query.includes("status") || query.includes("capacity")) {
      const payloadList = branches.map((b) => {
        const branchProducts = productsMap[b.branch_name] || [];
        const totalStock = branchProducts.reduce((sum, p) => sum + p.stock, 0);
        
        const type = b.branch_type;
        const limit = (type === "Warehouse" || type === "Depot") ? 1000 : 300;
        const cap = Math.min(100, Math.round((totalStock / limit) * 100)) || 0;
        
        const alerts = branchProducts.filter((p) => p.stock <= p.reorderLevel).length;
        
        let status = "Optimal";
        let color = "bg-emerald-500";
        let textClass = "text-emerald-700 bg-emerald-50";
        
        if (branchProducts.length === 0) {
          status = "Onboarding";
          color = "bg-sky-500";
          textClass = "text-sky-700 bg-sky-50";
        } else if (alerts > 0) {
          status = "Watchlist";
          color = "bg-amber-500";
          textClass = "text-amber-700 bg-amber-50";
        } else if (cap > 95) {
          status = "Overstocked";
          color = "bg-rose-500";
          textClass = "text-rose-700 bg-rose-50";
        }
        
        return {
          name: b.branch_name,
          cap,
          status,
          color,
          text: textClass
        };
      });
      
      const summaryText = `📊 **Consolidated Inventory Health Report**:\n` + 
        payloadList.map(item => `• **${item.name}**: ${item.cap}% Capacity (${item.status})`).join("\n");
        
      return {
        text: summaryText,
        payload: { type: "health", branches: payloadList }
      };
    }
    
    // 2. Logistics / Transfer / Rebalance
    if (query.includes("transfer") || query.includes("rebalance") || query.includes("logistic")) {
      let sourceBranch = "";
      let targetBranch = "";
      let productName = "";
      let qty = 0;
      
      for (const branch of branches) {
        const branchProducts = productsMap[branch.branch_name] || [];
        const lowStockItem = branchProducts.find(p => p.stock <= p.reorderLevel && p.reorderLevel > 0);
        if (lowStockItem) {
          const surplusNode = branches.find(other => {
            if (other.branch_name === branch.branch_name) return false;
            const otherProducts = productsMap[other.branch_name] || [];
            const matchingProd = otherProducts.find(p => p.name === lowStockItem.name);
            return matchingProd && matchingProd.stock > matchingProd.reorderLevel * 2;
          });
          
          if (surplusNode) {
            const surplusProd = productsMap[surplusNode.branch_name].find(p => p.name === lowStockItem.name);
            sourceBranch = surplusNode.branch_name;
            targetBranch = branch.branch_name;
            productName = lowStockItem.name;
            qty = Math.min(30, Math.floor((surplusProd.stock - surplusProd.reorderLevel) / 2)) || 10;
            break;
          }
        }
      }
      
      if (sourceBranch && targetBranch) {
        const text = `🔄 **AI Transfer Recommendation**:\n• **Action**: Move **${qty} units** of **${productName}** from **${sourceBranch}** (surplus) to **${targetBranch}** (under safety buffer).\n• **Result**: Rebalances ${targetBranch} safety buffer and reduces ${sourceBranch} holding load.`;
        return {
          text,
          payload: {
            type: "transfer",
            source: sourceBranch,
            target: targetBranch,
            product: productName,
            quantity: qty
          }
        };
      }
      
      return {
        text: "I analyzed the inventory matrices across all branches. Currently, stock buffers are balanced within target thresholds, and no inter-branch logistics routing is required.",
        payload: null
      };
    }
    
    // 3. Forecast / Profit / Predict
    if (query.includes("forecast") || query.includes("profit") || query.includes("predict")) {
      let totalSales = 0;
      const forecastBranches = branches.map(b => {
        const branchProducts = productsMap[b.branch_name] || [];
        const salesVal = branchProducts.reduce((sum, p) => sum + (p.price * p.sold), 0);
        totalSales += salesVal;
        
        const projected = salesVal * 1.35;
        const valStr = projected > 0 ? `₹${(projected / 100000).toFixed(1)}L` : "₹0";
        const growStr = salesVal > 0 ? "Active" : "—";
        
        return {
          name: b.branch_name,
          val: valStr,
          grow: growStr,
          color: salesVal > 0 ? "text-emerald-600" : "text-slate-400"
        };
      });
      
      const groupTrend = totalSales > 0 ? "Active" : "—";
      const text = `📅 **Quarterly Forecasts (Q2)**:\n` +
        forecastBranches.map(item => `• **${item.name}**: ${item.val} projected (${item.grow} Growth)`).join("\n");
        
      return {
        text,
        payload: {
          type: "forecast",
          branches: forecastBranches,
          groupTrend
        }
      };
    }
    
    // 4. Alert / Warning / Expiry / Expire
    if (query.includes("alert") || query.includes("warning") || query.includes("expiry") || query.includes("expire")) {
      const alertList = [];
      
      branches.forEach(b => {
        const branchProducts = productsMap[b.branch_name] || [];
        branchProducts.forEach(p => {
          if (p.stock <= p.reorderLevel && p.reorderLevel > 0) {
            alertList.push({
              type: "low_stock",
              title: `⚠️ Low Safety Buffer (${b.branch_name})`,
              text: `${p.name} fell under safety buffer. Current stock: ${p.stock}/${p.reorderLevel}.`
            });
          }
          if (p.expiryDate) {
            const exp = new Date(p.expiryDate);
            const now = new Date();
            const diffTime = exp - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 0 && diffDays <= 30) {
              alertList.push({
                type: "expiry",
                title: `🚨 Expiry Warning (${b.branch_name})`,
                text: `${p.name} is expiring on ${p.expiryDate} (${diffDays} days left). Current stock: ${p.stock} units.`
              });
            }
          }
        });
      });
      
      if (alertList.length === 0) {
        return {
          text: "I found no critical stock alerts or expiring inventory items across the business network. All stock buffers are operating within normal parameters.",
          payload: null
        };
      }
      
      const topAlerts = alertList.slice(0, 5);
      const text = `⚠️ **Critical Operational Alerts**:\n` +
        topAlerts.map((alt, idx) => `${idx + 1}. **${alt.title}**: ${alt.text}`).join("\n");
        
      return {
        text,
        payload: {
          type: "alerts",
          list: topAlerts
        }
      };
    }
    
    // 5. Hi / Hello / Help
    if (query.includes("hi") || query.includes("hello") || query.includes("help")) {
      return {
        text: "Hello! I can guide you through branch audits, reorders, logistics allocations, or forecasts. Just ask me:\n• *'What are the active alerts?'*\n• *'Give me rebalance suggestions'*\n• *'Show branch capacity health'*",
        payload: null
      };
    }
    
    return {
      text: "I have checked the Inventra consolidated logs. Currently, all active nodes are operating within normal parameters. Let me know if you need to inspect alerts, capacity health, rebalance suggestions, or profit forecasts.",
      payload: null
    };
  };

  const handleSendMessage = (textToSend) => {
    if (!textToSend.trim()) return;

    playChime("message");

    setMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      const { text, payload } = handleQuery(textToSend);
      setMessages((prev) => [...prev, { sender: "ai", text, payload }]);
      setIsTyping(false);
      playChime("incoming");
    }, 1100);
  };

  const renderMessageText = (msg) => {
    if (msg.sender === "user") {
      return <div className="font-semibold text-right">{msg.text}</div>;
    }

    if (msg.payload && msg.payload.type === "health") {
      return (
        <div className="space-y-3 font-semibold text-slate-700 w-full min-w-[220px]">
          <div className="flex items-center gap-1.5 font-black text-slate-800 text-xs border-b border-slate-100 pb-1.5">
            <span>📊</span>
            <span>Inventory Health HUD</span>
          </div>
          <div className="space-y-2.5 text-[10.5px]">
            {msg.payload.branches.map((branch) => (
              <div key={branch.name} className="space-y-1">
                <div className="flex justify-between items-center leading-none">
                  <span className="font-black text-slate-800">{branch.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase ${branch.text}`}>
                    {branch.cap}% • {branch.status}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${branch.color}`} style={{ width: `${branch.cap}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (msg.payload && msg.payload.type === "transfer") {
      return (
        <div className="space-y-3 font-semibold text-slate-700 w-full min-w-[220px]">
          <div className="flex items-center gap-1.5 font-black text-slate-850 text-xs border-b border-slate-100 pb-1.5">
            <span>🔄</span>
            <span>AI Route Recommendation</span>
          </div>
          
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[10px] font-black text-slate-750">
            <div className="text-center">
              <span className="block text-[8px] uppercase text-slate-400">Source</span>
              <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded mt-0.5 inline-block text-[9px]">{msg.payload.source}</span>
            </div>
            <div className="flex flex-col items-center flex-1 px-1 min-w-[60px]">
              <span className="text-[8.5px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 animate-pulse">{msg.payload.quantity} Units</span>
              <span className="text-slate-400 mt-0.5 font-mono text-[9px] whitespace-nowrap">──────▶</span>
            </div>
            <div className="text-center">
              <span className="block text-[8px] uppercase text-slate-400">Target</span>
              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 inline-block text-[9px]">{msg.payload.target}</span>
            </div>
          </div>

          <div className="space-y-2 text-[10.5px] leading-relaxed">
            <div>
              <span className="font-extrabold text-slate-450 uppercase text-[8px] block">Action Directive</span>
              Move <strong className="font-extrabold text-slate-900">{msg.payload.quantity} units of {msg.payload.product}</strong> from {msg.payload.source} (surplus) to {msg.payload.target} (low safety threshold).
            </div>
            <div className="pt-1.5 border-t border-slate-100">
              <span className="font-extrabold text-slate-450 uppercase text-[8px] block">Projected Outcome</span>
              Rebalances {msg.payload.target} safety margin to a healthy level and reduces {msg.payload.source} holding load.
            </div>
          </div>
        </div>
      );
    }

    if (msg.payload && msg.payload.type === "forecast") {
      return (
        <div className="space-y-3 font-semibold text-slate-700 w-full min-w-[220px]">
          <div className="flex items-center gap-1.5 font-black text-slate-855 text-xs border-b border-slate-100 pb-1.5">
            <span>📅</span>
            <span>Quarterly Forecasts (Q2)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {msg.payload.branches.map((item) => (
              <div key={item.name} className="p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold">
                <span className="text-[8px] text-slate-400 block leading-none">{item.name}</span>
                <span className="text-slate-900 font-black block mt-1 leading-none">{item.val}</span>
                <span className={`text-[8px] font-black block mt-1 leading-none ${item.color}`}>{item.grow}</span>
              </div>
            ))}
          </div>
          <div className="text-[9.5px] font-bold text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
            📈 Group Trend: <strong className="font-black text-slate-700">{msg.payload.groupTrend} Surge</strong>
          </div>
        </div>
      );
    }

    if (msg.payload && msg.payload.type === "alerts") {
      return (
        <div className="space-y-3 font-semibold text-slate-700 w-full min-w-[220px]">
          <div className="flex items-center gap-1.5 font-black text-slate-850 text-xs border-b border-slate-100 pb-1.5">
            <span>⚠️</span>
            <span>Critical Operational Alerts</span>
          </div>
          <div className="space-y-2 text-[10.5px]">
            {msg.payload.list.map((alt, idx) => (
              <div key={idx} className={`p-2.5 rounded-xl border font-medium ${
                alt.type === "expiry" ? "bg-rose-50 border-rose-100 text-rose-955" : "bg-amber-50 border-amber-100 text-amber-955"
              }`}>
                <span className={`font-black block mb-0.5 ${alt.type === "expiry" ? "text-rose-900" : "text-amber-900"}`}>{alt.title}</span>
                {alt.text}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default parser for standard text
    return (
      <div className="space-y-1">
        {(msg.text || "").split("\n").map((line, lineIdx) => {
          let content = line;
          const isBullet = line.startsWith("•");
          if (isBullet) content = line.substring(1).trim();

          const parts = content.split("**");
          const renderedParts = parts.map((part, partIdx) => 
            partIdx % 2 === 1 ? <strong key={partIdx} className="font-black text-slate-900">{part}</strong> : part
          );

          return (
            <div key={lineIdx} className={isBullet ? "pl-3 relative mt-1 first:mt-0" : "mt-1 first:mt-0"}>
              {isBullet && <span className="absolute left-0 top-0 text-slate-400 font-black">•</span>}
              {renderedParts}
            </div>
          );
        })}
      </div>
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  return (
    <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-50 select-none">
      {/* Floating Action Button (FAB) */}
      <button
        onClick={toggleChat}
        className={`relative h-14 w-14 rounded-full flex items-center justify-center text-white shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300 z-50 ${accent.bg}`}
      >
        {/* Glow pulsing ring overlay */}
        <span className="absolute -inset-1 rounded-full animate-ping opacity-30 bg-[#10B981]/25 z-0" />
        
        {isOpen ? (
          // Close Icon
          <svg className="w-6 h-6 z-10 transition-transform duration-300 rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Chatbot Bot / Sparkles Icon
          <svg className="w-6 h-6 z-10 transition-transform duration-300 hover:rotate-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        )}
      </button>

      {/* Floating Chat Overlay Card */}
      {isOpen && (
        <div className="absolute bottom-16 md:bottom-18 right-0 w-[380px] max-w-[calc(100vw-2rem)] h-[480px] sm:h-[520px] md:h-[570px] rounded-3xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="px-5 py-4 bg-slate-900 text-white flex justify-between items-center relative">
            <div className="flex items-center gap-2">
              {/* Bot Icon */}
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent.hex + '22' }}>
                <svg className="w-4 h-4" fill="none" stroke={accent.hex} strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096M9 21h7.5M12 3v13.5M3 12h18M6.75 6.75h10.5v10.5H6.75Z" />
                </svg>
              </div>
              <div className="text-left">
                <h4 className="text-sm font-black tracking-wide leading-none">Inventra Co-Pilot</h4>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">AI Assistant Online</span>
                </div>
              </div>
            </div>

            {/* Minimize button */}
            <button
              onClick={() => {
                playChime("close");
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/30">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3.5 rounded-2xl max-w-[88%] text-[11px] leading-relaxed border shadow-sm ${
                    msg.sender === "user"
                      ? "bg-gradient-to-br from-slate-800 to-slate-950 border-slate-900 text-white rounded-tr-none text-right shadow-md"
                      : "bg-white border-slate-100 text-slate-700 rounded-tl-none text-left"
                  }`}
                >
                  {renderMessageText(msg)}
                </div>
              </div>
            ))}

            {/* Simulated typing loading dots */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-150 p-3 rounded-2xl rounded-tl-none flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt quick capsules */}
          <div className="px-5 pt-3 pb-2 bg-white border-t border-slate-100 flex flex-wrap gap-1.5 justify-start">
            {[
              { label: "🔍 Capacity Health", query: "Analyze inventory health" },
              { label: "🔄 Rebalance Transfers", query: "Rebalance stock transfers" },
              { label: "📅 Profit Forecasts", query: "Show profit forecasts" },
              { label: "⚠️ View Alerts", query: "View live alerts" }
            ].map((capsule) => (
              <button
                key={capsule.label}
                onClick={() => handleSendMessage(capsule.query)}
                className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-full transition-all cursor-pointer whitespace-nowrap"
              >
                {capsule.label}
              </button>
            ))}
          </div>

          {/* Message input form */}
          <form
            onSubmit={handleSubmit}
            className="px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Inventra AI Co-Pilot..."
              className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-slate-400 font-semibold text-xs outline-none text-slate-800 placeholder-slate-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className={`h-9 w-9 rounded-2xl flex items-center justify-center text-white shadow-md transition-all duration-300 cursor-pointer shrink-0 ${
                inputValue.trim() && !isTyping ? accent.bg : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              }`}
            >
              <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

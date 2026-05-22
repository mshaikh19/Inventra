import React, { useMemo, useState } from "react";

export default function BillingSystem({ products, onRecordSale, tierAccent, tierAccentSoft }) {
  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = sessionStorage.getItem("inventra_pos_cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    sessionStorage.setItem("inventra_pos_cart", JSON.stringify(cart));
  }, [cart]);

  const [discount, setDiscount] = useState(0);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerState, setCustomerState] = useState("Local");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [amountPaid, setAmountPaid] = useState(0);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [scannerFeedback, setScannerFeedback] = useState(null);

  const scannerInputRef = React.useRef(null);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F8") {
        e.preventDefault();
        setIsScannerOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (isScannerOpen) {
      const timer = setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isScannerOpen]);

  React.useEffect(() => {
    if (!scannerFeedback) return;
    const timer = setTimeout(() => setScannerFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [scannerFeedback]);

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

  const handleScanBarcode = (barcodeStr) => {
    const trimmed = barcodeStr.trim();
    if (!trimmed) return;
    
    const product = products.find((p) => p.barcode === trimmed);
    
    if (product) {
      if (product.stock <= 0) {
        playScanSound(false);
        setScannerFeedback({
          status: "error",
          message: `"${product.name}" is out of stock!`,
        });
      } else {
        addToCart(product);
        playScanSound(true);
        setScannerFeedback({
          status: "success",
          message: `Added ${product.name} to basket!`,
        });
      }
    } else {
      playScanSound(false);
      setScannerFeedback({
        status: "error",
        message: `Barcode "${trimmed}" not registered in POS inventory!`,
      });
    }
    setScannerInput("");
  };

  const categoryOptions = useMemo(() => {
    const unique = new Set(products.map((p) => p.category));
    return ["all", ...Array.from(unique)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const inCategory = activeCategory === "all" || p.category === activeCategory;
      const inSearch =
        query.length === 0 || `${p.name} ${p.category}`.toLowerCase().includes(query);
      return inCategory && inSearch;
    });
  }, [products, searchQuery, activeCategory]);

  const addToCart = (product) => {
    if (product.stock <= 0) return;

    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return currentCart;
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...currentCart, { ...product, quantity: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.id !== id) return item;
          const source = products.find((p) => p.id === id);
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (source && nextQty > source.stock) return item;
          return { ...item, quantity: nextQty };
        })
        .filter(Boolean),
    );
  };

  const removeFromCart = (id) => {
    setCart((currentCart) => currentCart.filter((item) => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalUnits = cart.reduce((acc, item) => acc + item.quantity, 0);
  const discountAmount = Number(discount) > 0 ? (subtotal * Number(discount)) / 100 : 0;
  const taxableAmount = subtotal - discountAmount;

  const isInterstate = customerState === "Interstate";
  const cgstAmount = isInterstate ? 0 : taxableAmount * 0.09;
  const sgstAmount = isInterstate ? 0 : taxableAmount * 0.09;
  const igstAmount = isInterstate ? taxableAmount * 0.18 : 0;
  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const grandTotal = taxableAmount + totalTax;

  const safeAmountPaid = Number(amountPaid) || 0;
  const changeDue = Math.max(0, safeAmountPaid - grandTotal);
  const isPaymentShort = cart.length > 0 && safeAmountPaid < grandTotal;

  const availableSkus = products.filter((p) => p.stock > 0).length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length;

  const applyTenderQuickAmount = (value) => {
    setAmountPaid(Math.max(0, Number(value) || 0));
  };

  const quickAddProducts = filteredProducts.slice(0, 6);

  const handleCheckout = () => {
    if (cart.length === 0 || isPaymentShort) return;

    const invoiceNumber = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalReceipt = {
      invoiceNumber,
      date: new Date().toLocaleString(),
      customerName,
      customerState,
      paymentMode,
      amountPaid: safeAmountPaid,
      changeDue,
      items: [...cart],
      subtotal,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      grandTotal,
    };

    setReceiptData(finalReceipt);
    onRecordSale(cart, grandTotal);
    setShowReceiptModal(true);

    setCart([]);
    setDiscount(0);
    setAmountPaid(0);
    setCustomerName("Walk-in Customer");
    setCustomerState("Local");
    setPaymentMode("UPI");
  };

  return (
    <div className="flex flex-col md:flex-row text-left items-stretch w-full md:h-full md:overflow-hidden bg-slate-50">

      {/* ── LEFT: Product Counter ─────────────────────────────────────────── */}
      <section className="flex-1 min-w-0 bg-slate-50 p-4 md:p-5 flex flex-col md:h-full md:overflow-hidden space-y-4">

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Quick Add</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">Frequently used items</div>
            </div>
            <div className="text-[10px] font-bold text-slate-400">Tap to add instantly</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickAddProducts.map((product) => {
              const isOutOfStock = product.stock <= 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={isOutOfStock}
                  className="rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: isOutOfStock ? "#e2e8f0" : `${tierAccent}33`,
                    background: isOutOfStock ? "#fff" : `${tierAccent}10`,
                    color: isOutOfStock ? "#94a3b8" : tierAccent,
                  }}
                >
                  {product.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 flex-shrink-0" style={{ boxShadow: `inset 0 0 0 1px ${tierAccentSoft}` }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search item or category"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5 cursor-pointer transition-all hover:brightness-110 active:scale-[0.98] select-none"
              style={{ background: tierAccent }}
              title="Open Barcode Scanner (F8)"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.875ZM9 4.875c0-.621.504-1.125 1.125-1.125h.75c.621 0 1.125.504 1.125 1.125v14.25c0 .621-.504 1.125-1.125 1.125h-.75A1.125 1.125 0 0 1 9 19.125V4.875ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h1.5c.621 0 1.125.504 1.125 1.125v14.25c0 .621-.504 1.125-1.125 1.125h-1.5a1.125 1.125 0 0 1-1.125-1.125V4.875ZM19.5 4.875c0-.621.504-1.125 1.125-1.125h.75c.621 0 1.125.504 1.125 1.125v14.25c0 .621-.504 1.125-1.125 1.125h-.75a1.125 1.125 0 0 1-1.125-1.125V4.875Z" />
              </svg>
              <span className="hidden sm:inline">Scan (F8)</span>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {categoryOptions.map((category) => {
              const active = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all cursor-pointer ${
                    active
                      ? "text-white border-transparent"
                      : "border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300"
                  }`}
                  style={active ? { background: tierAccent } : undefined}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Products Grid for Desktop, normal flow on mobile */}
        <div className="flex-1 md:overflow-y-auto md:pr-1 [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [scrollbar-width:none] [-ms-overflow-style:none]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((p) => {
              const isOutOfStock = p.stock <= 0;
              const inCart = cart.find((item) => item.id === p.id)?.quantity || 0;
              return (
                <div
                  key={p.id}
                  onClick={() => !isOutOfStock && addToCart(p)}
                  className={`rounded-2xl border p-3.5 transition-all select-none ${
                    isOutOfStock
                      ? "border-slate-100 bg-slate-50/60 opacity-55 cursor-not-allowed"
                      : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
                  }`}
                  style={
                    inCart > 0 && !isOutOfStock
                      ? { borderColor: tierAccent, boxShadow: `inset 0 0 0 1px ${tierAccent}` }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[9px] font-black uppercase bg-slate-200/60 border border-slate-300/40 text-slate-600 px-2 py-0.5 rounded-md">
                      {p.category}
                    </span>
                    <span className={`text-[10px] font-black ${p.stock <= 5 ? "text-rose-500" : "text-slate-500"}`}>
                      Stock {p.stock}
                    </span>
                  </div>

                  <h3 className="mt-2 text-[13px] font-bold text-slate-900 leading-tight min-h-10">{p.name}</h3>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">Price</div>
                      <div className="text-sm font-black text-slate-900">₹{p.price}</div>
                    </div>
                    {inCart > 0 && (
                      <span
                        className="rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-white shrink-0"
                        style={{ background: tierAccent }}
                      >
                        {inCart} in basket
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs font-bold text-slate-500">
                No products match this search. Try clearing the filter or use Quick Add.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── RIGHT: Invoice Basket Sidebar ────────────────────────────────── */}
      <aside className="w-full md:w-[360px] lg:w-[380px] xl:w-[410px] flex-shrink-0 md:h-full bg-white border-l border-slate-200 flex flex-col md:overflow-y-auto [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [scrollbar-width:none] [-ms-overflow-style:none]">
        {/* ── SIDEBAR HEADER (pinned, never scrolls) ──────────────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Live Ticket</span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5">Invoice Basket</h2>
            </div>
            <button
              type="button"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Clear
            </button>
          </div>



          {/* Customer fields */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100 h-7"
              />
            </div>
            <div className="flex flex-col gap-0.5 relative">
              <label className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Billing Type</label>
              <select
                value={customerState}
                onChange={(e) => setCustomerState(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-2 py-1 pr-6 text-[10px] font-black text-slate-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100 cursor-pointer h-7"
              >
                <option value="Local">Intrastate (CGST+SGST)</option>
                <option value="Interstate">Interstate (IGST)</option>
              </select>
              <svg className="pointer-events-none absolute right-2 bottom-2 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── CART LIST (scrollable middle zone) ──────────────────────── */}
        <div className="w-full px-4 py-3 space-y-1.5">

          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-6 text-center">
              <p className="text-xs font-bold text-slate-500">Your ticket is empty</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-1">Tap items from the product panel or use Quick Add to begin.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">₹{item.price} x {item.quantity}</p>
                  </div>
                  <div className="text-xs font-black text-slate-900 shrink-0">₹{(item.price * item.quantity).toLocaleString()}</div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                    <button type="button" onClick={() => updateCartQty(item.id, -1)} className="h-5 w-5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 text-xs font-black cursor-pointer flex items-center justify-center">-</button>
                    <span className="w-5 text-center text-[11px] font-black text-slate-900">{item.quantity}</span>
                    <button type="button" onClick={() => updateCartQty(item.id, 1)} className="h-5 w-5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 text-xs font-black cursor-pointer flex items-center justify-center">+</button>
                  </div>
                  <button type="button" onClick={() => removeFromCart(item.id)} className="text-[9px] font-black uppercase tracking-[0.12em] text-rose-500 hover:text-rose-700 cursor-pointer">Remove</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── FOOTER (pinned, never scrolls) ──────────────────────────── */}
        <div className="px-4 pb-4 pt-2.5 border-t border-slate-100 space-y-2.5 flex-shrink-0">

          <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1.5 text-[10px]">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-500">Units</span>
              <span className="font-black text-slate-900">{totalUnits}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-500">Subtotal</span>
              <span className="font-black text-slate-900">₹{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-500">Discount (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="w-10 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-right text-[10px] font-black text-slate-900 outline-none h-5"
              />
            </div>

            <div className="border-t border-slate-100 pt-1.5 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Taxable</span>
                <span className="font-black text-slate-900">₹{taxableAmount.toLocaleString()}</span>
              </div>
              {isInterstate ? (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500">IGST (18%)</span>
                  <span className="font-black text-slate-700">₹{igstAmount.toLocaleString()}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">CGST (9%)</span>
                    <span className="font-black text-slate-700">₹{cgstAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">SGST (9%)</span>
                    <span className="font-black text-slate-700">₹{sgstAmount.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center">
              <span className="text-[11px] font-black text-slate-900">Grand Total</span>
              <span className="text-sm font-black" style={{ color: tierAccent }}>
                ₹{grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
            {/* Row 1: Payment Mode and UPI/Card/Cash buttons */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 shrink-0">Payment Mode</span>
              <div className="flex gap-1">
                {["UPI", "Card", "Cash"].map((mode) => {
                  const active = paymentMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.05em] transition-all cursor-pointer ${
                        active
                          ? "text-white border-transparent"
                          : "border-slate-200 bg-white text-slate-500 hover:text-slate-900"
                      }`}
                      style={active ? { background: tierAccent } : undefined}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>



            {/* Row 3: Amount Paid Input & Change Due Side-by-Side */}
            <div className="grid grid-cols-2 gap-2 items-center">
              <div className="flex items-center gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 shrink-0">Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-black text-slate-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100 h-5.5"
                />
              </div>
              <div className="flex items-center justify-end gap-1">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Due:</span>
                <span className="text-[10px] font-black text-slate-900">₹{changeDue.toLocaleString()}</span>
              </div>
            </div>

            {isPaymentShort && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2.5 flex items-start gap-2 shadow-[0_1px_3px_rgba(244,63,94,0.05)]">
                <span className="text-[11px] shrink-0 mt-0.5">⚠️</span>
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider">Insufficient Funds</span>
                  <p className="text-[9.5px] font-semibold text-rose-600/90 leading-normal">
                    Outstanding balance of <span className="font-black text-rose-800">₹{(grandTotal - safeAmountPaid).toLocaleString()}</span> is required to proceed.
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={cart.length === 0 || isPaymentShort}
            className={`w-full rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all hover:scale-[1.01] h-9 inline-flex items-center justify-center ${
              cart.length === 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : isPaymentShort
                  ? "bg-amber-50 text-amber-700 border border-amber-200/60 cursor-not-allowed"
                  : "text-white shadow-[0_4px_12px_rgba(15,23,42,0.12)] cursor-pointer"
            }`}
            style={
              cart.length === 0 || isPaymentShort
                ? undefined
                : { background: `linear-gradient(90deg, ${tierAccent} 0%, #0f172a 100%)` }
            }
          >
            {cart.length === 0
              ? "Add items to continue"
              : isPaymentShort
                ? "Please complete payment"
                : "Pay & Generate Invoice"}
          </button>
        </div>
      </aside>

      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_60px_rgba(0,0,0,0.22)] text-slate-800">
            <div className="text-center border-b border-dashed border-slate-300 pb-4">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">INVENTRA POS RECEIPT</h3>
              <p className="text-[11px] text-slate-500 font-bold mt-1">Adaptive AI Retail Platform</p>
            </div>

            <div className="py-3 border-b border-dashed border-slate-300 text-[11px] font-bold text-slate-600 space-y-1">
              <div>Invoice: {receiptData.invoiceNumber}</div>
              <div>Date: {receiptData.date}</div>
              <div>Customer: {receiptData.customerName}</div>
              <div>Tax: {receiptData.customerState === "Local" ? "Intrastate" : "Interstate"}</div>
              <div>Payment: {receiptData.paymentMode}</div>
            </div>

            <div className="py-3 border-b border-dashed border-slate-300 max-h-56 overflow-y-auto space-y-2 text-xs font-bold">
              {receiptData.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-400">{item.quantity} x ₹{item.price}</div>
                  </div>
                  <div className="shrink-0">₹{(item.quantity * item.price).toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="py-3 space-y-1.5 text-xs font-bold">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{receiptData.subtotal.toLocaleString()}</span></div>
              {receiptData.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-₹{receiptData.discountAmount.toLocaleString()}</span></div>
              )}
              <div className="flex justify-between"><span>Tax</span><span>₹{receiptData.totalTax.toLocaleString()}</span></div>
              <div className="flex justify-between border-t border-dashed border-slate-300 pt-2 text-sm font-black">
                <span>TOTAL PAID</span>
                <span>₹{receiptData.grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500"><span>Received</span><span>₹{receiptData.amountPaid.toLocaleString()}</span></div>
              <div className="flex justify-between text-slate-500"><span>Change</span><span>₹{receiptData.changeDue.toLocaleString()}</span></div>
            </div>

            <button
              type="button"
              onClick={() => setShowReceiptModal(false)}
              className="mt-2 w-full rounded-xl bg-slate-900 py-3 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-slate-800 transition-colors"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.45)] text-slate-200 flex flex-col gap-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <div>
                  <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-white">POS BARCODE SCANNER</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Simulate scans or use hardware wedge</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsScannerOpen(false);
                  setScannerFeedback(null);
                }}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
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
                  const isOutOfStock = p.stock <= 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => handleScanBarcode(p.barcode)}
                      className="flex items-center justify-between text-left p-2 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/85 hover:border-slate-700 transition-all text-xs font-semibold text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-[11px] truncate">{p.name}</div>
                        <div className="text-[9px] text-slate-500 font-mono tracking-wider mt-0.5">{p.barcode}</div>
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
                    {scannerFeedback.status === "success" ? "Scan Success" : "Scan Error"}
                  </div>
                  <p className="text-[10.5px] font-bold mt-1 text-white truncate">
                    {scannerFeedback.message}
                  </p>
                </div>
              </div>
            )}

            {/* Close footer info */}
            <div className="text-center text-[9px] font-bold text-slate-500 tracking-wider">
              Press <span className="text-slate-400 font-black">F8</span> anytime to dismiss
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";

export default function BillingSystem({ products, onRecordSale, tierAccent, tierAccentSoft }) {
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerState, setCustomerState] = useState("Local"); // Local (CGST+SGST) vs Interstate (IGST)
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return currentCart; // Stock limit reached
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...currentCart, { ...product, quantity: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            const originalProd = products.find((p) => p.id === id);
            if (nextQty <= 0) return null;
            if (originalProd && nextQty > originalProd.stock) return item; // Stock limit
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discountAmount = Number(discount) > 0 ? (subtotal * Number(discount)) / 100 : 0;
  const taxableAmount = subtotal - discountAmount;

  // GST Calculation: CGST (9%) + SGST (9%) or IGST (18%)
  const isInterstate = customerState === "Interstate";
  const cgstAmount = isInterstate ? 0 : taxableAmount * 0.09;
  const sgstAmount = isInterstate ? 0 : taxableAmount * 0.09;
  const igstAmount = isInterstate ? taxableAmount * 0.18 : 0;
  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const grandTotal = taxableAmount + totalTax;

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const invoiceNumber = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalReceipt = {
      invoiceNumber,
      date: new Date().toLocaleString(),
      customerName,
      customerState,
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
    
    // Callback to update parent sales state and inventory quantities
    onRecordSale(cart, grandTotal);
    
    setShowReceiptModal(true);
    setCart([]);
    setCustomerName("Walk-in Customer");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 text-left">
      {/* Product Catalog */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col h-[650px] overflow-hidden">
        <div className="mb-5 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-450">Retail Engine</span>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-1">Product Catalog Selection</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-1 flex-1">
          {products.map((p) => {
            const isOutOfStock = p.stock <= 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={isOutOfStock}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all duration-300 cursor-pointer ${
                  isOutOfStock
                    ? "border-slate-100 bg-slate-50/50 opacity-40 cursor-not-allowed"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100/60 hover:border-slate-350 hover:-translate-y-0.5"
                }`}
              >
                <div>
                  <span className="text-[9px] font-black uppercase bg-slate-200/50 border border-slate-300/40 text-slate-650 px-2 py-0.5 rounded-md">
                    {p.category}
                  </span>
                  <h3 className="text-[13.5px] font-bold text-slate-900 mt-2 leading-tight">{p.name}</h3>
                </div>
                <div className="mt-4 flex justify-between items-end">
                  <div>
                    <div className="text-[10px] text-slate-450 font-bold">Price</div>
                    <div className="text-sm font-black text-slate-900">₹{p.price}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-450 font-bold">In-Stock</div>
                    <div className={`text-xs font-black ${p.stock <= 5 ? "text-rose-500 font-extrabold" : "text-slate-600"}`}>
                      {p.stock}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Invoice Basket */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_rgba(0,0,0,0.02)] flex flex-col h-[650px] overflow-hidden">
        <div className="mb-4">
          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-450">Checkout Cart</span>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-1">Invoice Basket</h2>
        </div>

        {/* Invoice Customer Details */}
        <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase text-slate-450">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-semibold outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase text-slate-450">Tax Jurisdiction</label>
            <select
              value={customerState}
              onChange={(e) => setCustomerState(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-black outline-none cursor-pointer"
            >
              <option value="Local">Intrastate (CGST+SGST)</option>
              <option value="Interstate">Interstate (IGST)</option>
            </select>
          </div>
        </div>

        {/* Selected Items */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-slate-400 text-sm font-semibold">
              <svg className="h-10 w-10 text-slate-300 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              Basket is empty. Select products.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <div>
                  <h4 className="text-[13px] font-bold text-slate-800 leading-tight">{item.name}</h4>
                  <div className="text-[11px] text-slate-400 mt-0.5">₹{item.price} each</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
                    <button
                      onClick={() => updateCartQty(item.id, -1)}
                      className="w-6 h-6 flex justify-center items-center hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-xs font-black text-slate-850 w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.id, 1)}
                      className="w-6 h-6 flex justify-center items-center hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pricing totals */}
        <div className="border-t border-slate-200 pt-4 space-y-2 text-xs font-bold text-slate-500">
          <div className="flex justify-between items-center">
            <span>Subtotal</span>
            <span className="text-slate-800 font-bold">₹{subtotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <span>Discount (%)</span>
            <input
              type="number"
              value={discount}
              min="0"
              max="100"
              onChange={(e) => setDiscount(Math.min(100, Math.max(0, e.target.value)))}
              className="w-16 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-900 text-center outline-none text-xs font-black"
            />
          </div>

          <div className="flex justify-between items-center border-t border-slate-100 pt-2">
            <span>Taxable Amount</span>
            <span className="text-slate-800 font-bold">₹{taxableAmount.toLocaleString()}</span>
          </div>

          {isInterstate ? (
            <div className="flex justify-between items-center text-slate-650">
              <span>IGST (18%)</span>
              <span>₹{igstAmount.toLocaleString()}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center text-slate-650">
                <span>CGST (9%)</span>
                <span>₹{cgstAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-650">
                <span>SGST (9%)</span>
                <span>₹{sgstAmount.toLocaleString()}</span>
              </div>
            </>
          )}

          <div className="flex justify-between items-center border-t border-slate-200 pt-3 text-sm font-black text-slate-900">
            <span>Grand Total</span>
            <span className="text-[17px] font-black" style={{ color: tierAccent }}>
              ₹{grandTotal.toLocaleString()}
            </span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={cart.length === 0}
          className="w-full py-4 rounded-2xl font-bold uppercase text-xs tracking-wider text-white shadow-md hover:scale-[1.01] transition-all cursor-pointer mt-4 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: tierAccent }}
        >
          Pay & Generate Invoice
        </button>
      </div>

      {/* Invoice receipt overlay modal */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative text-slate-800 font-mono">
            {/* Receipt headers */}
            <div className="text-center pb-4 border-b border-dashed border-slate-300">
              <h3 className="text-lg font-black text-slate-900 font-sans tracking-tight">INVENTRA RETAIL</h3>
              <p className="text-[11px] text-slate-500 font-bold mt-1">Adaptive AI Retail Platform</p>
              <p className="text-[10px] text-slate-400 mt-0.5">GSTIN: 27AABCI4821N1ZM</p>
            </div>

            {/* Receipt metadata */}
            <div className="py-3 border-b border-dashed border-slate-300 text-[11px] space-y-1 text-slate-600 font-bold">
              <div>Invoice: {receiptData.invoiceNumber}</div>
              <div>Date: {receiptData.date}</div>
              <div>Cust: {receiptData.customerName}</div>
              <div>Type: {receiptData.customerState === "Local" ? "Intrastate GST (Local)" : "Interstate GST"}</div>
            </div>

            {/* Items list */}
            <div className="py-3 border-b border-dashed border-slate-300 text-xs space-y-2 font-bold max-h-48 overflow-y-auto">
              {receiptData.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="w-[60%] text-left">
                    <div>{item.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {item.quantity} x ₹{item.price}
                    </div>
                  </div>
                  <div className="w-[40%] text-right font-black">
                    ₹{(item.price * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Receipt pricing */}
            <div className="py-3 text-xs space-y-1.5 font-bold">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{receiptData.subtotal.toLocaleString()}</span>
              </div>
              {receiptData.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-₹{receiptData.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-1 text-[11px]">
                <span>Taxable Amount</span>
                <span>₹{receiptData.taxableAmount.toLocaleString()}</span>
              </div>

              {receiptData.customerState === "Local" ? (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>CGST (9%)</span>
                    <span>₹{receiptData.cgstAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SGST (9%)</span>
                    <span>₹{receiptData.sgstAmount.toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-500">
                  <span>IGST (18%)</span>
                  <span>₹{receiptData.igstAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-dashed border-slate-300 pt-2.5 text-base font-black text-slate-900 font-sans">
                <span>TOTAL PAID</span>
                <span>₹{receiptData.grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Custom receipt barcode symbol and footer */}
            <div className="mt-4 flex flex-col items-center gap-2.5">
              <div className="h-8 w-44 bg-slate-100 border-x border-slate-300 flex items-center justify-around opacity-60">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="h-full bg-slate-800" style={{ width: `${(i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 2)}px` }} />
                ))}
              </div>
              <div className="text-[10px] text-center text-slate-400 font-bold">Powered by Inventra Smart Billing</div>
            </div>

            <button
              onClick={() => setShowReceiptModal(false)}
              className="mt-6 w-full py-2.5 rounded-xl font-bold font-sans text-xs uppercase text-white bg-slate-900 hover:bg-slate-850 transition-colors shadow-md cursor-pointer"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

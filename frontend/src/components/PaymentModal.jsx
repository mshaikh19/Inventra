import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

/**
 * PaymentModal
 *
 * Step 1 – Collect customer phone number (no email shown)
 * Step 2 – Loading spinner while backend creates the Razorpay order
 * Step 3 – Razorpay checkout opens (phone pre-filled → skips contact screen)
 * Step 4 – Error screen with retry / cancel
 */
const PaymentModal = ({
  isOpen,
  onCancel,
  onPaymentSuccess,
  onPaymentFailure,
  amount,           // in RUPEES (backend × 100 → paise)
  invoiceNumber,
  items,
  customerName,
  customerState,
  branchName,
  paymentMode,
  tierAccent = "#0284C7",
}) => {
  const normalizePaymentError = (message) => {
    const text = String(message || "").trim();
    if (!text) {
      return "Payment could not be completed right now. Please try again.";
    }
    if (/could not fetch payment details|payment could not be confirmed from the gateway|payment verification failed|verification failed/i.test(text)) {
      return "Payment could not be completed. Please try again.";
    }
    if (/session expired|invalid or expired token/i.test(text)) {
      return "Your session expired. Please log in again and retry the payment.";
    }
    if (/failed to initiate payment/i.test(text)) {
      return "Payment could not be started right now. Please try again.";
    }
    return text;
  };

  const [step, setStep] = useState("collect"); // 'collect' | 'processing' | 'error'
  const [customerPhone, setCustomerPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const phoneRef = useRef(null);

  const API_BASE_URL = "http://127.0.0.1:8000/api/v1/payments";

  const getAuthToken = () =>
    localStorage.getItem("inventra_token") ||
    sessionStorage.getItem("inventra_token");

  const loadCashfreeScript = () =>
    new Promise((resolve, reject) => {
      if (window.Cashfree) return resolve();
      const s = document.createElement("script");
      s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      s.async = true;
      s.onload = resolve;
      s.onerror = () =>
        reject(new Error("Failed to load Cashfree. Check your internet connection."));
      document.body.appendChild(s);
    });

  // Reset whenever modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("collect");
      setCustomerPhone("");
      setPhoneError("");
      setPaymentError("");
      setPaymentStatus("");
      setTimeout(() => phoneRef.current?.focus(), 80);
    }
  }, [isOpen]);

  const handlePhoneSubmit = () => {
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setPhoneError("Enter a valid 10-digit mobile number.");
      return;
    }
    setPhoneError("");
    setStep("processing");
    initiatePayment(digits);
  };

  const initiatePayment = async (phone) => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error("Session expired. Please log in again.");

      // ── Step 1: Create order on backend ─────────────────────────────────
      // Send amount in RUPEES — payment_service.create_order() converts to paise
      setPaymentStatus("Creating payment order…");
      const orderRes = await axios.post(
        `${API_BASE_URL}/initiate`,
        {
          amount,                          // ← rupees; backend × 100 = paise
          currency: "INR",
          customer_name: customerName || "Guest",
          customer_email: "noreply@inventra.pos",
          customer_phone: phone,
          description: `Invoice ${invoiceNumber}`,
          payment_mode: paymentMode,       // ← Pass to root of payload for backend Pydantic schema
          notes: {
            invoice_number: invoiceNumber,
            branch_name: branchName || "Main Store",
            customer_state: customerState || "Local",
            payment_mode: paymentMode,
          },
        },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );

      const { order_id, razorpay_order_id, key_id } = orderRes.data;
      if (!razorpay_order_id || !key_id)
        throw new Error("Order creation failed: missing credentials from server.");

      // ── Step 2: Load SDK ─────────────────────────────────────────────────
      setPaymentStatus("Opening secure payment gateway…");
      await loadCashfreeScript();

      // ── Step 3: Open Cashfree checkout ───────────────────────────────────
      const cashfree = window.Cashfree({
        mode: "sandbox" // TEST environment credentials starting with TEST
      });

      const checkoutOptions = {
        paymentSessionId: razorpay_order_id, // we mapped payment_session_id to razorpay_order_id
        redirectTarget: "_modal",
        ...(paymentMode === "Card" && { paymentMethods: ["card"] }),
        ...(paymentMode === "UPI" && { paymentMethods: ["upi"] })
      };

      cashfree.checkout(checkoutOptions).then(async (result) => {
        try {
          setStep("processing");
          setPaymentStatus("Verifying payment…");

          const verifyRes = await axios.post(
            `${API_BASE_URL}/verify`,
            {
              razorpay_order_id: razorpay_order_id,
              razorpay_payment_id: "cashfree_mock",
              razorpay_signature: "cashfree_mock",
              order_id,                 // internal MongoDB ID
            },
            { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
          );

          if (verifyRes.data.success) {
            setPaymentStatus("");
            onPaymentSuccess?.({
              payment_id: "cf_" + order_id,
              order_id: razorpay_order_id,
              amount,
              currency: "INR",
              status: "success",
            });
          } else {
            throw new Error(verifyRes.data.message || "Payment verification failed.");
          }
        } catch (err) {
          const msg = normalizePaymentError(err.response?.data?.detail || err.message || "Verification failed.");
          setPaymentError(msg);
          setStep("error");
          onPaymentFailure?.(msg);
        }
      });

      setStep("razorpay"); // hide loading overlay
    } catch (err) {
      const msg = normalizePaymentError(err.response?.data?.detail || err.message || "Payment initiation failed.");
      setPaymentError(msg);
      setStep("error");
      onPaymentFailure?.(msg);
    }
  };

  if (!isOpen) return null;

  // ── Step: Collect phone number ────────────────────────────────────────────
  if (step === "collect") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                {paymentMode} Payment
              </h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Powered by Cashfree
              </p>
            </div>
            <button
              onClick={onCancel}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Amount */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount Due</p>
            <p className="text-3xl font-black text-slate-900 mt-1">
              ₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Invoice: {invoiceNumber}</p>
          </div>

          {/* Phone input */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 block mb-1.5">
                Customer Mobile Number
              </label>
              <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 focus-within:border-sky-400 transition-colors">
                <span className="text-sm">🇮🇳</span>
                <span className="text-xs font-black text-slate-500 shrink-0">+91</span>
                <div className="w-px h-4 bg-slate-200 shrink-0" />
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                    setPhoneError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                  placeholder="10-digit mobile number"
                  className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-800 placeholder:text-slate-300 placeholder:font-normal"
                />
              </div>
              {phoneError && (
                <p className="text-[10px] font-bold text-red-500 mt-1.5">{phoneError}</p>
              )}
              <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                Used to send payment confirmation SMS
              </p>
            </div>

            <button
              onClick={handlePhoneSubmit}
              style={{ background: tierAccent }}
              className="w-full py-3 rounded-xl text-white text-[11px] font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Proceed to Pay ₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </button>

            <div className="relative my-2 flex py-0.5 items-center">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-2 text-[8px] font-black text-slate-300 uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <button
              onClick={() => {
                setStep("processing");
                setPaymentStatus("Simulating payment success…");
                setTimeout(() => {
                  onPaymentSuccess?.({
                    payment_id: `pay_sim_${Math.random().toString(36).substring(2, 11)}`,
                    order_id: `order_sim_${Math.random().toString(36).substring(2, 11)}`,
                    amount,
                    currency: "INR",
                    status: "success",
                  });
                }, 1000);
              }}
              className="w-full py-2.5 rounded-xl border border-dashed border-sky-300 bg-sky-50/50 hover:bg-sky-50 text-sky-700 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-sky-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              ⚡ Simulate Success (Bypass)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Loading / processing ────────────────────────────────────────────
  if (step === "processing") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-5 max-w-xs w-full mx-4">
          <div
            className="w-12 h-12 rounded-full border-4 border-slate-100 animate-spin"
            style={{ borderTopColor: tierAccent }}
          />
          <div className="text-center">
            <p className="text-sm font-black text-slate-800">
              {paymentStatus || "Connecting to Cashfree…"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-semibold">
              Please do not close this window
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Razorpay active (invisible — Razorpay has its own modal) ────────
  if (step === "razorpay") return null;

  // ── Step: Error ───────────────────────────────────────────────────────────
  if (step === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-[calc(100%-2rem)] mx-4 p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 text-center sm:px-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-[13px] sm:text-sm font-black text-slate-900 uppercase tracking-[0.12em] leading-tight break-words">
                Payment Could Not Be Completed
              </h3>
              <p className="text-[13px] sm:text-sm text-red-600 font-semibold leading-6 max-w-sm mx-auto break-words">
                {paymentError}
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setPaymentError("");
                setStep("collect");
              }}
              style={{ background: tierAccent }}
              className="flex-1 px-4 py-2.5 rounded-xl text-white font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

PaymentModal.propTypes = {};
export default PaymentModal;

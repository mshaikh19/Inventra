import React, { useMemo, useState } from "react";
import PureBarcodeScanner from "./pureBarcodeScanner";
import PaymentModal from "./paymentModal";
import CustomDropdown from "./CustomDropdown";
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from "@zxing/library";
import { getCategoryGstRate } from "../utils/inventory";

const normalizeBarcode = (value) => String(value ?? "").replace(/\s+/g, "").trim();
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const clampPercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));
const getItemGstRate = (item) => Number(item.gstRate ?? item.gst_rate ?? item.gstPercentage ?? item.gst_percentage ?? getCategoryGstRate(item.category)) || 0;
const getItemMrp = (item) => Number(item.mrp ?? item.maximum_retail_price ?? item.price ?? 0) || 0;
const getItemSellingPrice = (item) => Number(item.sellingPrice ?? item.selling_price ?? item.price ?? 0) || 0;
const getItemBasePrice = (item) => item.sellOnMrp ? getItemMrp(item) : getItemSellingPrice(item);
const calculateCartLine = (item, isInterstate) => {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = getItemBasePrice(item);
  const gross = toMoney(unitPrice * quantity);
  const percentDiscount = toMoney((gross * clampPercent(item.discountPercent)) / 100);
  const flatDiscount = toMoney(Math.min(gross - percentDiscount, Math.max(0, Number(item.discountAmount) || 0)));
  const discountAmount = toMoney(Math.min(gross, percentDiscount + flatDiscount));
  const taxableAmount = toMoney(Math.max(0, gross - discountAmount));
  const gstRate = getItemGstRate(item);
  const taxAmount = toMoney((taxableAmount * gstRate) / 100);
  const cgstAmount = isInterstate ? 0 : toMoney(taxAmount / 2);
  const sgstAmount = isInterstate ? 0 : toMoney(taxAmount - cgstAmount);
  const igstAmount = isInterstate ? taxAmount : 0;

  return {
    unitPrice,
    gross,
    discountAmount,
    taxableAmount,
    gstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    lineTotal: toMoney(taxableAmount + taxAmount),
  };
};

export default function BillingSystem({ products, onRecordSale, tierAccent, tierAccentSoft, isLoading, setActiveTab, tier, selectedBranchLabel, userDisplayName, businessName = "Inventra Retail" }) {
  const [activeBranch, setActiveBranch] = useState(selectedBranchLabel);
  
  const activeBranchDetails = useMemo(() => {
    if (typeof window === "undefined") return { address: "", phone: "", gstin: "" };
    try {
      const stored = localStorage.getItem("inventra_branches_list");
      if (stored) {
        const branches = JSON.parse(stored);
        if (Array.isArray(branches)) {
          const matched = branches.find(b => b.branch_name === selectedBranchLabel);
          if (matched) {
            return {
              address: matched.address ? `${matched.address}, ${matched.city || ""}, ${matched.state || ""} - ${matched.pincode || ""}`.replace(/,\s*,/g, ",").trim() : "",
              phone: matched.phone || "N/A",
              gstin: matched.gstin || "N/A"
            };
          }
        }
      }
    } catch (e) {
      console.warn("Failed to parse inventra_branches_list:", e);
    }
    return {
      address: "Address not available",
      phone: "",
      gstin: ""
    };
  }, [selectedBranchLabel]);

  const [cart, setCart] = useState(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return [];
    try {
      const stored = sessionStorage.getItem(`inventra_pos_cart_${selectedBranchLabel}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [discount, setDiscount] = useState(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return 0;
    try {
      const stored = sessionStorage.getItem(`inventra_pos_discount_${selectedBranchLabel}`);
      return stored ? Number(stored) : 0;
    } catch {
      return 0;
    }
  });

  const [customerName, setCustomerName] = useState(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return "Walk-in Customer";
    try {
      const stored = sessionStorage.getItem(`inventra_pos_custName_${selectedBranchLabel}`);
      return stored !== null ? stored : "Walk-in Customer";
    } catch {
      return "Walk-in Customer";
    }
  });

  const [customerState, setCustomerState] = useState(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return "Local";
    try {
      const stored = sessionStorage.getItem(`inventra_pos_custState_${selectedBranchLabel}`);
      return stored !== null ? stored : "Local";
    } catch {
      return "Local";
    }
  });

  const [paymentMode, setPaymentMode] = useState(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return "UPI";
    try {
      const stored = sessionStorage.getItem(`inventra_pos_payMode_${selectedBranchLabel}`);
      return stored !== null ? stored : "UPI";
    } catch {
      return "UPI";
    }
  });

  const [cardType, setCardType] = useState(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return "Credit Card";
    try {
      const stored = sessionStorage.getItem(`inventra_pos_cardType_${selectedBranchLabel}`);
      return stored !== null ? stored : "Credit Card";
    } catch {
      return "Credit Card";
    }
  });

  // For UPI/Card: cashier must explicitly confirm payment received before checkout
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);

  const [amountPaid, setAmountPaid] = useState(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return "";
    try {
      const stored = sessionStorage.getItem(`inventra_pos_amtPaid_${selectedBranchLabel}`);
      return stored !== null ? (stored === "" ? "" : Number(stored)) : "";
    } catch {
      return "";
    }
  });

  const [showReceiptModal, setShowReceiptModal] = useState(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return false;
    try {
      const stored = sessionStorage.getItem(`inventra_pos_showReceipt_${selectedBranchLabel}`);
      return stored === "true";
    } catch {
      return false;
    }
  });

  const [receiptData, setReceiptData] = useState(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return null;
    try {
      const stored = sessionStorage.getItem(`inventra_pos_receiptData_${selectedBranchLabel}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Payment modal state for Card/UPI
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState(null);

  // Derived state sync: Immediately load specific branch states when branch switches during active POS session
  if (activeBranch !== selectedBranchLabel) {
    setActiveBranch(selectedBranchLabel);
    if (typeof window !== "undefined" && selectedBranchLabel) {
      try {
        const storedCart = sessionStorage.getItem(`inventra_pos_cart_${selectedBranchLabel}`);
        setCart(storedCart ? JSON.parse(storedCart) : []);

        const storedDiscount = sessionStorage.getItem(`inventra_pos_discount_${selectedBranchLabel}`);
        setDiscount(storedDiscount ? Number(storedDiscount) : 0);

        const storedCustName = sessionStorage.getItem(`inventra_pos_custName_${selectedBranchLabel}`);
        setCustomerName(storedCustName !== null ? storedCustName : "Walk-in Customer");

        const storedCustState = sessionStorage.getItem(`inventra_pos_custState_${selectedBranchLabel}`);
        setCustomerState(storedCustState !== null ? storedCustState : "Local");

        const storedPayMode = sessionStorage.getItem(`inventra_pos_payMode_${selectedBranchLabel}`);
        setPaymentMode(storedPayMode !== null ? storedPayMode : "UPI");

        const storedCardType = sessionStorage.getItem(`inventra_pos_cardType_${selectedBranchLabel}`);
        setCardType(storedCardType !== null ? storedCardType : "Credit Card");

        const storedAmtPaid = sessionStorage.getItem(`inventra_pos_amtPaid_${selectedBranchLabel}`);
        setAmountPaid(storedAmtPaid !== null ? (storedAmtPaid === "" ? "" : Number(storedAmtPaid)) : "");

        const storedShowReceipt = sessionStorage.getItem(`inventra_pos_showReceipt_${selectedBranchLabel}`);
        setShowReceiptModal(storedShowReceipt === "true");

        const storedReceiptData = sessionStorage.getItem(`inventra_pos_receiptData_${selectedBranchLabel}`);
        setReceiptData(storedReceiptData ? JSON.parse(storedReceiptData) : null);
      } catch (e) {
        console.warn("Failed to restore branch state", e);
      }
    }
  }

  React.useEffect(() => {
    if (typeof window === "undefined" || !selectedBranchLabel) return;
    try {
      sessionStorage.setItem(`inventra_pos_cart_${selectedBranchLabel}`, JSON.stringify(cart));
      sessionStorage.setItem(`inventra_pos_discount_${selectedBranchLabel}`, String(discount));
      sessionStorage.setItem(`inventra_pos_custName_${selectedBranchLabel}`, customerName);
      sessionStorage.setItem(`inventra_pos_custState_${selectedBranchLabel}`, customerState);
      sessionStorage.setItem(`inventra_pos_payMode_${selectedBranchLabel}`, paymentMode);
      sessionStorage.setItem(`inventra_pos_cardType_${selectedBranchLabel}`, cardType);
      sessionStorage.setItem(`inventra_pos_amtPaid_${selectedBranchLabel}`, String(amountPaid));
      sessionStorage.setItem(`inventra_pos_showReceipt_${selectedBranchLabel}`, String(showReceiptModal));
      sessionStorage.setItem(
        `inventra_pos_receiptData_${selectedBranchLabel}`,
        receiptData ? JSON.stringify(receiptData) : ""
      );
    } catch {
      // ignore
    }
  }, [cart, discount, customerName, customerState, paymentMode, cardType, amountPaid, showReceiptModal, receiptData, selectedBranchLabel]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [scannerFeedback, setScannerFeedback] = useState(null);
  const [scannerCameraStatus, setScannerCameraStatus] = useState("idle");
  const [scannerCameraMessage, setScannerCameraMessage] = useState("");
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

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
    let buffer = "";
    let lastKeyTime = 0;

    const handleGlobalKeyDown = (e) => {
      // Ignore if user is typing normally inside focused manual text inputs
      if (document.activeElement?.tagName === "INPUT" && document.activeElement !== scannerInputRef.current) {
        const delta = Date.now() - lastKeyTime;
        if (delta > 40) {
          buffer = "";
          return;
        }
      }

      const currentTime = Date.now();
      const isNumber = /^[0-9]$/.test(e.key);

      if (isNumber) {
        const timeDiff = currentTime - lastKeyTime;
        if (buffer.length === 0 || timeDiff < 40) {
          buffer += e.key;
          lastKeyTime = currentTime;
          if (timeDiff < 40 && buffer.length > 1) {
            e.preventDefault();
          }
        } else {
          buffer = e.key;
          lastKeyTime = currentTime;
        }
        return;
      }

      if (e.key === "Enter" && buffer.length >= 8) {
        const timeDiff = currentTime - lastKeyTime;
        if (timeDiff < 45) {
          e.preventDefault();
          e.stopPropagation();
          const finalBarcode = buffer;
          buffer = "";
          handleScanBarcode(finalBarcode);
        }
      }

      if (!isNumber && e.key !== "Enter") {
        buffer = "";
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [products]);

  React.useEffect(() => {
    if (!isScannerOpen || scannerCameraStatus !== "error") return undefined;
    const timer = setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [isScannerOpen, scannerCameraStatus]);

  const stopScannerCamera = React.useCallback(() => {
    setScannerCameraStatus("idle");
    setScannerCameraMessage("");
  }, []);

  React.useEffect(() => {
    if (!isScannerOpen) {
      setVideoDevices([]);
      setSelectedDeviceId("");
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

  React.useEffect(() => {
    const handleBeforeUnload = (e) => {
      const hasActiveCart = cart.length > 0;
      if (hasActiveCart) {
        e.preventDefault();
        e.returnValue = "You have items in your basket. Refreshing will clear the sales ticket. Are you sure you want to reload?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [cart]);

  const barcodeIndex = useMemo(() => {
    const index = new Map();
    products.forEach((product) => {
      const barcode = normalizeBarcode(product.barcode);
      if (barcode && !index.has(barcode)) {
        index.set(barcode, product);
      }
    });
    return index;
  }, [products]);

  const handleScanBarcode = (barcodeStr) => {
    const scannedBarcode = normalizeBarcode(barcodeStr);
    if (!scannedBarcode) return false;
    setScannerInput("");
    
    const product = barcodeIndex.get(scannedBarcode) || products.find((p) => normalizeBarcode(p.barcode) === scannedBarcode);
    
    if (product) {
      if (product.stock <= 0) {
        playScanSound(false);
        setScannerFeedback({
          status: "error",
          message: `"${product.name}" is out of stock!`,
        });
        return false;
      } else {
        addToCart(product);
        playScanSound(true);
        setScannerFeedback({
          status: "success",
          message: `Added ${product.name} to basket!`,
        });
        return true;
      }
    } else {
      playScanSound(false);
      setScannerFeedback({
        status: "error",
        message: `Barcode "${scannedBarcode}" not registered in POS inventory!`,
      });
      return false;
    }
  };

  const handleImageCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerCameraStatus("starting");
    setScannerCameraMessage("Processing captured photo...");

    try {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        try {
          // Downscale the image to a max dimension of 900px to speed up ZXing processing by 95%!
          const MAX_DIM = 900;
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Could not get 2D canvas context.");

          ctx.drawImage(img, 0, 0, width, height);

          // Decode directly from the optimized canvas with high-precision hints!
          const reader = new BrowserMultiFormatReader();
          const hints = new Map();
          hints.set(DecodeHintType.TRY_HARDER, true);
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.ITF,
            BarcodeFormat.QR_CODE
          ]);
          reader.hints = hints;
          const result = await reader.decodeFromCanvas(canvas);
          URL.revokeObjectURL(imageUrl);

          if (result) {
            const text = result.text || (typeof result.getText === "function" ? result.getText() : "");
            if (text) {
              handleScanBarcode(text);
            } else {
              throw new Error("No clear barcode text detected in photo.");
            }
          } else {
            throw new Error("Could not find a valid barcode structure.");
          }
        } catch (err) {
          console.warn("ZXing image decode failed:", err);
          URL.revokeObjectURL(imageUrl);
          setScannerCameraStatus("error");
          setScannerCameraMessage("Failed to read barcode from photo. Make sure it is close-up, sharp, and well-lit.");
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        setScannerCameraStatus("error");
        setScannerCameraMessage("Failed to load captured image file.");
      };
      img.src = imageUrl;
    } catch (err) {
      console.warn("Image capture processing failed:", err);
      setScannerCameraStatus("error");
      setScannerCameraMessage("Error opening camera capture file.");
    }
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

  const isInterstate = customerState === "Interstate";
  const cartBreakdown = cart.map((item) => ({
    ...item,
    pricing: calculateCartLine(item, isInterstate),
  }));
  const subtotal = toMoney(cartBreakdown.reduce((acc, item) => acc + item.pricing.gross, 0));
  const totalUnits = cart.reduce((acc, item) => acc + item.quantity, 0);
  const billDiscountAmount = toMoney(Number(discount) > 0 ? (subtotal * Number(discount)) / 100 : 0);
  const itemDiscountAmount = toMoney(cartBreakdown.reduce((acc, item) => acc + item.pricing.discountAmount, 0));
  const discountAmount = toMoney(itemDiscountAmount + billDiscountAmount);
  const discountRatio = subtotal > 0 && billDiscountAmount > 0 ? billDiscountAmount / subtotal : 0;
  const taxableAmount = toMoney(cartBreakdown.reduce(
    (acc, item) => acc + Math.max(0, item.pricing.taxableAmount - item.pricing.gross * discountRatio),
    0,
  ));
  const cgstAmount = toMoney(cartBreakdown.reduce((acc, item) => {
    const billDiscountShare = item.pricing.gross * discountRatio;
    const adjustedTaxable = Math.max(0, item.pricing.taxableAmount - billDiscountShare);
    const tax = toMoney((adjustedTaxable * item.pricing.gstRate) / 100);
    return acc + (isInterstate ? 0 : tax / 2);
  }, 0));
  const sgstAmount = toMoney(cartBreakdown.reduce((acc, item) => {
    const billDiscountShare = item.pricing.gross * discountRatio;
    const adjustedTaxable = Math.max(0, item.pricing.taxableAmount - billDiscountShare);
    const tax = toMoney((adjustedTaxable * item.pricing.gstRate) / 100);
    return acc + (isInterstate ? 0 : tax / 2);
  }, 0));
  const igstAmount = toMoney(cartBreakdown.reduce((acc, item) => {
    const billDiscountShare = item.pricing.gross * discountRatio;
    const adjustedTaxable = Math.max(0, item.pricing.taxableAmount - billDiscountShare);
    return acc + (isInterstate ? (adjustedTaxable * item.pricing.gstRate) / 100 : 0);
  }, 0));
  const totalTax = toMoney(cgstAmount + sgstAmount + igstAmount);
  const grandTotal = toMoney(taxableAmount + totalTax);

  const isCashAmountMissing = paymentMode === "Cash" && cart.length > 0 && (amountPaid === "" || Number(amountPaid) === 0);
  const safeAmountPaid = paymentMode !== "Cash"
    ? grandTotal
    : Number(amountPaid) || 0;
  const changeDue = Math.max(0, safeAmountPaid - grandTotal);
  const isPaymentShort = paymentMode === "Cash" && cart.length > 0 && !isCashAmountMissing && safeAmountPaid < grandTotal;

  // Master gate: true only when payment is actually done
  const isPaymentReady = cart.length > 0 && (
    paymentMode === "Cash"
      ? !isCashAmountMissing && !isPaymentShort   // cash: amount entered and sufficient
      : isPaymentConfirmed                         // UPI/Card: cashier confirmed received
  );

  const availableSkus = products.filter((p) => p.stock > 0).length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length;

  const applyTenderQuickAmount = (value) => {
    setAmountPaid(Math.max(0, Number(value) || 0));
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saleError, setSaleError] = useState("");

  const quickAddProducts = filteredProducts.slice(0, 6);
  const handleCheckout = async () => {
    if (!isPaymentReady || isSaving) return;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalReceipt = {
      invoiceNumber,
      date: new Date().toLocaleString(),
      customerName,
      customerState,
      paymentMode: paymentMode === "Card" ? `Card (${cardType})` : paymentMode,
      amountPaid: safeAmountPaid,
      changeDue,
      items: cartBreakdown.map(({ pricing, ...item }) => ({
        ...item,
        unitPrice: pricing.unitPrice,
        lineGross: pricing.gross,
        lineDiscountAmount: pricing.discountAmount,
        lineTaxableAmount: pricing.taxableAmount,
        gstRate: pricing.gstRate,
        cgstAmount: pricing.cgstAmount,
        sgstAmount: pricing.sgstAmount,
        igstAmount: pricing.igstAmount,
        lineTaxAmount: pricing.taxAmount,
        lineTotal: pricing.lineTotal,
      })),
      subtotal,
      discountPercent: Number(discount) || 0,
      itemDiscountAmount,
      billDiscountAmount,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      grandTotal,
    };

    setSaleError("");
    setIsSaving(true);

    await onRecordSale(
      finalReceipt,
      // onSuccess — DB confirmed
      () => {
        setIsSaving(false);
        setReceiptData(finalReceipt);
        setShowReceiptModal(true);
        setCart([]);
        setDiscount(0);
        setAmountPaid("");
      },
      // onError — DB failed
      (errMsg) => {
        setIsSaving(false);
        setSaleError(errMsg || "Failed to record sale. Please try again.");
      }
    );
  };

  return (
    <div className="flex flex-col lg:flex-row text-left items-stretch w-full min-h-0 bg-slate-50">

      {/* ── LEFT: Product Counter ─────────────────────────────────────────── */}
      <section className="flex-1 min-w-0 bg-slate-50 p-3 sm:p-4 md:p-5 flex flex-col min-h-0 space-y-4">

        {products.length > 0 && (
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
        )}

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
        <div className="flex-1 md:overflow-y-auto md:pr-1 [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [scrollbar-width:none] [-ms-overflow-style:none] flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="rounded-[28px] border border-slate-200 bg-white px-10 py-16 text-center flex flex-col items-center justify-center select-none shadow-[0_10px_35px_rgba(0,0,0,0.025)] max-w-md w-full mx-auto">
                <span className="w-10 h-10 rounded-full border-[4px] border-slate-100 border-t-slate-800 animate-spin" />
                <div className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] mt-7">Loading Branch Catalog</div>
                <p className="text-xs font-semibold text-slate-500 mt-3 max-w-xs mx-auto leading-relaxed">
                  Fetching latest synchronized stock levels and barcode directory from Inventra master catalog.
                </p>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="rounded-[32px] border bg-white p-12 text-center select-none shadow-[0_12px_40px_rgba(0,0,0,0.02)] relative overflow-hidden max-w-lg w-full mx-auto"
                   style={{ borderColor: "rgba(0, 0, 0, 0.08)" }}>
                
                {/* Aesthetic SVG box icon wrapper - solid borders & backgrounds, no gradient glow */}
                <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300"
                     style={{
                       background: `${tierAccent}12`,
                       border: `1.5px dashed ${tierAccent}30`,
                     }}>
                  <svg className="w-8 h-8" fill="none" stroke={tierAccent} strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>

                <h3 className="text-sm font-black uppercase tracking-[0.24em] text-slate-800 leading-none">Catalog Ready for Intake</h3>
                <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.16em]">Local branch stock registry is empty</div>

                <p className="text-xs font-semibold text-slate-500 mt-5.5 max-w-md mx-auto leading-relaxed">
                  To populate this sales terminal, register dynamic stock or scan products inside the <span className="font-black text-slate-800">Inventory Operations</span> command deck. Catalog data updates will automatically sync here.
                </p>

                <div className="mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined" && selectedBranchLabel) {
                        sessionStorage.setItem("inventra_inventory_branch", selectedBranchLabel);
                      }
                      if (typeof setActiveTab === "function") {
                        setActiveTab(`inventory-ops-${tier || "small"}`);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] cursor-pointer shadow-sm shadow-slate-200 select-none"
                    style={{ background: tierAccent }}
                  >
                    Configure Stock Ledger ➜
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                        <div className="text-[10px] font-bold text-slate-400">{p.sellOnMrp ? "MRP Rate" : "Sale Rate"}</div>
                        <div className="text-sm font-black text-slate-900">₹{getItemBasePrice(p)}</div>
                        <div className="text-[9px] font-bold text-slate-400">GST {getItemGstRate(p)}%</div>
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
          )}
        </div>
      </section>

      {/* ── RIGHT: Invoice Basket Sidebar ────────────────────────────────── */}
      <aside className="order-2 lg:order-none w-full lg:w-[360px] xl:w-[410px] flex-shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col max-h-[82dvh] lg:max-h-none lg:h-full lg:overflow-hidden [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 [scrollbar-width:none] [-ms-overflow-style:none]">
        {/* ── SIDEBAR HEADER (pinned, never scrolls) ──────────────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-3 flex-shrink-0 sticky top-0 bg-white z-10">
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
              <CustomDropdown
                value={customerState}
                onChange={setCustomerState}
                options={[
                  { value: "Local", label: "Intrastate (CGST+SGST)" },
                  { value: "Interstate", label: "Interstate (IGST)" },
                ]}
                theme="sky"
                size="sm"
                buttonClassName="rounded-lg px-2 py-1 text-[10px] font-black h-7"
              />
            </div>
          </div>
        </div>

        {/* ── CART LIST (scrollable middle zone) ──────────────────────── */}
        <div className="w-full px-4 py-3 space-y-1.5 flex-1 min-h-0 overflow-y-auto">

          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-6 text-center">
              <p className="text-xs font-bold text-slate-500">Your ticket is empty</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-1">Tap items from the product panel or use Quick Add to begin.</p>
            </div>
          ) : (
            cartBreakdown.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                      ₹{item.pricing.unitPrice} x {item.quantity} | GST {item.pricing.gstRate}%
                    </p>
                  </div>
                  <div className="text-xs font-black text-slate-900 shrink-0">₹{item.pricing.lineTotal.toLocaleString()}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px] font-black text-slate-500">
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1">
                    {item.sellOnMrp ? "MRP rate" : "Discounted rate"}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-right">
                    Discount {clampPercent(item.discountPercent)}%
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                    <button type="button" onClick={() => updateCartQty(item.id, -1)} className="h-5 w-5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 text-xs font-black cursor-pointer flex items-center justify-center">-</button>
                    <span className="w-5 text-center text-[11px] font-black text-slate-900">{item.quantity}</span>
                    <button type="button" onClick={() => updateCartQty(item.id, 1)} className="h-5 w-5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 text-xs font-black cursor-pointer flex items-center justify-center">+</button>
                  </div>
                  {item.pricing.discountAmount > 0 && (
                    <span className="text-[9px] font-black text-emerald-600">
                      -₹{item.pricing.discountAmount.toFixed(2)}
                    </span>
                  )}
                  <button type="button" onClick={() => removeFromCart(item.id)} className="text-[9px] font-black uppercase tracking-[0.12em] text-rose-500 hover:text-rose-700 cursor-pointer">Remove</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── FOOTER (pinned, never scrolls) ──────────────────────────── */}
        <div className="px-4 pb-4 pt-2.5 border-t border-slate-100 space-y-2.5 flex-shrink-0 sticky bottom-0 bg-white">

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
            {itemDiscountAmount > 0 && (
              <div className="flex justify-between items-center text-emerald-600">
                <span className="font-semibold">Item discounts</span>
                <span className="font-black">-₹{itemDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-slate-100 pt-1.5 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Taxable</span>
                <span className="font-black text-slate-900">₹{taxableAmount.toLocaleString()}</span>
              </div>
              {isInterstate ? (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500">IGST (item-wise)</span>
                  <span className="font-black text-slate-700">₹{igstAmount.toLocaleString()}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">CGST (item-wise)</span>
                    <span className="font-black text-slate-700">₹{cgstAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">SGST (item-wise)</span>
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

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2.5">

            {/* Payment Mode selector */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 shrink-0">Payment Mode</span>
              <div className="grid w-full grid-cols-3 gap-1 sm:w-auto">
                {["UPI", "Card", "Cash"].map((mode) => {
                  const active = paymentMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setPaymentMode(mode);
                        setIsPaymentConfirmed(false);
                        setSaleError("");
                      }}
                      className={`min-w-0 rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-[0.05em] transition-all cursor-pointer ${
                        active ? "text-white border-transparent" : "border-slate-200 bg-white text-slate-500 hover:text-slate-900"
                      }`}
                      style={active ? { background: tierAccent } : undefined}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-200" />

            {/* Cash: enter amount + quick tender */}
            {paymentMode === "Cash" && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 items-start sm:items-center">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 shrink-0 whitespace-nowrap">Received (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={amountPaid}
                      onChange={(e) => { setAmountPaid(e.target.value); setSaleError(""); }}
                      placeholder={grandTotal > 0 ? String(Math.ceil(grandTotal)) : "0"}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-black text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
                    />
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Change</span>
                    <span className={`text-[12px] font-black ${changeDue > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                      ₹{changeDue.toFixed(2)}
                    </span>
                  </div>
                </div>
                {/* Quick tender presets */}
                {grandTotal > 0 && (
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                    {[...new Set([
                      grandTotal,
                      Math.ceil(grandTotal / 10) * 10,
                      Math.ceil(grandTotal / 50) * 50,
                      Math.ceil(grandTotal / 100) * 100,
                    ])].slice(0, 4).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmountPaid(amt)}
                        className={`rounded-md border py-1 text-[8.5px] font-black transition-colors cursor-pointer ${
                          Number(amountPaid) === amt
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                        }`}
                      >
                        ₹{Number.isInteger(amt) ? amt : amt.toFixed(0)}
                      </button>
                    ))}
                  </div>
                )}
                {/* Status */}
                {isCashAmountMissing && (
                  <p className="text-[9px] font-bold text-amber-600 text-center">
                    ↑ Enter the cash amount received from customer
                  </p>
                )}
                {isPaymentShort && (
                  <p className="text-[9px] font-bold text-rose-600 text-center">
                    Short by ₹{(grandTotal - safeAmountPaid).toFixed(2)} — ask customer for more
                  </p>
                )}
                {isPaymentReady && (
                  <p className="text-[9px] font-bold text-emerald-600 text-center">
                    ✓ Cash payment ready — ₹{changeDue.toFixed(2)} change to return
                  </p>
                )}
              </div>
            )}

            {/* UPI / Card: open payment modal */}
            {paymentMode !== "Cash" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Amount Due</span>
                  <span className="text-[13px] font-black text-slate-800">₹{grandTotal.toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={() => {
                    setPendingPaymentData({
                      amount: grandTotal,
                      items: cart,
                      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
                    });
                    setIsPaymentModalOpen(true);
                    setSaleError("");
                  }}
                  className={`w-full rounded-xl py-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition-all flex items-center justify-center gap-2 border ${
                    cart.length === 0
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                      : isPaymentConfirmed
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-[0_3px_10px_rgba(16,185,129,0.4)] cursor-pointer"
                        : "bg-white text-slate-600 border-slate-300 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer"
                  }`}
                >
                  {isPaymentConfirmed ? (
                    <>
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {paymentMode} Payment Confirmed ✓
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Proceed to {paymentMode} Payment
                    </>
                  )}
                </button>
                {!isPaymentConfirmed && cart.length > 0 && (
                  <p className="text-[8.5px] font-semibold text-slate-400 text-center">
                    Tap to open secure payment gateway and accept {paymentMode}
                  </p>
                )}
              </div>
            )}

            {/* Sale error */}
            {saleError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 flex items-center gap-2">
                <span className="text-[11px] shrink-0">❌</span>
                <p className="text-[9px] font-black text-rose-700">{saleError}</p>
              </div>
            )}
          </div>

          {/* Checkout button — disabled until isPaymentReady */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={!isPaymentReady || isSaving}
            className={`w-full rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all h-10 inline-flex items-center justify-center gap-2 ${
              !isPaymentReady
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : isSaving
                  ? "bg-slate-200 text-slate-500 cursor-wait"
                  : "text-white shadow-[0_4px_14px_rgba(15,23,42,0.18)] hover:scale-[1.01] cursor-pointer"
            }`}
            style={isPaymentReady && !isSaving ? { background: tierAccent } : undefined}
          >
            {isSaving ? (
              <>
                <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Recording Sale…
              </>
            ) : !isPaymentReady ? (
              cart.length === 0
                ? "Add Items to Continue"
                : paymentMode === "Cash"
                  ? isCashAmountMissing ? "Enter Cash Amount First" : "Cash Amount Insufficient"
                  : `Confirm ${paymentMode} Payment First`
            ) : (
              "Pay & Generate Invoice"
            )}
          </button>
        </div>
      </aside>

      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-900/65 backdrop-blur-sm overflow-y-auto">
          {/* Dynamic CSS Print Overrides */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              .receipt-print-wrapper, .receipt-print-wrapper * {
                visibility: visible !important;
              }
              .receipt-print-wrapper {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 80mm !important;
                margin: 0 !important;
                padding: 4mm !important;
                background: white !important;
                color: black !important;
                font-family: monospace !important;
                box-shadow: none !important;
                border: none !important;
              }
              .receipt-print-btn-bar {
                display: none !important;
              }
            }
          ` }} />

          <div className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-slate-50 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-slate-800 flex flex-col gap-4 my-8">
            
            {/* Receipt Body Container */}
            <div className="receipt-print-wrapper bg-white border border-slate-200 rounded-2xl p-6 shadow-inner text-slate-950 font-mono text-[12px] md:text-[13px] leading-relaxed select-text relative">
              
              {/* Physical thermal paper zigzag edge aesthetic at the top */}
              <div className="absolute top-0 inset-x-0 h-1 bg-[linear-gradient(45deg,transparent_33.3%,#e2e8f0_33.3%,#e2e8f0_66.6%,transparent_66.6%)] bg-[length:6px_4px]" />
              
              <div className="text-center space-y-1 mt-2">
                <h2 className="text-lg font-black tracking-widest text-slate-900 uppercase">{businessName}</h2>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Tax Invoice</p>
                
                <div className="text-[10px] md:text-[11px] text-slate-500 leading-relaxed font-semibold mt-1.5">
                  <div className="font-black text-slate-800 text-[11px] uppercase tracking-wide">Branch: {selectedBranchLabel}</div>
                  <div className="max-w-[240px] mx-auto mt-0.5 leading-relaxed">{activeBranchDetails.address}</div>
                  <div className="mt-0.5">Tel: {activeBranchDetails.phone}</div>
                  <div className="font-bold text-slate-700 mt-0.5">GSTIN: {activeBranchDetails.gstin}</div>
                </div>
              </div>

              <div className="my-3.5 border-t border-dashed border-slate-300" />

              {/* Meta details */}
              <div className="space-y-1 text-[10.5px] md:text-[11.5px] font-bold text-slate-600">
                <div className="flex justify-between"><span>TAX INVOICE:</span><span className="text-slate-900 font-black">{receiptData.invoiceNumber}</span></div>
                <div className="flex justify-between"><span>DATE / TIME:</span><span>{receiptData.date}</span></div>
                <div className="flex justify-between"><span>CASHIER:</span><span>{userDisplayName}</span></div>
                <div className="flex justify-between"><span>CUSTOMER:</span><span>{receiptData.customerName}</span></div>
                <div className="flex justify-between"><span>PAY MODE:</span><span className="text-slate-900 font-black uppercase">{receiptData.paymentMode}</span></div>
              </div>

              <div className="my-3.5 border-t border-dashed border-slate-300" />

              {/* Monospaced Dotted Header */}
              <div className="flex justify-between font-black text-slate-900 text-[11px] md:text-[12px] uppercase">
                <span>ITEM DESCRIPTION</span>
                <span>TOTAL</span>
              </div>
              
              <div className="my-2 border-t border-dashed border-slate-200" />

              {/* Items rows */}
              <div className="space-y-2.5 py-1 text-[11px] md:text-[12px]">
                {receiptData.items.map((item) => (
                  <div key={item.id} className="space-y-0.5">
                    <div className="flex justify-between font-black text-slate-950 uppercase gap-3">
                      <span className="break-words text-left flex-1">{item.name}</span>
                      <span className="shrink-0 font-mono text-right">₹{(item.lineTotal ?? item.quantity * item.price).toLocaleString()}</span>
                    </div>
                    <div className="text-[10px] md:text-[11px] font-bold text-slate-500 text-right">
                      {item.quantity} x ₹{item.unitPrice ?? item.price} | GST {item.gstRate ?? getItemGstRate(item)}%
                      {item.lineDiscountAmount > 0 ? ` | Discount ₹${item.lineDiscountAmount.toFixed(2)}` : ""}
                    </div>
                  </div>
                ))}
              </div>

              <div className="my-3.5 border-t border-dashed border-slate-300" />

              {/* Summaries list */}
              <div className="space-y-1.5 text-[10.5px] md:text-[11.5px] font-bold text-slate-600">
                <div className="flex justify-between"><span>SUBTOTAL</span><span>₹{receiptData.subtotal.toFixed(2)}</span></div>
                {receiptData.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-black">
                    <span>DISCOUNT ({receiptData.discountPercent}%)</span>
                    <span>-₹{receiptData.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between"><span>TAXABLE</span><span>₹{receiptData.taxableAmount.toFixed(2)}</span></div>
                
                {receiptData.customerState === "Interstate" ? (
                  <div className="flex justify-between"><span>IGST (ITEM-WISE)</span><span>₹{receiptData.igstAmount.toFixed(2)}</span></div>
                ) : (
                  <>
                    <div className="flex justify-between"><span>CGST (ITEM-WISE)</span><span>₹{receiptData.cgstAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>SGST (ITEM-WISE)</span><span>₹{receiptData.sgstAmount.toFixed(2)}</span></div>
                  </>
                )}
                <div className="flex justify-between font-black text-slate-700"><span>TOTAL TAX (GST)</span><span>₹{receiptData.totalTax.toFixed(2)}</span></div>
                
                <div className="my-3 border-t border-dashed border-slate-300" />
                
                <div className="flex justify-between text-slate-900 text-sm md:text-base font-black tracking-wide border-y border-dashed border-slate-300 py-2">
                  <span>GRAND TOTAL</span>
                  <span>₹{receiptData.grandTotal.toFixed(2)}</span>
                </div>

                {receiptData.paymentMode === "Cash" ? (
                  <>
                    <div className="pt-2.5 flex justify-between"><span>CASH RECEIVED</span><span>₹{receiptData.amountPaid.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>CHANGE RETURNED</span><span>₹{receiptData.changeDue.toFixed(2)}</span></div>
                  </>
                ) : (
                  <div className="pt-2.5 flex justify-between font-black text-slate-700">
                    <span>PAID VIA {receiptData.paymentMode.toUpperCase()}</span>
                    <span>₹{receiptData.amountPaid.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="my-4 border-t border-dashed border-slate-300" />

              {/* Simulated retail barcode */}
              <div className="text-center py-1 select-none">
                <svg className="mx-auto w-44 h-9 text-slate-950" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <rect x="0" y="0" width="2.5" height="20" fill="currentColor" />
                  <rect x="4" y="0" width="1.2" height="20" fill="currentColor" />
                  <rect x="6.5" y="0" width="3.2" height="20" fill="currentColor" />
                  <rect x="11" y="0" width="1.2" height="20" fill="currentColor" />
                  <rect x="13.5" y="0" width="2.5" height="20" fill="currentColor" />
                  <rect x="17.2" y="0" width="4.5" height="20" fill="currentColor" />
                  <rect x="23" y="0" width="1.2" height="20" fill="currentColor" />
                  <rect x="25.5" y="0" width="2.5" height="20" fill="currentColor" />
                  <rect x="29" y="0" width="3.2" height="20" fill="currentColor" />
                  <rect x="33.5" y="0" width="1.2" height="20" fill="currentColor" />
                  <rect x="36" y="0" width="2.5" height="20" fill="currentColor" />
                  <rect x="39.5" y="0" width="4.5" height="20" fill="currentColor" />
                  <rect x="45.2" y="0" width="1.2" height="20" fill="currentColor" />
                  <rect x="47.5" y="0" width="3.2" height="20" fill="currentColor" />
                  <rect x="52" y="0" width="2.5" height="20" fill="currentColor" />
                  <rect x="55.5" y="0" width="1.2" height="20" fill="currentColor" />
                  <rect x="58" y="0" width="4.5" height="20" fill="currentColor" />
                  <rect x="63.7" y="0" width="2.5" height="20" fill="currentColor" />
                  <rect x="67.2" y="0" width="3.2" height="20" fill="currentColor" />
                  <rect x="71.5" y="0" width="1.2" height="20" fill="currentColor" />
                  <rect x="74" y="0" width="2.5" height="20" fill="currentColor" />
                  <rect x="77.5" y="0" width="4.5" height="20" fill="currentColor" />
                  <rect x="83.2" y="0" width="1.2" height="20" fill="currentColor" />
                  <rect x="85.5" y="0" width="3.2" height="20" fill="currentColor" />
                  <rect x="90" y="0" width="2.5" height="20" fill="currentColor" />
                  <rect x="93.7" y="0" width="1.2" height="20" fill="currentColor" />
                  <rect x="96.2" y="0" width="4" height="20" fill="currentColor" />
                </svg>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">{receiptData.invoiceNumber}</p>
              </div>

              <div className="my-2.5 border-t border-dashed border-slate-200" />

              <div className="text-center text-[10px] md:text-[11px] text-slate-500 font-bold space-y-0.5 mt-2.5 uppercase tracking-wide">
                <div>Thank you for your purchase!</div>
                <div className="text-slate-400">Powered by Inventra retail AI</div>
                <div className="text-[8px] tracking-normal mt-1 text-slate-400 font-medium">E. & O.E. - No returns without original receipt</div>
              </div>

              {/* Torn edge bottom zigzag pattern */}
              <div className="absolute bottom-0 inset-x-0 h-1 bg-[linear-gradient(225deg,transparent_33.3%,#e2e8f0_33.3%,#e2e8f0_66.6%,transparent_66.6%)] bg-[length:6px_4px]" />
            </div>

            {/* Action Buttons (Excluded from Print) */}
            <div className="receipt-print-btn-bar flex gap-3.5">
              <button
                type="button"
                onClick={() => {
                  setShowReceiptModal(false);
                  setCart([]);
                  setDiscount(0);
                  setAmountPaid("");
                  setCustomerName("Walk-in Customer");
                  setCustomerState("Local");
                  setPaymentMode("UPI");
                  setReceiptData(null);
                }}
                className="flex-1 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-700 transition-colors cursor-pointer text-center active:scale-[0.98] select-none"
              >
                Close & New
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 rounded-2xl py-3 text-xs font-black uppercase tracking-[0.14em] text-white transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 active:scale-[0.98] select-none shadow-md shadow-slate-200/50 hover:brightness-110"
                style={{ background: tierAccent }}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h10a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2Zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10Z" />
                </svg>
                Print Receipt
              </button>
            </div>
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
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Scan with camera or use hardware wedge</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopScannerCamera();
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

            {/* Camera Select Dropdown */}
            {videoDevices.length > 1 && (
              <div className="flex items-center justify-between bg-slate-950/40 border border-slate-800 p-2.5 rounded-2xl gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Select Camera</span>
                <CustomDropdown
                  value={selectedDeviceId}
                  onChange={setSelectedDeviceId}
                  options={videoDevices.map((device) => ({
                    value: device.deviceId,
                    label: device.label || `Camera ${videoDevices.indexOf(device) + 1}`,
                  }))}
                  theme="rose"
                  size="sm"
                  buttonClassName="rounded-lg border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-black text-slate-200 focus:border-rose-500 max-w-[200px] truncate"
                  className="w-auto"
                  dark={true}
                />
              </div>
            )}
            <div className="relative aspect-video max-w-sm w-full mx-auto rounded-2xl bg-slate-955 border border-slate-800 overflow-hidden flex items-center justify-center">
              {isScannerOpen && (
                <PureBarcodeScanner
                  selectedDeviceId={selectedDeviceId}
                  onDevicesFound={(devices, activeId) => {
                    setVideoDevices(devices);
                    if (activeId && !selectedDeviceId) {
                      setSelectedDeviceId(activeId);
                    }
                  }}
                  onScanSuccess={(text) => {
                    if (text) {
                      handleScanBarcode(text);
                    }
                  }}
                  onScanError={(err) => {
                    const errMsg = err.message || "";
                    if (
                      errMsg.includes("Permission") ||
                      errMsg.includes("NotAllowedError") ||
                      errMsg.includes("Requested device not found")
                    ) {
                      setScannerCameraStatus("error");
                      setScannerCameraMessage("Camera access denied or device unavailable.");
                    }
                  }}
                  setScannerCameraStatus={setScannerCameraStatus}
                  setScannerCameraMessage={setScannerCameraMessage}
                />
              )}

              <div className="absolute inset-0 bg-slate-950/40 z-20" />

              {/* Sweeping Laser Line */}
              <div className="scan-laser-line z-20" />

              {/* Corner Targets */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-rose-500 rounded-tl z-20" />
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-rose-500 rounded-tr z-20" />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-rose-500 rounded-bl z-20" />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-rose-500 rounded-br z-20" />

              {/* Central text indicator */}
              <div className="text-center z-30 pointer-events-none select-none px-4">
                <div className="text-[9px] font-black uppercase text-rose-500 tracking-[0.25em] animate-pulse-soft">
                  {scannerCameraStatus === "error" ? "CAMERA UNAVAILABLE" : "LIVE CAMERA SCAN ACTIVE"}
                </div>
                <div className="text-[8px] font-bold text-slate-300 tracking-wider mt-1">
                  {scannerCameraStatus === "error"
                    ? "Use manual barcode entry below"
                    : scannerCameraMessage || "READY TO READ EAN / UPC / CODE128"}
                </div>
              </div>
            </div>
            {/* Manual scan form */}
            <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
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
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-955 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer select-none"
                >
                  Scan Code
                </button>
              </form>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-rose-400 hover:text-rose-300 transition-all cursor-pointer select-none">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  Capture Autofocus Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageCapture}
                  />
                </label>
              </div>
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

      {/* Payment Modal for Card/UPI */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        amount={pendingPaymentData?.amount || 0}
        invoiceNumber={pendingPaymentData?.invoiceNumber || ""}
        items={pendingPaymentData?.items || []}
        customerName={customerName}
        customerState={customerState}
        branchName={selectedBranchLabel}
        paymentMode={paymentMode}
        businessName={businessName}
        tierAccent={tierAccent}
        onPaymentSuccess={(paymentData) => {
          setIsPaymentModalOpen(false);
          setIsPaymentConfirmed(true);
          setSaleError("");
        }}
        onPaymentFailure={(errorMsg) => {
          const message = String(errorMsg || "").replace(/payment could not be completed\.?\s*please try again\.?/i, "Payment failed. Please try again.");
          setSaleError(message || "Payment failed. Please try again.");
        }}
        onCancel={() => {
          setIsPaymentModalOpen(false);
          setPendingPaymentData(null);
        }}
      />
    </div>
  );
}

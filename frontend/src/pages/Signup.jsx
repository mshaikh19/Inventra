import React from "react";
import { toast } from "react-toastify";
import BusinessTypeSelect from "../components/BusinessTypeSelect";
import ConfirmRegistration from "../components/ConfirmRegistration";
import { getDashboardTabFromUser, getTierDisplayName } from "../utils/dashboard";

const SIGNUP_DRAFT_KEY = "inventra-signup-draft";
const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  agree: false,
  company: "",
  inventorySize: "",
  transactionsLast30d: "",
  branches: "",
  employees: "",
  businessType: "",
};

const compactToastMessage = (value) => String(value || "Please check the email address.").split(".")[0].trim();

const showEmailToast = (tone, title, message) => {
  const isSuccess = tone === "success";
  const content = (
    <div className="flex w-full items-center gap-3 px-3.5 py-2.5">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] border text-xs font-black ${
          isSuccess
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}
      >
        {isSuccess ? "✓" : "!"}
      </div>
      <div className="min-w-0 flex-1 pr-8">
        <div className={`font-heading text-[0.86rem] font-extrabold tracking-[-0.02em] sm:text-[0.9rem] ${isSuccess ? "text-emerald-900" : "text-rose-700"}`}>
          {title}
        </div>
        <div className={`mt-0.5 w-full max-w-none text-[0.78rem] font-semibold leading-[0.95rem] break-words sm:text-[0.82rem] sm:leading-[1rem] ${isSuccess ? "text-emerald-950/80" : "text-rose-950/80"}`}>
          {message}
        </div>
      </div>
    </div>
  );

  const toastOptions = {
    className: isSuccess ? "inventra-toast inventra-toast--success" : "inventra-toast inventra-toast--error",
    bodyClassName: "inventra-toast__body",
    icon: false,
    closeOnClick: false,
    pauseOnHover: true,
    autoClose: 3000,
  };

  if (isSuccess) {
    toast.success(content, toastOptions);
    return;
  }

  toast.error(content, toastOptions);
};

const loadSignupDraft = () => {
  if (typeof window === "undefined") {
    return { step: 1, form: EMPTY_FORM, classification: null };
  }

  try {
    const rawDraft = window.localStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!rawDraft) return { step: 1, form: EMPTY_FORM, classification: null };

    const parsed = JSON.parse(rawDraft);
    return {
      step: parsed.step ?? 1,
      form: { ...EMPTY_FORM, ...(parsed.form || {}) },
      classification: parsed.classification ?? null,
    };

  } catch {
    return { step: 1, form: EMPTY_FORM, classification: null };
  }
};

export default function Signup({ setActiveTab }) {
  const draftState = React.useMemo(() => loadSignupDraft(), []);
  const [step, setStep] = React.useState(draftState.step);
  const [form, setForm] = React.useState(draftState.form);
  const [errors, setErrors] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [dbCheck, setDbCheck] = React.useState(null);
  const [classification, setClassification] = React.useState(
    draftState.classification,
  );
  const [classifierSchema, setClassifierSchema] = React.useState(null);
  const [emailChecking, setEmailChecking] = React.useState(false);
  const [emailAvailable, setEmailAvailable] = React.useState(null);

  const firstNameRef = React.useRef(null);
  const lastNameRef = React.useRef(null);
  const emailRef = React.useRef(null);
  const companyRef = React.useRef(null);
  const inventoryRef = React.useRef(null);
  const passwordIsStrong = form.password.length >= 8;
  const isLargeScreen =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(min-width: 1025px)").matches;

  const inputClass =
    "w-full border border-slate-200/90 bg-slate-50/50 placeholder:text-slate-400 text-slate-900 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-[#0EA5E9]/10 focus:border-[#0EA5E9] focus:bg-white transition-all duration-300 font-sans text-[12px] sm:text-[13.5px] font-semibold"; // disable page scroll while signup is open on large screens (full-height modal)

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    const isLarge =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(min-width: 1025px)").matches;

    if (isLarge) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  React.useEffect(() => {
    if (success) return;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          SIGNUP_DRAFT_KEY,
          JSON.stringify({ step, form, classification })
        );
      } catch (err) {
        // ignore storage quota errors
      }
    }
  }, [step, form, classification, success]);

  const checkEmailAvailability = React.useCallback(

    async (email) => {

      if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {

        setEmailAvailable(null);

        return;

      }

      setEmailChecking(true);

      try {

        const res = await fetch(`http://127.0.0.1:8000/api/v1/auth/check-email?email=${encodeURIComponent(email)}`);

        if (res.ok) {
          const data = await res.json();
          if (data.exists) {
            setEmailAvailable(false);
            showEmailToast("error", "Email already in use", "This email is registered. Please use a different address.");
          } else {
            setEmailAvailable(true);
          }
        } else {
          setEmailAvailable(null);
        }

      } catch (err) {

        setEmailAvailable(null);

      } finally {

        setEmailChecking(false);

      }

    },

    []

  );



  const handleChange = (k, v) => {

    setForm((prev) => ({ ...prev, [k]: v }));

    setErrors((prev) => {

      if (!prev) return null;

      if (!(k in prev)) return prev;

      const next = { ...prev };

      delete next[k];

      return Object.keys(next).length ? next : null;

    });

    

    // Check email availability when email changes

    if (k === "email" && v) {

      const timeoutId = setTimeout(() => {

        checkEmailAvailability(v);

      }, 500);

      return () => clearTimeout(timeoutId);

    }

  };



  const validateStep = (s) => {

    const e = {};

    if (s === 1) {

      if (!form.firstName) e.firstName = "First name is required.";

      if (!form.lastName) e.lastName = "Last name is required.";

      if (!form.email) {

        e.email = "Work email is required.";

      } else {

        // Improved email validation

        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        if (!re.test(form.email))

          e.email = "Enter a valid work email (e.g. you@company.com).";



      }

      if (!form.password) {

        e.password = "Choose a password.";

      } else {

        const pw = form.password;

        if (pw.length < 8)

          e.password = "Weak password. Use at least 8 characters.";

        else if (!/[A-Z]/.test(pw))

          e.password = "Password must contain at least one uppercase letter.";

        else if (!/[a-z]/.test(pw))

          e.password = "Password must contain at least one lowercase letter.";

        else if (!/[0-9]/.test(pw))

          e.password = "Password must contain at least one number.";

      }

      if (!form.agree)

        e.agree = "You must accept the Terms of Service and Privacy Policy.";

    }

    if (s === 2) {
      // business step validation
      if (!form.company) e.company = "Company name is required for onboarding.";
    }

    if (s === 3) {

      // business metrics validation

      if (!form.inventorySize || Number(form.inventorySize) < 0)

        e.inventorySize = "Please enter a valid inventory size (0 or greater).";

      if (!form.branches || Number(form.branches) < 0)

        e.branches = "Please enter a valid number of branches (0 or greater).";

      if (!form.employees || Number(form.employees) < 0)

        e.employees = "Please enter a valid number of employees (0 or greater).";

      if (!form.transactionsLast30d || Number(form.transactionsLast30d) < 0)

        e.transactionsLast30d = "Please enter a valid transaction count (0 or greater).";

    }

    return Object.keys(e).length ? e : null;

  };



  const classifyBusiness = ({

    inventorySize,

    transactionsLast30d,

    branches,

    employees,

  }) => {

    // normalize values

    const inv = Number(inventorySize || 0);

    const tx = Number(transactionsLast30d || 0);

    const br = Number(branches || 0);

    const emp = Number(employees || 0);



    if (emp > 100 || br > 10 || tx > 10000 || inv > 50000) return "large";

    if (emp > 10 || br > 2 || tx > 1000 || inv > 10000) return "medium";

    return "small";

  };



  // Map raw numeric values to ordinal 0-3 for ML classifier

  const toOrdinal = (val, breaks) => {

    const n = Number(val || 0);

    for (let i = 0; i < breaks.length; i++) {

      if (n <= breaks[i]) return i;

    }

    return breaks.length;

  };



  const computeMLFeatures = (f) => {

    // If we have a schema from the server, use its breakpoints; otherwise use local defaults

    const breaks = {

      scale: [10, 50, 100],

      volume: [100, 1000, 10000],

      complexity: [1000, 5000, 15000],

    };

    if (classifierSchema && classifierSchema.features) {

      const s = classifierSchema.features;

      if (s.scale && s.scale.breaks) breaks.scale = s.scale.breaks;

      if (s.volume && s.volume.breaks) breaks.volume = s.volume.breaks;

      if (s.complexity && s.complexity.breaks)

        breaks.complexity = s.complexity.breaks;

    }



    // transactionsLast30d in the form may be entered as INR (monthly revenue).

    // Convert revenue -> estimated transactions by dividing by average ticket value.

    const rawSales =

      Number((f.transactionsLast30d || "").toString().replace(/[,\s]/g, "")) ||

      0;

    const avgTicket = Number(f.avgTicket || 500) || 500; // default ₹500 if not provided

    const estTransactions = Math.max(

      0,

      Math.round(rawSales / Math.max(1, avgTicket)),

    );



    return {

      scale: toOrdinal(f.employees, breaks.scale), // headcount

      volume: toOrdinal(estTransactions, breaks.volume),

      complexity: toOrdinal(f.inventorySize, breaks.complexity),

      locations: Number(f.branches || 0),

      bizType: f.businessType || "other",

    };

  };



  const fetchMLClassification = async (features) => {

    try {

      const res = await fetch("http://127.0.0.1:8000/api/v1/classify", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(features),

      });

      if (!res.ok) throw new Error("ML classify failed");

      return await res.json();

    } catch (err) {

      return null;

    }

  };



  const goNext = () => {
    const v = validateStep(step);
    setErrors(v);

    if (v || (step === 1 && emailAvailable === false)) {
      if (step === 1 && emailAvailable === false) {
        showEmailToast("error", "Email already in use", "This email is registered. Please use a different address.");
      } else if (v && v.email) {
        showEmailToast("error", "Email needs attention", compactToastMessage(v.email));
      }
      return;
    }

    if (step === 3) {

      // compute ML features and try ML classification, fallback to heuristic

      const features = computeMLFeatures(form);

      fetchMLClassification(features).then((ml) => {

        if (ml && ml.classification) {

          setClassification(ml.classification);

          // attach ml metadata to form for submit

          setForm((prev) => ({

            ...prev,

            mlConfidence: ml.confidence,

            signalQuality: ml.signalQuality,

          }));

        } else {

          const cls = classifyBusiness(form);

          setClassification(cls);

        }

      });

    }

    setErrors(null);

    setStep((s) => Math.min(4, s + 1));

  };


  // fetch classifier schema from backend so frontend can adapt when ML inputs change

  React.useEffect(() => {

    let mounted = true;

    (async () => {

      try {

        const res = await fetch("http://127.0.0.1:8000/api/v1/schema");

        if (!res.ok) return;

        const json = await res.json();

        if (mounted) setClassifierSchema(json);

      } catch (e) {

        // ignore - schema is optional

      }

    })();

    return () => {

      mounted = false;

    };

  }, []);



  const goBack = () => {

    if (step === 1) {

      setActiveTab("home");

      return;

    }

    setErrors(null);

    setStep((s) => Math.max(1, s - 1));

  };



  const handleSubmit = async (ev) => {

    ev.preventDefault();

    // final submit: create user (backend expects businessName currently)

    setLoading(true);

    setDbCheck(null);

    try {

      // ensure classification available

      const cls = classification || classifyBusiness(form);

      setClassification(cls);

      const payload = {

        email: form.email,

        firstName: form.firstName,

        lastName: form.lastName,

        businessName: form.company,

        password: form.password,

        inventorySize: Number(form.inventorySize || 0),

        transactionsLast30d: Number(form.transactionsLast30d || 0),

        branches: Number(form.branches || 0),

        employees: Number(form.employees || 0),

        businessType: form.businessType || null,

        classification: cls,

        role: "OWNER",

      };

      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/signup", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(payload),

      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {

        // backend may return string or structured detail

        if (data && typeof data.detail === "object") {

          const d = data.detail;

          // map field-level server errors to form fields when possible

          if (d.field) {

            setErrors({ [d.field]: d.message });

            if (d.field === "email") {
              showEmailToast("error", "Email rejected", compactToastMessage(d.message || "Email validation error"));
            }

            throw new Error("Validation error");

          }

          setErrors({ submit: d.message || JSON.stringify(d) });

          throw new Error(d.message || "Signup failed");

        }

        // else detail is a string

        if (data && data.detail) {

          // common case: email already registered

          if (String(data.detail).toLowerCase().includes("email")) {

            setErrors({ email: data.detail });

            showEmailToast("error", "Email already in use", "Use a different address to continue.");

            throw new Error("Email already in use");

          }

          setErrors({ submit: data.detail });

          throw new Error(data.detail);

        }

        throw new Error("Signup failed");

      }



      if (data?.accessToken && data?.user) {

        localStorage.setItem("inventra_token", data.accessToken);

        localStorage.setItem("inventra_user", JSON.stringify(data.user));

        // Always redirect new users to branch setup wizard first

        setActiveTab("branch-setup");

      }

      setSuccess(true);

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SIGNUP_DRAFT_KEY);
      }

    } catch (err) {
      const rawMsg = err.message || "";
      let errMsg = rawMsg;
      let errTitle = "Launch Failed";

      if (rawMsg === "Failed to fetch") {
        errTitle = "Connection Failed";
        errMsg = "Unable to reach the server. Please verify your connection or check if the backend service is running.";
        showEmailToast("error", errTitle, errMsg);
      } else {
        if (!errors) setErrors({ submit: rawMsg });
        if (rawMsg.toLowerCase().includes("email")) {
          showEmailToast("error", "Email verification failed", compactToastMessage(rawMsg));
        } else if (rawMsg !== "Validation error") {
          showEmailToast("error", errTitle, errMsg);
        }
      }
    } finally {

      setLoading(false);

    }

  };



  const checkDatabaseStatus = async () => {

    setLoading(true);

    try {

      const res = await fetch(

        `http://127.0.0.1:8000/api/v1/auth/debug/signup-status?email=${encodeURIComponent(form.email)}`,

      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok)

        throw new Error(

          json.detail?.message ||

            json.detail ||

            "Unable to verify database record.",

        );

      setDbCheck(json);

    } catch (err) {
      const rawMsg = err.message || "";
      let errMsg = rawMsg;
      if (rawMsg === "Failed to fetch") {
        errMsg = "Unable to reach the server. Please verify your connection or check if the backend service is running.";
        showEmailToast("error", "Connection Failed", errMsg);
      } else if (rawMsg.toLowerCase().includes("email")) {
        showEmailToast("error", "Could not verify email", compactToastMessage(rawMsg || "Unable to verify record."));
      }
      setDbCheck({ error: errMsg });
    } finally {

      setLoading(false);

    }

  };

  return (
    <div className="flex flex-col lg:flex-row bg-[#F8FAFC] font-sans lg:h-screen">
      {/* Left panel: Brand highlight and vision */}
      {isLargeScreen && (
        <div className="lg:w-[48%] 2xl:w-1/2 bg-[#0F172A] text-white p-8 lg:pt-6 lg:px-12 xl:pt-8 xl:px-16 2xl:pt-10 2xl:px-20 flex flex-col justify-between relative overflow-hidden lg:h-full">

          {/* Neon blurred background nodes for premium ambient glow */}
          <div className="absolute w-100 h-100 bg-[#0EA5E9]/10 blur-[100px] rounded-full -top-25 -left-25 pointer-events-none"></div>

          <div className="absolute w-87.5 h-87.5 bg-slate-800/20 blur-[80px] rounded-full -bottom-25 -right-25 pointer-events-none"></div>

          {/* Brand header */}
          <div className="relative z-10 flex items-center gap-2">
            <span className="text-[16px] font-black tracking-tight text-white font-sans uppercase">
              Inventra
            </span>

            <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] shadow-[0_0_8px_#0ea5e9]"></span>
          </div>

          {/* Vision and value propositions */}
          <div className="relative z-10 max-w-md xl:max-w-lg my-4 md:my-auto flex flex-col gap-6 text-left">
            <div>
              <span className="text-[#0EA5E9] text-xs font-black uppercase tracking-widest block mb-3">
                Enterprise Intelligence
              </span>

              <h1 className="text-3xl md:text-4xl lg:text-[2.7rem] xl:text-5xl 2xl:text-5xl font-black leading-[1.06] text-white tracking-tight mb-4">
                The future of retail is{" "}
                <span className="text-[#0EA5E9]">predictive.</span>
              </h1>

              <p className="text-[14px] md:text-[15.5px] text-slate-400 leading-relaxed font-medium">
                Join the intelligence network. Transform your inventory
                management, sales forecasting, and branch operations with
                adaptive AI designed for scale.

              </p>

            </div>



            <div className="flex flex-col gap-3.5 mt-1.5">

              {/* Feature card 1 */}

              <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 xl:p-5 hover:border-[#0EA5E9]/30 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(14,165,233,0.03)] cursor-default flex items-start gap-3.5">

                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 text-[#0EA5E9]">

                  <svg

                    className="w-4 h-4"

                    fill="none"

                    stroke="currentColor"

                    strokeWidth="2.5"

                    viewBox="0 0 24 24"

                  >

                    <path

                      strokeLinecap="round"

                      strokeLinejoin="round"

                      d="M7.5 14.25 5.106 11.856a2.25 2.25 0 1 0-3.182 3.182l3.01 3.01m13.177-11.515 2.394 2.394a2.25 2.25 0 1 1-3.182 3.182l-3.01-3.01m0 0L7.5 14.25m7.5-7.5 3.01 3.01M10.5 18v-4.5h4.5M12 21a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z"

                    />

                  </svg>

                </div>

                <div className="flex flex-col gap-1 text-left">

                  <span className="font-bold text-[13.5px] text-white">

                    Stock Intelligence

                  </span>

                  <span className="text-[11.5px] text-slate-400 font-semibold leading-relaxed">

                    Real-time demand forecasting that reduces manual stock

                    audits and out-of-stocks.

                  </span>

                </div>

              </div>



              {/* Feature card 2 */}

              <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 xl:p-5 hover:border-[#0EA5E9]/30 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(14,165,233,0.03)] cursor-default flex items-start gap-3.5">

                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 text-[#0EA5E9]">

                  <svg

                    className="w-4 h-4"

                    fill="none"

                    stroke="currentColor"

                    strokeWidth="2.5"

                    viewBox="0 0 24 24"

                  >

                    <path

                      strokeLinecap="round"

                      strokeLinejoin="round"

                      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"

                    />

                  </svg>

                </div>

                <div className="flex flex-col gap-1 text-left">

                  <span className="font-bold text-[13.5px] text-white">

                    Customer Trends

                  </span>

                  <span className="text-[11.5px] text-slate-400 font-semibold leading-relaxed">

                    Identify high-value purchasing segments and forecast

                    transaction vectors.

                  </span>

                </div>

              </div>

            </div>

          </div>



          {/* Footer info */}

          <div className="relative z-10 text-[11px] text-slate-500 font-bold uppercase tracking-wider text-left">

            © 2026 Inventra Technology Inc.

          </div>

        </div>

      )}



      {/* Right panel: Premium Signup wizard */}

      <div className="w-full lg:w-[52%] p-4 sm:p-8 md:p-12 lg:pt-4 lg:px-10 xl:pt-6 xl:px-12 2xl:pt-8 2xl:px-16 pb-6 sm:pb-8 md:pb-10 lg:pb-12 flex items-start justify-start lg:h-full min-h-0 overflow-auto lg:overflow-visible">

        <div className="w-full max-w-sm sm:max-w-md lg:max-w-190 xl:max-w-210 2xl:max-w-230 origin-top">

          {/* Header block with elegant back button */}

          <div className="flex justify-between items-center mb-3 sm:mb-5">

            <div className="flex items-center gap-3">

              <button

                onClick={() => setActiveTab("home")}

                aria-label="Back"

                className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-[#0F172A] hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center cursor-pointer"

              >

                <svg

                  xmlns="http://www.w3.org/2000/svg"

                  className="h-4 w-4 stroke-[2.5]"

                  fill="none"

                  viewBox="0 0 24 24"

                  stroke="currentColor"

                >

                  <path

                    strokeLinecap="round"

                    strokeLinejoin="round"

                    d="M15 19l-7-7 7-7"

                  />

                </svg>

              </button>

              <div>

                <span className="text-[11px] font-black uppercase tracking-widest text-[#0EA5E9] block leading-none mb-0.5">

                  Platform Signup

                </span>

                <span className="text-[14px] font-black text-slate-900 block leading-none font-sans">

                  Inventra

                </span>

              </div>

            </div>

          </div>



          {/* Stepper progress indicator */}

          {!success && (

            <div className="mb-5 sm:mb-6 text-left">

              <div className="flex justify-between items-center mb-2.5">

                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">

                  Step {step} of 4

                </span>

                <span className="text-[12.5px] font-bold text-[#0EA5E9]">

                  {step === 1

                    ? "Personal Profile"

                    : step === 2

                      ? "Business Info"

                      : step === 3

                        ? "Business Metrics"

                        : "Confirm Registration"}

                </span>

              </div>

              <div className="h-1.5 w-full bg-slate-200/60 rounded-full overflow-hidden flex gap-0.5">

                <div

                  className={`h-full flex-1 transition-all duration-500 rounded-l-full ${step >= 1 ? "bg-[#0EA5E9]" : "bg-slate-200/60"}`}

                ></div>

                <div

                  className={`h-full flex-1 transition-all duration-500 ${step >= 2 ? "bg-[#0EA5E9]" : "bg-slate-200/60"}`}

                ></div>

                <div

                  className={`h-full flex-1 transition-all duration-500 ${step >= 3 ? "bg-[#0EA5E9]" : "bg-slate-200/60"}`}

                ></div>

                <div

                  className={`h-full flex-1 transition-all duration-500 rounded-r-full ${step >= 4 ? "bg-[#0EA5E9]" : "bg-slate-200/60"}`}

                ></div>

              </div>

            </div>

          )}



          {/* Success state box */}

          {success ? (

            <div className="p-7 bg-white border border-emerald-100 rounded-2xl text-center shadow-[0_20px_50px_rgba(16,185,129,0.03)] flex flex-col items-center gap-5">

              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]">

                <svg

                  className="w-8 h-8 stroke-[2.5]"

                  fill="none"

                  stroke="currentColor"

                  viewBox="0 0 24 24"

                >

                  <path

                    strokeLinecap="round"

                    strokeLinejoin="round"

                    d="m4.5 12.75 6 6 9-13.5"

                  />

                </svg>

              </div>

              <div className="flex flex-col gap-2">

                <h3 className="text-2xl font-black text-slate-900 leading-tight">

                  Account Created Successfully!

                </h3>

                <p className="text-[14px] text-slate-500 leading-relaxed font-medium">

                  We've saved your account and business record. You can verify

                  it in the database below.

                </p>

              </div>

              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2 text-[13px] font-medium text-slate-600">

                <div>

                  <span className="font-bold text-slate-900">Email:</span>{" "}

                  {form.email}

                </div>

                <div>

                  <span className="font-bold text-slate-900">Business:</span>{" "}

                  {form.company}

                </div>

                <div>

                  <span className="font-bold text-slate-900">Tier:</span>{" "}

                  {getTierDisplayName(classification || "small")}

                </div>

              </div>

              <button

                type="button"

                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl transition-all duration-200 active:scale-98 cursor-pointer shadow-lg shadow-emerald-900/10 text-[12px] sm:text-[13.5px]"

                onClick={checkDatabaseStatus}

                disabled={loading}

              >

                {loading ? "Checking database…" : "Check database status"}

              </button>

              {dbCheck && !dbCheck.error && (

                <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left space-y-2 text-[13px] font-medium text-slate-600">

                  <div>

                    <span className="font-bold text-slate-900">

                      User record:

                    </span>{" "}

                    {dbCheck.userExists ? "Found" : "Missing"}

                  </div>

                  <div>

                    <span className="font-bold text-slate-900">

                      Business record:

                    </span>{" "}

                    {dbCheck.businessExists ? "Found" : "Missing"}

                  </div>

                  {dbCheck.classification && (

                    <div>

                      <span className="font-bold text-slate-900">

                        Saved tier:

                      </span>{" "}

                      {getTierDisplayName(dbCheck.classification)}

                    </div>

                  )}

                </div>

              )}

              {dbCheck && dbCheck.error && (

                <div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left text-[13px] font-medium text-rose-700">

                  {dbCheck.error}

                </div>

              )}

              <button

                className="w-full bg-[#0F172A] hover:bg-slate-800 text-white font-bold py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl transition-all duration-200 active:scale-98 cursor-pointer shadow-lg shadow-slate-900/10 text-[12px] sm:text-[13.5px]"

                onClick={() => setActiveTab("home")}

              >

                Return to Landing Page

              </button>

            </div>

          ) : (

            <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 md:p-6 lg:p-6 xl:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.02)] w-full flex flex-col gap-3 text-left">

              {step === 1 && (

                <>

                  <div className="flex flex-col gap-1 mb-2">

                    <h2 className="text-xl sm:text-[1.7rem] lg:text-[1.75rem] xl:text-[1.8rem] 2xl:text-[1.8rem] font-black text-slate-950 tracking-tight leading-tight">

                      Setup your account

                    </h2>

                    <p className="text-xs sm:text-sm md:text-[14px] lg:text-sm text-slate-600 font-medium leading-relaxed">

                      Let's start with your contact information to setup your

                      workspace.

                    </p>

                  </div>



                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <div className="flex flex-col gap-1">

                      <label className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500">

                        First Name

                      </label>

                      <input

                        aria-invalid={!!(errors && errors.firstName)}

                        ref={firstNameRef}

                        value={form.firstName}

                        onChange={(e) =>

                          handleChange("firstName", e.target.value)

                        }

                        placeholder="John"

                        className={inputClass}

                      />

                      {errors && errors.firstName && (

                        <p className="text-red-500 text-[11px] font-bold mt-0 px-1 leading-tight">

                          {errors.firstName}

                        </p>

                      )}

                    </div>

                    <div className="flex flex-col gap-1">

                      <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">

                        Last Name

                      </label>

                      <input

                        aria-invalid={!!(errors && errors.lastName)}

                        ref={lastNameRef}

                        value={form.lastName}

                        onChange={(e) =>

                          handleChange("lastName", e.target.value)

                        }

                        placeholder="Doe"

                        className={inputClass}

                      />

                      {errors && errors.lastName && (

                        <p className="text-red-500 text-[11px] font-bold mt-0 px-1 leading-tight">

                          {errors.lastName}

                        </p>

                      )}

                    </div>

                  </div>



                  <div className="flex flex-col gap-1">

                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">

                      Business Email

                    </label>

                    <input

                      aria-invalid={!!(errors && errors.email)}

                      ref={emailRef}

                      value={form.email}

                      onChange={(e) => handleChange("email", e.target.value)}

                      placeholder="you@yourbusiness.com"

                      className={inputClass}

                    />

                    <p className="text-[11px] text-slate-500 mt-1">

                      We'll send setup and verification details to this address.

                    </p>

                    {emailChecking && (

                      <p className="text-[11px] text-slate-500 mt-0 px-1 leading-tight">

                        Checking email availability...

                      </p>

                    )}

                    {emailAvailable === true && !emailChecking && form.email && !errors?.email && (
                      <p className="text-emerald-600 text-[11px] font-bold mt-0 px-1 leading-tight">
                        ✓ Email is available
                      </p>
                    )}

                    {errors && errors.email && (
                      <p className="text-red-500 text-[11px] font-bold mt-0 px-1 leading-tight">
                        ✗ {errors.email}
                      </p>
                    )}

                  </div>



                  <div className="flex flex-col gap-1 relative">

                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">

                      Create a Password

                    </label>

                    <input

                      aria-invalid={!!(errors && errors.password)}

                      type="password"

                      value={form.password}

                      onChange={(e) => handleChange("password", e.target.value)}

                      placeholder="At least 8 characters"

                      className={inputClass}

                    />

                    {errors && errors.password && (

                      <p className="text-red-500 text-[11px] font-bold mt-0 px-1 leading-tight">

                        {errors.password}

                      </p>

                    )}

                    <span

                      className={`text-[10px] font-bold block mt-1 px-1 leading-normal ${passwordIsStrong ? "text-emerald-600" : "text-red-500"}`}

                    >

                      {passwordIsStrong

                        ? "Good — secure enough to continue."

                        : "Use at least 8 characters for security."}

                    </span>

                  </div>



                  <div className="flex flex-col gap-1.5 mt-1.5 border-t border-slate-50 pt-3.5">

                    <div className="flex items-start gap-3">

                      <input

                        id="agree"

                        type="checkbox"

                        checked={form.agree}

                        onChange={(e) =>

                          handleChange("agree", e.target.checked)

                        }

                        className="h-4 w-4 mt-0.5 text-[#0EA5E9] focus:ring-[#0EA5E9] border-slate-300 rounded cursor-pointer"

                      />

                      <label

                        htmlFor="agree"

                        className="text-[12.5px] text-slate-650 font-bold leading-normal cursor-pointer select-none"

                      >

                        I accept the{" "}

                        <span className="text-[#0EA5E9] hover:underline">

                          Terms of Service

                        </span>{" "}

                        and acknowledge the{" "}

                        <span className="text-[#0EA5E9] hover:underline">

                          Privacy Policy

                        </span>

                        .

                      </label>

                    </div>

                    {errors && errors.agree && (

                      <p className="text-red-500 text-[11px] font-bold mt-0.5 px-1 leading-tight">

                        {errors.agree}

                      </p>

                    )}

                  </div>

                </>

              )}



              {step === 2 && (

                <>

                  <div className="flex flex-col gap-1 mb-2">

                    <h2 className="text-xl sm:text-[1.7rem] lg:text-[1.75rem] xl:text-[1.8rem] 2xl:text-[1.8rem] font-black text-slate-950 tracking-tight leading-tight">

                      About your business

                    </h2>

                    <p className="text-xs sm:text-sm md:text-[14px] lg:text-sm text-slate-600 font-medium leading-relaxed">

                      Tell us the basics so we can set up your account.

                    </p>

                  </div>



                  <div className="flex flex-col gap-1">

                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">

                      Business or Store Name

                    </label>

                    <input

                      aria-invalid={!!(errors && errors.company)}

                      ref={companyRef}

                      value={form.company}

                      onChange={(e) => handleChange("company", e.target.value)}

                      placeholder="Acme Retail Store"

                      className={inputClass}

                    />

                    <p className="text-[11px] text-slate-500 mt-1">

                      Enter the name customers know your business by.

                    </p>

                    {errors && errors.company && (

                      <p className="text-red-500 text-[11px] font-bold mt-0 px-1 leading-tight">

                        {errors.company}

                      </p>

                    )}

                  </div>

                </>

              )}



              {step === 3 && (

                <>

                  <div className="flex flex-col gap-1 mb-2">

                    <h2 className="text-xl sm:text-[1.7rem] lg:text-[1.75rem] xl:text-[1.8rem] 2xl:text-[1.8rem] font-black text-slate-950 tracking-tight leading-tight">

                      Tell us about your business

                    </h2>

                    <p className="text-xs sm:text-sm md:text-[14px] lg:text-sm text-slate-600 font-medium leading-relaxed">

                      Just a few simple details so we can set things up for you.

                    </p>

                  </div>



                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <div className="flex flex-col gap-1">

                      <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">

                        How many products do you stock?

                      </label>

                      <input

                        ref={inventoryRef}

                        value={form.inventorySize}

                        onChange={(e) =>

                          handleChange("inventorySize", e.target.value)

                        }

                        placeholder="e.g., 5000"

                        className={inputClass}

                      />

                      <p className="text-[11px] text-slate-500 mt-1">

                        Roughly how many products or items do you sell?

                      </p>

                    </div>

                    <div className="flex flex-col gap-1">

                      <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">

                        About how many staff do you have?

                      </label>

                      <input

                        value={form.employees}

                        onChange={(e) =>

                          handleChange("employees", e.target.value)

                        }

                        placeholder="e.g., 50"

                        className={inputClass}

                      />

                      <p className="text-[11px] text-slate-500 mt-1">

                        Rough total across all locations is okay.

                      </p>

                    </div>

                  </div>



                  <div className="grid grid-cols-2 gap-3">

                    <div className="flex flex-col gap-1 h-full">

                      <label className="min-h-10 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 leading-tight">

                        How many locations do you have?

                      </label>

                      <input

                        value={form.branches}

                        onChange={(e) =>

                          handleChange("branches", e.target.value)

                        }

                        placeholder="e.g., 3"

                        className={inputClass}

                      />

                      <p className="text-[11px] text-slate-500 mt-1">

                        Just the total number of places you sell from.

                      </p>

                    </div>

                    <div className="flex flex-col gap-1 h-full">

                      <label className="min-h-10 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 leading-tight">

                        Monthly sales

                      </label>

                      <input

                        value={form.transactionsLast30d}

                        onChange={(e) =>

                          handleChange("transactionsLast30d", e.target.value)

                        }

                        placeholder="e.g., 5,000 (₹)"

                        className={inputClass}

                      />

                      <p className="text-[11px] text-slate-500 mt-1">

                        Enter monthly sales in INR.

                      </p>

                    </div>

                  </div>



                  <div className="flex flex-col gap-1">

                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">

                      What kind of business is this? (optional)

                    </label>

                    <BusinessTypeSelect

                      value={form.businessType}

                      onChange={(v) => handleChange("businessType", v)}

                      className=""

                    />

                    <p className="text-[11px] text-slate-500 mt-1">

                      Pick the closest match. It helps us set things up better.

                    </p>

                  </div>

                </>

              )}



              {/* Submit / General Validation errors */}

              {errors && errors.submit && step < 4 && (

                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2.5 text-rose-600 text-[11px] font-bold leading-normal">

                  <svg

                    className="w-4 h-4 text-rose-500 stroke-[2.5] shrink-0"

                    fill="none"

                    stroke="currentColor"

                    viewBox="0 0 24 24"

                  >

                    <path

                      strokeLinecap="round"

                      strokeLinejoin="round"

                      d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"

                    />

                  </svg>

                  <span>{errors.submit}</span>

                </div>

              )}



              {/* Stepper Nav Row */}

              {step < 4 && (

                <div className="sticky bottom-0 z-20 -mx-4 sm:mx-0 flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 border-t border-slate-50 pt-3 sm:pt-4 pb-3 sm:pb-0 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80 px-4 sm:px-0">

                  {step > 1 && (

                    <button

                      type="button"

                      onClick={goBack}

                      className="px-4 py-2.5 sm:py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[12px] sm:text-[13px] font-bold rounded-xl transition-all duration-200 active:scale-97 cursor-pointer"

                    >

                      Back

                    </button>

                  )}

                  <button

                    type="button"

                    onClick={goNext}

                    className="ml-auto px-5 sm:px-7 py-2.5 sm:py-3 bg-[#0F172A] hover:bg-slate-800 text-white text-[12px] sm:text-[13px] font-bold rounded-xl transition-all duration-200 active:scale-97 cursor-pointer shadow-md shadow-slate-900/5"

                  >

                    Continue

                  </button>

                </div>

              )}



              {step === 4 && (

                <div className="flex flex-col gap-3">

                  <ConfirmRegistration

                    form={form}

                    classification={classification}

                  />



                  {errors && errors.submit && (

                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2.5 text-rose-600 text-[11px] font-bold leading-normal">

                      <svg

                        className="w-4 h-4 text-rose-500 stroke-[2.5] shrink-0"

                        fill="none"

                        stroke="currentColor"

                        viewBox="0 0 24 24"

                      >

                        <path

                          strokeLinecap="round"

                          strokeLinejoin="round"

                          d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"

                        />

                      </svg>

                      <span>{errors.submit}</span>

                    </div>

                  )}



                  <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 border-t border-slate-50 pt-3 sm:pt-4">

                    <button

                      type="button"

                      onClick={goBack}

                      className="px-4 py-2.5 sm:py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[12px] sm:text-[13px] font-bold rounded-xl transition-all duration-200 active:scale-97 cursor-pointer"

                    >

                      Back

                    </button>

                    <button

                      type="button"

                      onClick={() => handleSubmit({ preventDefault: () => {} })}

                      disabled={loading}

                      className="ml-auto px-5 sm:px-7 py-2.5 sm:py-3 bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-300 text-white text-[12px] sm:text-[13px] font-bold rounded-xl transition-all duration-200 active:scale-97 cursor-pointer shadow-md shadow-slate-900/5 flex items-center gap-2"

                    >

                      <span>

                        {loading ? "Creating workspace..." : "Confirm & Launch"}

                      </span>

                      {!loading && <span className="text-[14px]">→</span>}

                    </button>

                  </div>

                </div>

              )}

            </div>

          )}

        </div>

      </div>

    </div>

  );

}

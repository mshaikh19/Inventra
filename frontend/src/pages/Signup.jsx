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
    <div className="flex w-full items-start gap-2.5 px-3.5 py-2.5 sm:items-center sm:gap-3 sm:px-4 sm:py-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] border text-xs font-black ${isSuccess
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
      >
        {isSuccess ? "✓" : "!"}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-heading text-[0.9rem] font-extrabold tracking-[-0.03em] sm:text-[0.96rem] ${isSuccess ? "text-emerald-900" : "text-rose-700"}`}>
          {title}
        </div>
        <div className={`mt-0.5 w-full max-w-none text-[0.86rem] font-medium leading-[1.1rem] break-words sm:text-[0.9rem] sm:leading-[1.2rem] ${isSuccess ? "text-emerald-900/75" : "text-rose-700/90"}`}>
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
    const rawDraft = window.sessionStorage.getItem(SIGNUP_DRAFT_KEY);
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
  const [showPassword, setShowPassword] = React.useState(false);
  const [googleAccessToken, setGoogleAccessToken] = React.useState(null);
  const [isGoogleSignup, setIsGoogleSignup] = React.useState(false);
  const [googleProfile, setGoogleProfile] = React.useState(null);

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
  "w-full border border-slate-200/90 bg-slate-50/50 placeholder:text-slate-400 text-slate-900 px-3 py-1 sm:py-1.5 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-[#0EA5E9]/10 focus:border-[#0EA5E9] focus:bg-white transition-all duration-300 font-sans text-[11px] sm:text-[12.5px] font-semibold"; // disable page scroll while signup is open on large screens (full-height modal)

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

          setEmailAvailable(!data.exists);

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

        // Check email availability if format is valid

        else if (emailAvailable === false)

          e.email = "This email is already registered. Please use a different email or sign in.";

      }

      if (!isGoogleSignup) {
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
      }

      if (!form.agree)

        e.agree = "You must accept the Terms of Service and Privacy Policy.";

    }

    if (s === 2) {

      // business step validation

      if (!form.company) e.company = "Company name is required for onboarding.";

      if (!form.businessType) e.businessType = "Business type is required.";

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

    if (v) {

      if (v.email) showEmailToast("error", "Email needs attention", compactToastMessage(v.email));

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

      if (isGoogleSignup && googleAccessToken) {
        const payload = {
          access_token: googleAccessToken,
          businessName: form.company,
          businessType: form.businessType || null,
          inventorySize: Number(form.inventorySize || 0),
          transactionsLast30d: Number(form.transactionsLast30d || 0),
          branches: Number(form.branches || 0),
          employees: Number(form.employees || 0),
          classification: cls,
        };
        const res = await fetch("http://127.0.0.1:8000/api/v1/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.detail || "Google Registration failed.");
        }
        if (data?.accessToken && data?.user) {
          localStorage.setItem("inventra_token", data.accessToken);
          localStorage.setItem("inventra_user", JSON.stringify(data.user));
          setActiveTab("branch-setup");
        }
        setSuccess(true);
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
        }
        return;
      }

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

        window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);

      }

    } catch (err) {

      if (!errors) setErrors({ submit: err.message });

      if (err?.message && err.message.toLowerCase().includes("email")) {
        showEmailToast("error", "Email verification failed", compactToastMessage(err.message));
      }

    } finally {

      setLoading(false);

    }

  };



  const handleGoogleSignUpClick = () => {
    if (window.google) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: "335551120481-532ku6717oec3lk37j48hc2koo8jfq3f.apps.googleusercontent.com",
        scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
        callback: async (response) => {
          if (response && response.access_token) {
            setLoading(true);
            setErrors(null);
            try {
              // 1. Fetch Google user profile
              const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${response.access_token}` },
              });
              if (!userInfoRes.ok) throw new Error("Failed to fetch Google profile info.");
              const profile = await userInfoRes.json();

              // 2. Check if user already exists
              const checkEmailRes = await fetch(`http://127.0.0.1:8000/api/v1/auth/check-email?email=${encodeURIComponent(profile.email)}`);
              if (!checkEmailRes.ok) throw new Error("Failed to check email availability.");
              const checkEmailData = await checkEmailRes.json();

              if (checkEmailData.exists) {
                // Exists: complete login instantly
                toast.info("Account already exists. Logging you in...", { autoClose: 2000 });
                const loginRes = await fetch("http://127.0.0.1:8000/api/v1/auth/google", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ access_token: response.access_token }),
                });
                const loginData = await loginRes.json();
                if (!loginRes.ok) throw new Error(loginData.detail || "Google Login failed.");

                if (loginData.accessToken && loginData.user) {
                  localStorage.setItem("inventra_token", loginData.accessToken);
                  localStorage.setItem("inventra_user", JSON.stringify(loginData.user));
                  setActiveTab("branch-setup");
                  setSuccess(true);
                }
              } else {
                // Doesn't exist: prefill form details and proceed with wizard
                setForm((prev) => ({
                  ...prev,
                  firstName: profile.given_name || "",
                  lastName: profile.family_name || "",
                  email: profile.email || "",
                  password: "google_authenticated_user_placeholder_pw",
                  agree: true, // Auto-agree on Google Sign-Up to enable Continue immediately
                }));
                setGoogleAccessToken(response.access_token);
                setGoogleProfile(profile);
                setIsGoogleSignup(true);
                setEmailAvailable(true);
                setErrors({}); // Clear any previous validation errors
                toast.success("Google account connected. Please enter your business details to complete registration.");
              }
            } catch (err) {
              setErrors({ submit: err.message });
              toast.error(`Google authentication error: ${err.message}`);
            } finally {
              setLoading(false);
            }
          }
        },
      });
      client.requestAccessToken();
    }
  };

  const handleDisconnectGoogle = () => {
    setIsGoogleSignup(false);
    setGoogleAccessToken(null);
    setGoogleProfile(null);
    setForm((prev) => ({
      ...prev,
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      agree: false,
    }));
    setEmailAvailable(null);
    setErrors({});
  };

  const handleGoogleSignup = async (accessToken) => {

    setLoading(true);

    setErrors(null);

    setDbCheck(null);



    try {

      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/google", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ access_token: accessToken }),

      });



      const data = await res.json().catch(() => ({}));



      if (!res.ok) {

        throw new Error(data?.detail || "Google Sign-Up failed.");

      }



      if (data?.accessToken && data?.user) {

        localStorage.setItem("inventra_token", data.accessToken);

        localStorage.setItem("inventra_user", JSON.stringify(data.user));

        setActiveTab("branch-setup");

      }



      setSuccess(true);

      if (typeof window !== "undefined") {

        window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);

      }

    } catch (err) {

      setErrors({ submit: err.message });

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

      setDbCheck({ error: err.message });

      if ((err.message || "").toLowerCase().includes("email")) {
        showEmailToast("error", "Could not verify email", compactToastMessage(err.message || "Unable to verify record."));
      }

    } finally {

      setLoading(false);

    }

  };

  return (
    <div className="flex flex-col lg:flex-row bg-[#F8FAFC] font-sans lg:h-screen">
      {/* Left panel: Brand highlight and vision */}
      <div className="hidden lg:flex lg:w-[48%] 2xl:w-1/2 bg-[#0F172A] text-white p-8 lg:pt-6 lg:px-12 xl:pt-8 xl:px-16 2xl:pt-10 2xl:px-20 flex-col justify-between relative overflow-hidden lg:h-full">

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



      {/* Right panel: Premium Signup wizard */}

      <div className="w-full lg:w-[52%] p-4 sm:p-8 md:p-12 lg:pt-4 lg:px-10 xl:pt-6 xl:px-12 2xl:pt-8 2xl:px-16 pb-24 sm:pb-28 md:pb-32 lg:pb-12 flex items-start lg:items-start justify-center lg:justify-start lg:h-full min-h-0 overflow-visible lg:overflow-y-auto">

        <div className="w-full max-w-sm sm:max-w-md lg:max-w-[480px] xl:max-w-[520px] 2xl:max-w-[560px] origin-top">

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

            <div className="bg-white border border-slate-100 rounded-2xl p-3 sm:p-3.5 md:p-4 lg:p-4 xl:p-4.5 shadow-[0_20px_50px_rgba(0,0,0,0.02)] w-full flex flex-col gap-2 text-left">

              {step === 1 && (

                <>

                  <div className="flex flex-col gap-0.5 mb-1">

                    <h2 className="text-[16px] sm:text-[18px] lg:text-[20px] font-black text-slate-950 tracking-tight leading-tight">

                      Setup your account

                    </h2>

                    <p className="text-[10.5px] sm:text-[11px] text-slate-500 leading-normal">

                      Let's start with your contact details to set up your retail intelligence workspace.

                    </p>

                  </div>



                  {!isGoogleSignup ? (
                    <>
                      <div className="w-full flex justify-center mt-1">

                        <button

                          type="button"

                          onClick={handleGoogleSignUpClick}

                          className="w-full flex items-center h-[40px] rounded-full border border-black bg-[#1f1f1f] text-white hover:bg-slate-850 transition-all duration-200 active:scale-[0.98] shadow-sm cursor-pointer overflow-hidden font-sans text-[14px] font-bold"

                        >

                          <div className="flex items-center justify-center bg-white h-full w-[48px] shrink-0 border-r border-black">

                            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">

                              <path

                                fill="#4285F4"

                                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.69c-.29 1.5-.1.13-1.14 2.19v2.51h1.8c1.05-1.0 1.8-2.4 1.8-4.08c0-1.85-.35-2.45-1.15-2.45z"

                              />

                              <path

                                fill="#34A853"

                                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-1.8-2.51c-.8.5-1.8.8-3.13.8c-2.95 0-5.45-2.0-6.34-4.7H1.83v2.58C3.83 21.08 7.6 24 12 24z"

                              />

                              <path

                                fill="#FBBC05"

                                d="M5.66 14.68a7.17 7.17 0 0 1 0-4.56V7.54H1.83a12.01 12.01 0 0 0 0 10.72l3.83-2.58z"

                              />

                              <path

                                fill="#EA4335"

                                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0C7.6 0 3.83 2.92 1.83 7.54l3.83 2.58c.89-2.7 3.39-4.7 6.34-4.7z"

                              />

                            </svg>

                          </div>

                          <span className="flex-1 text-center pr-[48px]">Sign up with Google</span>

                        </button>

                      </div>



                      <div className="relative flex py-0.5 items-center">

                        <div className="flex-grow border-t border-slate-200"></div>

                        <span className="flex-shrink mx-4 text-slate-400 text-[10.5px] font-extrabold uppercase tracking-wider">Or</span>

                        <div className="flex-grow border-t border-slate-200"></div>

                      </div>
                    </>
                  ) : null}

                  {!isGoogleSignup ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        {emailChecking && (
                          <p className="text-[11px] text-slate-500 mt-0 px-1 leading-tight">
                            Checking email availability...
                          </p>
                        )}
                        {emailAvailable === true && !emailChecking && form.email && (
                          <p className="text-emerald-600 text-[11px] font-bold mt-0 px-1 leading-tight">
                            ✓ Email is available
                          </p>
                        )}
                        {emailAvailable === false && !emailChecking && form.email && (
                          <p className="text-red-500 text-[11px] font-bold mt-0 px-1 leading-tight">
                            ✗ Email is already registered
                          </p>
                        )}
                        {errors && errors.email && (
                          <p className="text-red-500 text-[11px] font-bold mt-0 px-1 leading-tight">
                            {errors.email}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          Create a Password
                        </label>
                        <div className="relative">
                          <input
                            aria-invalid={!!(errors && errors.password)}
                            type={showPassword ? "text" : "password"}
                            value={form.password}
                            onChange={(e) => handleChange("password", e.target.value)}
                            placeholder="At least 8 characters"
                            className={inputClass + " pr-10"}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors"
                          >
                            {showPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        {errors && errors.password && (
                          <p className="text-red-500 text-[11px] font-bold mt-0 px-1 leading-tight">
                            {errors.password}
                          </p>
                        )}
                        {!passwordIsStrong && form.password && (
                          <span className="text-red-500 text-[10px] font-bold block mt-0.5 px-1">
                            Use at least 8 characters for security.
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    googleProfile && (
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 p-4.5 flex items-center gap-4.5 transition-all duration-300 hover:border-slate-300 hover:shadow-sm cursor-default my-1">
                        <div className="absolute right-0 top-0 h-16 w-16 bg-emerald-500/5 blur-xl rounded-full pointer-events-none"></div>
                        <div className="relative shrink-0">
                          {googleProfile.picture ? (
                            <img
                              src={googleProfile.picture}
                              alt="Google Avatar"
                              className="h-12 w-12 rounded-full border border-slate-200/90 object-cover shadow-sm animate-fade-in"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-lg border border-slate-300">
                              {googleProfile.given_name?.[0] || googleProfile.name?.[0] || "U"}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 h-5.5 w-5.5 rounded-full bg-white flex items-center justify-center shadow-md border border-slate-100/90">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.69c-.29 1.5-.1.13-1.14 2.19v2.51h1.8c1.05-1.0 1.8-2.4 1.8-4.08c0-1.85-.35-2.45-1.15-2.45z"/>
                              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-1.8-2.51c-.8.5-1.8.8-3.13.8c-2.95 0-5.45-2.0-6.34-4.7H1.83v2.58C3.83 21.08 7.6 24 12 24z"/>
                              <path fill="#FBBC05" d="M5.66 14.68a7.17 7.17 0 0 1 0-4.56V7.54H1.83a12.01 12.01 0 0 0 0 10.72l3.83-2.58z"/>
                              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0C7.6 0 3.83 2.92 1.83 7.54l3.83 2.58c.89-2.7 3.39-4.7 6.34-4.7z"/>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[13.5px] font-extrabold text-slate-900 truncate">
                              {googleProfile.name || `${googleProfile.given_name} ${googleProfile.family_name}`}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-755 border border-emerald-200 shadow-sm animate-pulse-soft">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Connected
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-500 font-semibold truncate leading-none">
                            {googleProfile.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDisconnectGoogle}
                          className="text-[11.5px] font-black text-rose-650 hover:text-rose-700 hover:underline shrink-0 cursor-pointer p-1.5 transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    )
                  )}



                  <div className="flex flex-col gap-1 mt-1 border-t border-slate-100 pt-2.5">

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

                        className="text-[11.5px] text-slate-600 font-bold leading-normal cursor-pointer select-none"

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

                  <div className="flex flex-col gap-1 mt-3">

                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">

                      What kind of business is this?

                    </label>

                    <BusinessTypeSelect

                      value={form.businessType}

                      onChange={(v) => handleChange("businessType", v)}

                      className=""

                    />

                    <p className="text-[11px] text-slate-500 mt-1">

                      Pick the closest match. It helps us set things up better.

                    </p>

                    {errors && errors.businessType && (

                      <p className="text-red-500 text-[11px] font-bold mt-0 px-1 leading-tight">

                        {errors.businessType}

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



                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <div className="flex flex-col gap-1 h-full">

                      <label className="min-h-0 sm:min-h-10 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 leading-tight">

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

                      <label className="min-h-0 sm:min-h-10 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 leading-tight">

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

                <div className="sticky bottom-0 z-20 -mx-4 sm:mx-0 flex items-center gap-2 sm:gap-3 mt-1 border-t border-slate-100 pt-2.5 pb-2 sm:pb-0 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/80 px-4 sm:px-0">

                  {step > 1 && (

                    <button

                      type="button"

                      onClick={goBack}

                      className="px-4 py-2 sm:py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] sm:text-[12px] font-bold rounded-xl transition-all duration-200 active:scale-97 cursor-pointer"

                    >

                      Back

                    </button>

                  )}

                  <button

                    type="button"

                    onClick={goNext}

                    className="ml-auto px-5 sm:px-7 py-2 sm:py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] sm:text-[12px] font-bold rounded-xl transition-all duration-200 active:scale-97 cursor-pointer shadow-md shadow-slate-900/5"

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

                      onClick={() => handleSubmit({ preventDefault: () => { } })}

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

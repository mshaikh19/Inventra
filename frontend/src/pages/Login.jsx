import { useEffect, useState } from "react";
import FormInput from "../components/FormInput";
import FormError from "../components/FormError";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function Login({ setActiveTab }) {
  const loadSavedAuth = () => {
    const storageSources = [localStorage, sessionStorage];

    for (const storage of storageSources) {
      const token = storage.getItem("inventra_token");
      const userRaw = storage.getItem("inventra_user");

      if (token && userRaw) {
        try {
          return {
            token,
            user: JSON.parse(userRaw),
            rememberMe: storage === localStorage,
          };
        } catch {
          return {
            token,
            user: null,
            rememberMe: storage === localStorage,
          };
        }
      }
    }

    return null;
  };

  const savedAuth = typeof window !== "undefined" ? loadSavedAuth() : null;

  const [formData, setFormData] = useState({
    email: savedAuth?.user?.email || "",
    password: "",
    rememberMe: savedAuth?.rememberMe ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(savedAuth ? "Login successful." : null);
  const [error, setError] = useState(null);
  const [loginSuccess, setLoginSuccess] = useState(Boolean(savedAuth));
  // Forgot/reset moved to a dedicated page



  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const saveAuthData = (token, user) => {
    const storage = formData.rememberMe ? localStorage : sessionStorage;
    storage.setItem("inventra_token", token);
    storage.setItem("inventra_user", JSON.stringify(user));

    const otherStorage = formData.rememberMe ? sessionStorage : localStorage;
    otherStorage.removeItem("inventra_token");
    otherStorage.removeItem("inventra_user");
  };

  const clearAuthData = () => {
    localStorage.removeItem("inventra_token");
    localStorage.removeItem("inventra_user");
    sessionStorage.removeItem("inventra_token");
    sessionStorage.removeItem("inventra_user");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    setLoginSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Login failed.");
      }

      saveAuthData(data.accessToken, data.user);

      setLoginSuccess(true);
      setMessage(data.message || "Login successful.");
      setFormData((current) => ({
        ...current,
        password: "",
      }));
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  };

  const RightCard = () => {
    if (loginSuccess) {
      return (
        <div className="rounded-[32px] border border-emerald-100 bg-white/95 backdrop-blur-xl shadow-[0_30px_70px_rgba(15,23,42,0.08)] p-7 md:p-10 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Login confirmed
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Welcome back.</h2>
            <p className="text-sm md:text-[15px] leading-relaxed text-slate-600 font-medium">You are signed in as <span className="font-bold text-slate-900">{formData.email}</span>. Your session has been saved locally for this browser.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600 space-y-2">
            <div className="flex items-center justify-between gap-4"><span className="font-semibold text-slate-700">Status</span><span className="font-black text-emerald-600">Success</span></div>
            <div className="flex items-center justify-between gap-4"><span className="font-semibold text-slate-700">Remember me</span><span className="font-black text-slate-900">{formData.rememberMe ? "On" : "Off"}</span></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => setActiveTab("home")} className="flex-1 rounded-2xl bg-[#0F172A] px-5 py-4 text-base font-black text-white transition-all duration-200 hover:bg-slate-800 active:scale-[0.99]">Continue to home</button>
            <button type="button" onClick={() => { clearAuthData(); setLoginSuccess(false); setMessage(null); setActiveTab('home'); }} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-black text-slate-700 transition-all duration-200 hover:bg-slate-50 active:scale-[0.99]">Logout</button>
          </div>
        </div>
      );
    }

    // forgot/reset handled on separate page

    // default: sign-in form
    return (
      <form onSubmit={handleSubmit} className="rounded-[32px] border border-slate-100 bg-white/90 backdrop-blur-xl shadow-[0_30px_70px_rgba(15,23,42,0.08)] p-7 md:p-10 space-y-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black tracking-[0.28em] uppercase text-sky-500">Sign In</p><h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">Sign in to Inventra</h2></div></div>

        <div className="space-y-4">
          <FormInput
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />

          <FormInput
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
            <div className="flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input name="rememberMe" type="checkbox" checked={formData.rememberMe} onChange={handleChange} className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-200" /> Remember me</label>
            <button type="button" onClick={()=> setActiveTab('forgot')} className="text-sm font-bold text-sky-600 hover:text-sky-700 transition-colors">Forgot password?</button>
          </div>

        </div>

        {error && <FormError type="error">{error}</FormError>}

        {message && <FormError type="success">{message}</FormError>}

        <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[#0F172A] px-5 py-4 text-base font-black text-white transition-all duration-200 hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70">{loading ? "Signing in..." : "Sign In"}</button>
      </form>
    );
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const isLargeScreen = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(min-width: 1025px)").matches;

    if (isLargeScreen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <section className="min-h-[calc(100vh-5rem)] px-6 md:px-16 lg:px-24 xl:px-32 py-10 md:py-14 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#f8fafc_100%)] w-full flex items-center overflow-hidden">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <div className="relative overflow-hidden rounded-[32px] bg-[#0F172A] text-white p-8 md:p-12 shadow-[0_30px_80px_rgba(15,23,42,0.16)] lg:-translate-y-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_30%)]" />
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center gap-2 text-xs font-black tracking-[0.28em] uppercase text-sky-200/90">
              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.8)]" />
              Inventra Access
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05]">
                Welcome to Inventra
                <span className="block text-sky-300">
                  Please sign in to continue to the Retail Intelligence Dashboard.
                </span>
              </h1>
              <p className="text-slate-300 text-[15.5px] md:text-[16px] leading-relaxed max-w-xl font-medium">
                {/* Intentionally left neutral until account registration is available. */}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                ["Secure access", "Email + password sign in"],
                ["Live sync", "Backend connected through FastAPI"],
                ["Team ready", "Return to analytics in one tap"],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <div className="text-sm font-black text-white">{title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-300">
                    {description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-[36px] bg-sky-100/40 blur-3xl" />
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span aria-hidden="true">←</span>
            <span>Back to home</span>
          </button>
          {RightCard()}
        </div>
      </div>
    </section>
  );
}

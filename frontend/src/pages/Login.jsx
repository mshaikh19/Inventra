import { useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function Login({ setActiveTab, backendStatus }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: true,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

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

      localStorage.setItem("inventra_token", data.accessToken);
      localStorage.setItem("inventra_user", JSON.stringify(data.user));

      setMessage(data.message || "Login successful.");
      setFormData((current) => ({
        ...current,
        password: "",
      }));

      setTimeout(() => {
        setActiveTab("home");
      }, 700);
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-5rem)] px-6 md:px-16 lg:px-24 xl:px-32 py-10 md:py-14 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#f8fafc_100%)] w-full flex items-center">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <div className="relative overflow-hidden rounded-[32px] bg-[#0F172A] text-white p-8 md:p-12 shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_30%)]" />
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center gap-2 text-xs font-black tracking-[0.28em] uppercase text-sky-200/90">
              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.8)]" />
              Inventra Access
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05]">
                Welcome back.
                <span className="block text-sky-300">
                  Pick up right where you left off.
                </span>
              </h1>
              <p className="text-slate-300 text-[15.5px] md:text-[16px] leading-relaxed max-w-xl font-medium">
                Login connects your team to the retail intelligence dashboard.
                Registration is handled separately by Maryam.
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
          <form
            onSubmit={handleSubmit}
            className="rounded-[32px] border border-slate-100 bg-white/90 backdrop-blur-xl shadow-[0_30px_70px_rgba(15,23,42,0.08)] p-7 md:p-10 space-y-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black tracking-[0.28em] uppercase text-sky-500">
                  User Login
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                  Sign in to Inventra
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("home")}
                className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Back to home
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 flex items-center justify-between gap-3">
              <span>Backend status</span>
              <span
                className={`font-black uppercase tracking-[0.18em] text-[11px] ${backendStatus === "connected" ? "text-emerald-600" : backendStatus === "failed" ? "text-rose-600" : "text-amber-600"}`}
              >
                {backendStatus}
              </span>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Password
                </span>
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  required
                />
              </label>

              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <input
                    name="rememberMe"
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-200"
                  />
                  Keep me signed in
                </label>
                <button
                  type="button"
                  className="text-sm font-bold text-sky-600 hover:text-sky-700 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#0F172A] px-5 py-4 text-base font-black text-white transition-all duration-200 hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <p className="text-center text-sm text-slate-500">
              Registration is handled by Maryam. If your account is missing, ask
              her to create it first.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

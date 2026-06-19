import { useState, useEffect } from "react";
import FormInput from "../components/FormInput";
import FormError from "../components/FormError";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function ForgotPassword({ setActiveTab }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);
  const [resetError, setResetError] = useState(null);

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

  // Read optional token from URL query (deep link from email)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("token");
      if (t) {
        setToken(t);
        setShowReset(true);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const submitForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || data?.message || "Unable to request reset");
      setMessage(data.resetToken ? `Reset token: ${data.resetToken}` : data.message || "Check your email for reset instructions.");
    } catch (err) {
      setError(err.message || "Unable to request reset");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage(null);
    setResetError(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || data?.message || "Unable to reset password");
      setResetMessage((data.message || "Password reset successful.") + " Redirecting to login...");
      setTimeout(() => {
        setActiveTab("login");
      }, 2000);
    } catch (err) {
      setResetError(err.message || "Unable to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-5rem)] px-6 md:px-16 lg:px-24 xl:px-32 py-10 md:py-14 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#f8fafc_100%)] w-full flex items-center overflow-hidden">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left: form card (swapped) */}
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-[36px] bg-sky-50/20" />
          {!showReset ? (
            <form onSubmit={submitForgot} className="rounded-[20px] border border-slate-100 bg-white p-6 sm:p-8 md:p-10 shadow-lg max-w-xl mx-auto">
              <div>
                <p className="text-[11px] font-black tracking-[0.28em] uppercase text-sky-500">Request reset</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Reset Password</h2>
                <p className="mt-2 text-sm text-slate-600">Enter the email address associated with your account and we'll send you a link to reset your password.</p>
              </div>

              <div className="mt-6">
                <FormInput
                  label="Work email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alex.chen@auraretail.com"
                  autoComplete="email"
                  required
                />
              </div>

              {error && <FormError type="error">{error}</FormError>}
              {message && <FormError type="success">{message}</FormError>}

              <div className="flex items-center gap-3 mt-6">
                <button type="submit" disabled={loading} className="w-full rounded-lg bg-black text-white px-6 py-3 text-base font-bold flex items-center justify-center gap-3">{loading ? "Sending..." : "Send Reset Link →"}</button>
              </div>

              <div className="mt-6 border-t pt-4 text-xs text-slate-500">Password reset links are valid for 30 minutes.</div>
              <button type="button" onClick={() => setActiveTab("login")} className="mt-6 text-sm text-slate-600">← Back to sign in</button>
            </form>
          ) : (
            <form onSubmit={submitReset} className="rounded-[20px] border border-slate-100 bg-white p-6 sm:p-8 md:p-10 shadow-lg max-w-xl mx-auto">
              <div>
                <p className="text-[11px] font-black tracking-[0.28em] uppercase text-sky-500">Reset password</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Provide token and new password</h2>
              </div>

              <div className="mt-4">
                <FormInput
                  label="Reset token"
                  name="token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="paste reset token"
                  required
                />
              </div>

              <div className="mt-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">New password</span>
                  <div className="relative">
                    <input
                      name="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white pl-4 pr-10 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
                </label>
              </div>

              {resetError && <FormError type="error">{resetError}</FormError>}
              {resetMessage && <FormError type="success">{resetMessage}</FormError>}

              <div className="flex items-center gap-3 mt-6">
                <button type="submit" disabled={resetLoading} className="flex-1 rounded-lg bg-black text-white px-6 py-3 text-base font-bold">{resetLoading ? "Resetting..." : "Reset password"}</button>
                <button type="button" onClick={() => setShowReset(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">Back</button>
              </div>

              <button type="button" onClick={() => setActiveTab("login")} className="mt-4 text-sm text-slate-600">← Back to sign in</button>
            </form>
          )}
        </div>

        {/* Right: info / hero */}
        <div className="hidden lg:block relative overflow-hidden rounded-[32px] bg-[#0F172A] text-white p-8 md:p-12 shadow-[0_30px_80px_rgba(15,23,42,0.16)] lg:-translate-y-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_30%)]" />
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center gap-2 text-xs font-black tracking-[0.28em] uppercase text-sky-200/90">
              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.8)]" />
              Inventra Access
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05]">Securing your enterprise data.</h1>
              <p className="text-slate-300 text-[15.5px] md:text-[16px] leading-relaxed max-w-xl font-medium">Our multi-layered security protocols ensure that your retail intelligence remains confidential and protected. You will receive a secure reset link at your registered work email.</p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-bold text-white">INTELLIGENCE INSIGHT</div>
              <div className="mt-2 text-xs leading-relaxed text-slate-300">Password resets are monitored for security. You will receive a link valid for 30 minutes to your registered work email.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

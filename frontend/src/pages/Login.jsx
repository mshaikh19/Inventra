import { useEffect, useState } from "react";

import FormInput from "../components/formInput";

import FormError from "../components/FormError";

import { getDashboardTabFromUser, userHasOwnerAccess } from "../utils/dashboard";

import {
  getUserBranches,
  isBranchSetupComplete,
  markBranchSetupCompleted,
} from "../utils/branches";



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

  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState(

    savedAuth ? "Login successful." : null,

  );

  const [error, setError] = useState(null);

  const [loginSuccess, setLoginSuccess] = useState(Boolean(savedAuth));

  const [fieldErrors, setFieldErrors] = useState({});

  // Forgot/reset moved to a dedicated page



  const handleChange = (event) => {

    const { name, value, type, checked } = event.target;

    setFormData((current) => ({

      ...current,

      [name]: type === "checkbox" ? checked : value,

    }));

    // Clear field error when user starts typing

    if (fieldErrors[name]) {

      setFieldErrors((prev) => {

        const next = { ...prev };

        delete next[name];

        return next;

      });

    }

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

    setFieldErrors({});

    setLoginSuccess(false);



    // Client-side validation

    const errors = {};

    if (!formData.email) {

      errors.email = "Email is required.";

    } else {

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      if (!emailRegex.test(formData.email)) {

        errors.email = "Please enter a valid email address.";

      }

    }

    if (!formData.password) {

      errors.password = "Password is required.";

    } else if (formData.password.length < 1) {

      errors.password = "Password cannot be empty.";

    }



    if (Object.keys(errors).length > 0) {

      setFieldErrors(errors);

      setError("Please fix the errors above and try again.");

      setLoading(false);

      return;

    }



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

        // Handle specific error messages

        if (data?.detail) {

          if (typeof data.detail === "string") {

            if (data.detail.toLowerCase().includes("email") || data.detail.toLowerCase().includes("credentials")) {

              setFieldErrors({ email: data.detail, password: data.detail });

              setError("Invalid email or password. Please check your credentials.");

            } else if (data.detail.toLowerCase().includes("not found")) {

              setFieldErrors({ email: data.detail });

              setError("Account not found. Please check your email or sign up.");

            } else {

              setError(data.detail);

            }

          } else if (typeof data.detail === "object") {

            setError(data.detail.message || JSON.stringify(data.detail));

          }

        } else {

          setError("Login failed. Please try again.");

        }

        throw new Error(data?.detail || "Login failed.");

      }



      saveAuthData(data.accessToken, data.user);



      // Check branch setup against the backend, then persist the completed state
      // locally so future app loads can route directly to the dashboard.

      let branchData = null;

      try {

        branchData = await getUserBranches();

      } catch {

        branchData = null;

      }

      const user = data.user || {};

      const userId = user.id || user._id || user.email || "default";

      const isOwner = userHasOwnerAccess(user);

      const hasCompletedBranchSetup = Boolean(branchData?.branches && branchData.branches.length > 0);

      if (isOwner && hasCompletedBranchSetup) {

        markBranchSetupCompleted(user);

      }

      const onboardingCompleted =
        !isOwner ||
        hasCompletedBranchSetup ||
        localStorage.getItem(`inventra_onboarding_completed_${userId}`) === "true";



      if (isOwner && !onboardingCompleted) {

        setActiveTab("branch-setup");

      } else {

        setActiveTab(getDashboardTabFromUser(data.user));

      }



      setLoginSuccess(true);

      setMessage(data.message || "Login successful.");

      setFormData((current) => ({

        ...current,

        password: "",

      }));

    } catch (loginError) {

      if (!error) {

        setError(loginError.message || "Unable to sign in right now.");

      }

    } finally {

      setLoading(false);

    }

  };



  const handleGoogleLogin = async (response) => {

    setLoading(true);

    setError(null);

    setMessage(null);

    setFieldErrors({});

    setLoginSuccess(false);



    try {

      const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          access_token: response,

        }),

      });



      const data = await res.json();



      if (!res.ok) {

        throw new Error(data?.detail || "Google Sign-In failed.");

      }



      saveAuthData(data.accessToken, data.user);



      let branchData = null;

      try {

        branchData = await getUserBranches();

      } catch {

        branchData = null;

      }



      const user = data.user || {};

      const userId = user.id || user._id || user.email || "default";

      const isOwner = userHasOwnerAccess(user);

      const hasCompletedBranchSetup = Boolean(branchData?.branches && branchData.branches.length > 0);



      if (isOwner && hasCompletedBranchSetup) {

        markBranchSetupCompleted(user);

      }



      const onboardingCompleted =

        !isOwner ||

        hasCompletedBranchSetup ||

        localStorage.getItem(`inventra_onboarding_completed_${userId}`) === "true";



      if (isOwner && !onboardingCompleted) {

        setActiveTab("branch-setup");

      } else {

        setActiveTab(getDashboardTabFromUser(data.user));

      }



      setLoginSuccess(true);

      setMessage(data.message || "Login successful.");

    } catch (err) {

      setError(err.message || "Unable to sign in with Google right now.");

    } finally {

      setLoading(false);

    }

  };



  const RightCard = () => {

    if (loginSuccess) {

      return (

        <div className="rounded-4xl border border-emerald-100 bg-white/95 backdrop-blur-xl shadow-[0_30px_70px_rgba(15,23,42,0.08)] p-7 md:p-10 space-y-6">

          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">

            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            Login confirmed

          </div>



          <div className="space-y-3">

            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">

              Welcome back.

            </h2>

            <p className="text-sm md:text-[15px] leading-relaxed text-slate-600 font-medium">

              You are signed in as{" "}

              <span className="font-bold text-slate-900">{formData.email}</span>

              . Your session has been saved locally for this browser.

            </p>

          </div>



          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600 space-y-2">

            <div className="flex items-center justify-between gap-4">

              <span className="font-semibold text-slate-700">Status</span>

              <span className="font-black text-emerald-600">Success</span>

            </div>

            <div className="flex items-center justify-between gap-4">

              <span className="font-semibold text-slate-700">Remember me</span>

              <span className="font-black text-slate-900">

                {formData.rememberMe ? "On" : "Off"}

              </span>

            </div>

          </div>



          <div className="flex flex-col sm:flex-row gap-3">

            <button

              type="button"

              onClick={() =>

                setActiveTab(getDashboardTabFromUser(savedAuth?.user))

              }

              className="flex-1 rounded-2xl bg-[#0F172A] px-5 py-4 text-base font-black text-white transition-all duration-200 hover:bg-slate-800 active:scale-[0.99]"

            >

              Open dashboard

            </button>

            <button

              type="button"

              onClick={() => {

                clearAuthData();

                setLoginSuccess(false);

                setMessage(null);

                setActiveTab("home");

              }}

              className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-black text-slate-700 transition-all duration-200 hover:bg-slate-50 active:scale-[0.99]"

            >

              Logout

            </button>

          </div>

        </div>

      );

    }



    // forgot/reset handled on separate page



    // default: sign-in form

    return (

      <form

        onSubmit={handleSubmit}

        className="rounded-4xl border border-slate-100 bg-white/90 backdrop-blur-xl shadow-[0_30px_70px_rgba(15,23,42,0.08)] p-7 md:p-10 space-y-6"

      >

        <div className="flex items-start justify-between gap-2">

          <div>

            <p className="text-[10px] font-black tracking-[0.28em] uppercase text-sky-500">

              Sign In

            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">

              Sign in to Inventra

            </h2>

          </div>

        </div>



        <div className="w-full flex justify-center mt-2">

          <button

            type="button"

            onClick={handleGoogleSignInClick}

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

            <span className="flex-1 text-center pr-[48px]">Sign in with Google</span>

          </button>

        </div>



        <div className="relative flex py-1 items-center">

          <div className="flex-grow border-t border-slate-200"></div>

          <span className="flex-shrink mx-4 text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">Or</span>

          <div className="flex-grow border-t border-slate-200"></div>

        </div>



        <div className="space-y-4">

          <div>

            <FormInput

              label="Email"

              name="email"

              type="email"

              value={formData.email}

              onChange={handleChange}

              placeholder="you@company.com"

              autoComplete="email"

              required

              className={fieldErrors.email ? "border-red-500 focus:border-red-500 focus:ring-red-100" : ""}

            />

            {fieldErrors.email && (

              <p className="mt-2 text-xs font-bold text-red-600">{fieldErrors.email}</p>

            )}

          </div>



          <div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className={`w-full rounded-lg border bg-white pl-4 pr-10 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:ring-4 ${fieldErrors.password
                      ? "border-red-500 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-200 focus:border-sky-400 focus:ring-sky-100"
                    }`}
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

            {fieldErrors.password && (

              <p className="mt-2 text-xs font-bold text-red-600">{fieldErrors.password}</p>

            )}

          </div>

          <div className="flex items-center justify-between gap-4">

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">

              <input

                name="rememberMe"

                type="checkbox"

                checked={formData.rememberMe}

                onChange={handleChange}

                className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-200"

              />{" "}

              Remember me

            </label>

            <button

              type="button"

              onClick={() => setActiveTab("forgot")}

              className="text-sm font-bold text-sky-600 hover:text-sky-700 transition-colors"

            >

              Forgot password?

            </button>

          </div>

        </div>



        {error && <FormError type="error">{error}</FormError>}



        {message && <FormError type="success">{message}</FormError>}



        <button

          type="submit"

          disabled={loading}

          className="w-full rounded-2xl bg-[#0F172A] px-5 py-4 text-base font-black text-white transition-all duration-200 hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"

        >

          {loading ? "Signing in..." : "Sign In"}

        </button>





      </form>

    );

  };



  useEffect(() => {

    const previousOverflow = document.body.style.overflow;

    const isLargeScreen =

      typeof window !== "undefined" &&

      window.matchMedia &&

      window.matchMedia("(min-width: 1025px)").matches;



    if (isLargeScreen) {

      document.body.style.overflow = "hidden";

    }



    return () => {

      document.body.style.overflow = previousOverflow;

    };

  }, []);



  useEffect(() => {

    if (savedAuth?.user) {

      setActiveTab(getDashboardTabFromUser(savedAuth.user));

    }

  }, []);



  const handleGoogleSignInClick = () => {

    if (window.google) {

      const client = window.google.accounts.oauth2.initTokenClient({

        client_id: "335551120481-532ku6717oec3lk37j48hc2koo8jfq3f.apps.googleusercontent.com",

        scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",

        callback: (response) => {

          if (response && response.access_token) {

            handleGoogleLogin(response.access_token);

          }

        },

      });

      client.requestAccessToken();

    }

  };



  return (

    <section className="min-h-[calc(100vh-5rem)] px-6 md:px-16 lg:px-24 xl:px-32 py-10 md:py-14 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_45%,#f8fafc_100%)] w-full flex items-center overflow-hidden">

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

        <div className="hidden lg:block relative overflow-hidden rounded-4xl bg-[#0F172A] text-white p-8 md:p-12 shadow-[0_30px_80px_rgba(15,23,42,0.16)] lg:-translate-y-6">

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.22),transparent_30%)]" />

          <div className="relative z-10 flex flex-col gap-6">

            <div className="flex items-center gap-2 text-xs font-black tracking-[0.28em] uppercase text-sky-200/90">

              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.8)]" />

              Inventra Access

            </div>



            <div className="space-y-4">

              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05]">

                Welcome to Inventra

                <span className="block text-sky-300">

                  Please sign in to continue to the Retail Intelligence

                  Dashboard.

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



        <div className="relative w-full max-w-md md:max-w-lg lg:max-w-none mx-auto lg:mx-0">

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


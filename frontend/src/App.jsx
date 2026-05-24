import React, { useState, useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import FloatingChatbot from "./components/FloatingChatbot";
import Home from "./pages/Home";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import BillingPOS from "./pages/BillingPOS";
import BranchOperations from "./pages/BranchOperations";
import InventoryOperations from "./pages/InventoryOperations";
import BranchSetupWizard from "./pages/BranchSetupWizard";
import {
  getBranchOpsPath,
  getBranchOpsTab,
  getBranchOpsTierFromPath,
  getInventoryOpsPath,
  getInventoryOpsTab,
  getInventoryOpsTierFromPath,
  getBillingPosPath,
  getBillingPosTab,
  getBillingPosTierFromPath,
  getDashboardPath,
  getDashboardTab,
  getDashboardTabFromUser,
  getDashboardTierFromPath,

} from "./utils/dashboard";

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "home";
    const path = window.location.pathname;

    let initialTab = "home";
    const dashboardTier = getDashboardTierFromPath(path);
    const billingTier = getBillingPosTierFromPath(path);
    const branchOpsTier = getBranchOpsTierFromPath(path);
    const inventoryOpsTier = getInventoryOpsTierFromPath(path);

    if (dashboardTier) initialTab = getDashboardTab(dashboardTier);
    else if (billingTier) initialTab = getBillingPosTab(billingTier);
    else if (branchOpsTier) initialTab = getBranchOpsTab(branchOpsTier);
    else if (inventoryOpsTier) initialTab = getInventoryOpsTab(inventoryOpsTier);
    else if (path === "/signup") initialTab = "signup";
    else if (path === "/login") initialTab = "login";
    else if (path === "/forgot") initialTab = "forgot";
    else if (path === "/branch-setup") initialTab = "branch-setup";

    // Session & Onboarding Guarding during initialization
    const token = localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
    const rawUser = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");
    if (token && rawUser) {
      try {
        const user = JSON.parse(rawUser);
        const userId = user.id || user._id || user.email || "default";
        const onboardingCompleted = localStorage.getItem(`inventra_onboarding_completed_${userId}`) === "true";
        if (!onboardingCompleted) {
          return "branch-setup";
        } else {
          if (initialTab === "signup" || initialTab === "login" || initialTab === "forgot" || initialTab === "branch-setup" || initialTab === "home") {
            return getDashboardTabFromUser(user);
          }
        }
      } catch {
        // ignore JSON parse error
      }
    } else {
      const isProtectedRoute =
        initialTab === "branch-setup" ||
        initialTab.startsWith("dashboard-") ||
        initialTab.startsWith("billing-pos-") ||
        initialTab.startsWith("branch-ops-") ||
        initialTab.startsWith("inventory-ops-");
      if (isProtectedRoute) {
        return "login";
      }
    }
    return initialTab;
  });

  const [backendStatus, setBackendStatus] = useState("checking");
  const [backendData, setBackendData] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isDashboardTab = activeTab.startsWith("dashboard-");
  const activeDashboardTier = isDashboardTab
    ? activeTab.replace("dashboard-", "")
    : null;
  const isBillingPosTab = activeTab.startsWith("billing-pos-");
  const activeBillingTier = isBillingPosTab
    ? activeTab.replace("billing-pos-", "")
    : null;
  const isBranchOpsTab = activeTab.startsWith("branch-ops-");
  const activeBranchOpsTier = isBranchOpsTab
    ? activeTab.replace("branch-ops-", "")
    : null;

  const isInventoryOpsTab = activeTab.startsWith("inventory-ops-");
  const activeInventoryOpsTier = isInventoryOpsTab
    ? activeTab.replace("inventory-ops-", "")
    : null;

  // Poll connection on mount
  useEffect(() => {
    fetch("http://127.0.0.1:8000/")
      .then((res) => {
        if (!res.ok) throw new Error("Offline");
        return res.json();
      })
      .then((data) => {
        setBackendStatus("connected");
        setBackendData(data);
      })
      .catch(() => {
        setBackendStatus("failed");
      });
  }, []);

  // Sync activeTab with URL on mount and run onboarding routing check
  useEffect(() => {
    const path = window.location.pathname;
    let newTab = "home";
    const dashboardTier = getDashboardTierFromPath(path);
    const billingTier = getBillingPosTierFromPath(path);
    const branchOpsTier = getBranchOpsTierFromPath(path);
    const inventoryOpsTier = getInventoryOpsTierFromPath(path);

    if (dashboardTier) {
      newTab = getDashboardTab(dashboardTier);
    } else if (billingTier) {
      newTab = getBillingPosTab(billingTier);
    } else if (branchOpsTier) {
      newTab = getBranchOpsTab(branchOpsTier);
    } else if (inventoryOpsTier) {
      newTab = getInventoryOpsTab(inventoryOpsTier);
    } else if (path === "/signup") {
      newTab = "signup";
    } else if (path === "/login") {
      newTab = "login";
    } else if (path === "/forgot") {
      newTab = "forgot";
    } else if (path === "/branch-setup") {
      newTab = "branch-setup";
    } else if (path === "/") {
      const storageSources = [localStorage, sessionStorage];
      for (const storage of storageSources) {
        const rawUser = storage.getItem("inventra_user");
        if (rawUser) {
          try {
            const storedUser = JSON.parse(rawUser);
            newTab = getDashboardTabFromUser(storedUser);
            break;
          } catch {
            // ignore
          }
        }
      }
    }

    // Guard on mount
    const token = localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
    const rawUser = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");
    if (token && rawUser) {
      try {
        const user = JSON.parse(rawUser);
        const userId = user.id || user._id || user.email || "default";
        const onboardingCompleted = localStorage.getItem(`inventra_onboarding_completed_${userId}`) === "true";
        if (!onboardingCompleted) {
          newTab = "branch-setup";
        } else {
          if (newTab === "signup" || newTab === "login" || newTab === "forgot" || newTab === "branch-setup" || newTab === "home") {
            newTab = getDashboardTabFromUser(user);
          }
        }
      } catch {
        // ignore
      }
    } else {
      const isProtectedRoute =
        newTab === "branch-setup" ||
        newTab.startsWith("dashboard-") ||
        newTab.startsWith("billing-pos-") ||
        newTab.startsWith("branch-ops-") ||
        newTab.startsWith("inventory-ops-");
      if (isProtectedRoute) {
        newTab = "login";
      }
    }

    setActiveTab(newTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monitor tab change and sync browser history with strict session guarding
  useEffect(() => {
    const token = localStorage.getItem("inventra_token") || sessionStorage.getItem("inventra_token");
    const rawUser = localStorage.getItem("inventra_user") || sessionStorage.getItem("inventra_user");

    let guardedTab = activeTab;

    if (token && rawUser) {
      try {
        const user = JSON.parse(rawUser);
        const userId = user.id || user._id || user.email || "default";
        const onboardingCompleted = localStorage.getItem(`inventra_onboarding_completed_${userId}`) === "true";

        if (!onboardingCompleted) {
          if (activeTab !== "branch-setup") {
            guardedTab = "branch-setup";
          }
        } else {
          if (
            activeTab === "signup" ||
            activeTab === "login" ||
            activeTab === "forgot" ||
            activeTab === "branch-setup" ||
            activeTab === "home"
          ) {
            guardedTab = getDashboardTabFromUser(user);
          }
        }
      } catch (e) {
        const isProtectedRoute =
          activeTab === "branch-setup" ||
          activeTab.startsWith("dashboard-") ||
          activeTab.startsWith("billing-pos-") ||
          activeTab.startsWith("branch-ops-") ||
          activeTab.startsWith("inventory-ops-");
        if (isProtectedRoute) {
          guardedTab = "login";
        }
      }
    } else {
      const isProtectedRoute =
        activeTab === "branch-setup" ||
        activeTab.startsWith("dashboard-") ||
        activeTab.startsWith("billing-pos-") ||
        activeTab.startsWith("branch-ops-") ||
        activeTab.startsWith("inventory-ops-");
      if (isProtectedRoute) {
        guardedTab = "login";
      }
    }

    if (guardedTab !== activeTab) {
      setActiveTab(guardedTab);
      return;
    }

    // Update history URL
    if (activeTab === "signup") {
      window.history.replaceState({}, "", "/signup");
    } else if (activeTab === "login") {
      window.history.replaceState({}, "", "/login");
    } else if (activeTab === "forgot") {
      window.history.replaceState({}, "", "/forgot");
    } else if (activeTab === "branch-setup") {
      window.history.replaceState({}, "", "/branch-setup");
    } else if (isBillingPosTab) {
      window.history.replaceState({}, "", getBillingPosPath(activeBillingTier));
    } else if (isBranchOpsTab) {
      window.history.replaceState({}, "", getBranchOpsPath(activeBranchOpsTier));
    } else if (isInventoryOpsTab) {
      window.history.replaceState({}, "", getInventoryOpsPath(activeInventoryOpsTier));
    } else if (isDashboardTab) {
      window.history.replaceState({}, "", getDashboardPath(activeDashboardTier));
    } else {
      window.history.replaceState({}, "", "/");
    }
  }, [
    activeTab,
    activeDashboardTier,
    activeBillingTier,
    activeBranchOpsTier,
    activeInventoryOpsTier,
    isBillingPosTab,
    isBranchOpsTab,
    isInventoryOpsTab,
    isDashboardTab,
  ]);



  // Monitor scroll for Back to Top visibility

  useEffect(() => {

    const handleScroll = () => {

      if (window.scrollY > 350) {

        setShowScrollTop(true);

      } else {

        setShowScrollTop(false);

      }

    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);

  }, []);



  const scrollToTop = () => {

    window.scrollTo({

      top: 0,

      behavior: "smooth",

    });

  };



  return (

    <div

      className={`min-h-screen bg-white text-slate-900 font-sans ${activeTab === "signup" || activeTab === "branch-setup" || isDashboardTab || isBillingPosTab || isBranchOpsTab || isInventoryOpsTab ? "" : "pb-24"
        } relative transition-all`}

    >

      <ToastContainer
        className="fixed left-1/8 top-4 z-[9999] flex w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/18 flex-col gap-2.5 p-0 m-0 pointer-events-none sm:w-[540px] sm:max-w-[540px]"
        position="top-center"
        autoClose={2800}
        hideProgressBar
        newestOnTop
        closeOnClick={false}
        pauseOnHover
        theme="light"
        toastClassName={({ type }) => {
          const base = "inventra-toast pointer-events-auto relative flex w-full overflow-hidden rounded-[1rem] border bg-white/98 shadow-xl shadow-slate-100/50 backdrop-blur-sm min-h-[50px] items-center transition-all duration-300";
          if (type === "success") return `${base} inventra-toast--success`;
          if (type === "error") return `${base} inventra-toast--error`;
          return `${base} inventra-toast--info`;
        }}
        bodyClassName={() => "inventra-toast__body w-full p-0 m-0"}
        closeButton={({ closeToast }) => (
          <button
            onClick={closeToast}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100/80 hover:text-slate-700 cursor-pointer z-10"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        icon={false}
      />



      {/* Top Header Navigation (hidden on signup/login/branch-setup) */}

      {activeTab !== "signup" &&
        activeTab !== "login" &&
        activeTab !== "forgot" &&
        activeTab !== "branch-setup" &&
        !isDashboardTab &&
        !isBillingPosTab &&
        !isBranchOpsTab &&
        !isInventoryOpsTab && (
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            backendStatus={backendStatus}
            setBackendStatus={setBackendStatus}
            setBackendData={setBackendData}
          />
        )}

      {/* Dynamic Content Switching */}
      <main className="relative z-10 w-full">
        {activeTab === "home" && <Home setActiveTab={setActiveTab} />}
        {activeTab === "login" && <Login setActiveTab={setActiveTab} />}
        {activeTab === "signup" && <Signup setActiveTab={setActiveTab} />}

        {activeTab === "branch-setup" && <BranchSetupWizard setActiveTab={setActiveTab} />}

        {activeTab === "forgot" && (

          <ForgotPassword setActiveTab={setActiveTab} />

        )}

        {isDashboardTab && (

          <Dashboard tier={activeDashboardTier} setActiveTab={setActiveTab} />

        )}

        {isBillingPosTab && (

          <BillingPOS tier={activeBillingTier} setActiveTab={setActiveTab} />

        )}

        {isBranchOpsTab && (

          <BranchOperations tier={activeBranchOpsTier} setActiveTab={setActiveTab} />

        )}

        {isInventoryOpsTab && (

          <InventoryOperations tier={activeInventoryOpsTier} setActiveTab={setActiveTab} />

        )}

      </main>



      {/* Bottom Floating Navigation (Mobile Only, Hidden on Desktop, Signup, Login, Branch Setup) */}

      {activeTab !== "signup" &&
        activeTab !== "login" &&
        activeTab !== "forgot" &&
        activeTab !== "branch-setup" &&
        !isDashboardTab &&
        !isBillingPosTab &&
        !isBranchOpsTab &&
        !isInventoryOpsTab && (
          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        )}



      {/* Go Back to Top Button (Stacked above Floating Chatbot FAB) */}

      {activeTab !== "login" && (

        <button

          onClick={scrollToTop}

          className={`fixed bottom-24 right-6 md:bottom-26 md:right-8 z-40 p-3.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white shadow-xl hover:shadow-[#0EA5E9]/15 transition-all duration-500 hover:-translate-y-1 active:translate-y-0 cursor-pointer border border-slate-800/40 group flex items-center justify-center ${showScrollTop

            ? "opacity-100 translate-y-0 pointer-events-auto"

            : "opacity-0 translate-y-10 pointer-events-none"

            }`}

          title="Go Back to Top"

        >

          <svg

            className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5"

            fill="none"

            stroke="currentColor"

            strokeWidth="3"

            viewBox="0 0 24 24"

          >

            <path

              strokeLinecap="round"

              strokeLinejoin="round"

              d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"

            />

          </svg>

        </button>

      )}



      {/* Global Floating AI Co-Pilot Chatbot */}

      {(isDashboardTab || isBillingPosTab) && (

        <FloatingChatbot activeTier={activeDashboardTier || activeBillingTier} />

      )}

    </div>

  );

}



export default App;


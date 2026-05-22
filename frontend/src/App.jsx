import React, { useState, useEffect } from "react";
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
    const dashboardTier = getDashboardTierFromPath(path);
    const billingTier = getBillingPosTierFromPath(path);
    const branchOpsTier = getBranchOpsTierFromPath(path);
    const inventoryOpsTier = getInventoryOpsTierFromPath(path);

    if (dashboardTier) return getDashboardTab(dashboardTier);
    if (billingTier) return getBillingPosTab(billingTier);
    if (branchOpsTier) return getBranchOpsTab(branchOpsTier);
    if (inventoryOpsTier) return getInventoryOpsTab(inventoryOpsTier);

    if (path === "/signup") return "signup";
    if (path === "/login") return "login";
    if (path === "/forgot") return "forgot";
    return "home";
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

  // Sync activeTab with URL so signup shows as /signup
  useEffect(() => {
    // On mount, set activeTab from pathname
    const path = window.location.pathname;
    const dashboardTier = getDashboardTierFromPath(path);
    const billingTier = getBillingPosTierFromPath(path);
    const branchOpsTier = getBranchOpsTierFromPath(path);
    const inventoryOpsTier = getInventoryOpsTierFromPath(path);

    if (dashboardTier) {
      setActiveTab(getDashboardTab(dashboardTier));
      return;
    }

    if (billingTier) {
      setActiveTab(getBillingPosTab(billingTier));
      return;
    }

    if (branchOpsTier) {
      setActiveTab(getBranchOpsTab(branchOpsTier));
      return;
    }

    if (inventoryOpsTier) {
      setActiveTab(getInventoryOpsTab(inventoryOpsTier));
      return;
    }

    if (path === "/signup") setActiveTab("signup");
    if (path === "/login") setActiveTab("login");
    if (path === "/forgot") setActiveTab("forgot");

    if (path === "/") {
      const storageSources = [localStorage, sessionStorage];
      for (const storage of storageSources) {
        const rawUser = storage.getItem("inventra_user");
        if (!rawUser) continue;

        try {
          const storedUser = JSON.parse(rawUser);
          setActiveTab(getDashboardTabFromUser(storedUser));
          return;
        } catch {
          continue;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "signup") {
      window.history.replaceState({}, "", "/signup");
    } else if (activeTab === "login") {
      window.history.replaceState({}, "", "/login");
    } else if (activeTab === "forgot") {
      window.history.replaceState({}, "", "/forgot");
    } else if (isBillingPosTab) {
      window.history.replaceState(
        {},
        "",
        getBillingPosPath(activeBillingTier),
      );
    } else if (isBranchOpsTab) {
      window.history.replaceState(
        {},
        "",
        getBranchOpsPath(activeBranchOpsTier),
      );
    } else if (isInventoryOpsTab) {
      window.history.replaceState(
        {},
        "",
        getInventoryOpsPath(activeInventoryOpsTier),
      );
    } else if (isDashboardTab) {
      window.history.replaceState(
        {},
        "",
        getDashboardPath(activeDashboardTier),
      );
    } else {
      window.history.replaceState({}, "", "/");
    }
  }, [activeTab, activeDashboardTier, activeBillingTier, activeBranchOpsTier, activeInventoryOpsTier, isBillingPosTab, isBranchOpsTab, isInventoryOpsTab, isDashboardTab]);

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
      className={`min-h-screen bg-white text-slate-900 font-sans ${activeTab === "signup" || isDashboardTab || isBillingPosTab || isBranchOpsTab || isInventoryOpsTab ? "" : "pb-24"} relative transition-all`}
    >
      {/* Top Header Navigation (hidden on signup/login) */}
      {activeTab !== "signup" &&
        activeTab !== "login" &&
        activeTab !== "forgot" &&
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

      {/* Bottom Floating Navigation (Mobile Only, Hidden on Desktop, Signup, Login) */}
      {activeTab !== "signup" &&
        activeTab !== "login" &&
        activeTab !== "forgot" &&
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
          className={`fixed bottom-24 right-6 md:bottom-26 md:right-8 z-40 p-3.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white shadow-xl hover:shadow-[#0EA5E9]/15 transition-all duration-500 hover:-translate-y-1 active:translate-y-0 cursor-pointer border border-slate-800/40 group flex items-center justify-center ${
            showScrollTop
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

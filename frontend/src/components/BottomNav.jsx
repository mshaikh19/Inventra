import React, { useState, useEffect } from 'react';

export default function BottomNav({ activeTab, setActiveTab, userTier }) {
  const [currentSection, setCurrentSection] = useState(() => {
    return typeof window !== "undefined"
      ? sessionStorage.getItem("inventra_dashboard_section") || "overview"
      : "overview";
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleSectionChanged = (e) => {
      setCurrentSection(e.detail);
    };
    window.addEventListener("dashboard-section-changed", handleSectionChanged);
    return () => {
      window.removeEventListener("dashboard-section-changed", handleSectionChanged);
    };
  }, []);

  useEffect(() => {
    const handleMenuStatus = (e) => {
      setIsMenuOpen(e.detail);
    };
    window.addEventListener("mobile-menu-status-changed", handleMenuStatus);
    return () => {
      window.removeEventListener("mobile-menu-status-changed", handleMenuStatus);
    };
  }, []);

  const tabs = [
    {
      id: "home",
      label: "Home",
      icon: (
        <svg className="w-4.5 h-4.5 stroke-[2] fill-none stroke-current" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: (
        <svg className="w-4.5 h-4.5 stroke-[2] fill-none stroke-current" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
        </svg>
      )
    },
    {
      id: "billing",
      label: "POS",
      icon: (
        <svg className="w-4.5 h-4.5 stroke-[2] fill-none stroke-current" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: (
        <svg className="w-4.5 h-4.5 stroke-[2] fill-none stroke-current" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    {
      id: "menu",
      label: "Menu",
      icon: (
        <svg className="w-4.5 h-4.5 stroke-[2] fill-none stroke-current" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )
    }
  ];

  const handleTabClick = (tabId) => {
    const tier = userTier || "small";
    if (tabId === "home") {
      setActiveTab(`dashboard-${tier}`);
      sessionStorage.setItem("inventra_dashboard_section", "overview");
      window.dispatchEvent(new CustomEvent("change-dashboard-section", { detail: "overview" }));
    } else if (tabId === "analytics") {
      setActiveTab(`dashboard-${tier}`);
      sessionStorage.setItem("inventra_dashboard_section", "analytics");
      window.dispatchEvent(new CustomEvent("change-dashboard-section", { detail: "analytics" }));
    } else if (tabId === "billing") {
      setActiveTab(`billing-pos-${tier}`);
    } else if (tabId === "inventory") {
      if (tier === "small") {
        setActiveTab("dashboard-small");
        sessionStorage.setItem("inventra_dashboard_section", "inventory");
        window.dispatchEvent(new CustomEvent("change-dashboard-section", { detail: "inventory" }));
      } else {
        setActiveTab(`inventory-ops-${tier}`);
      }
    } else if (tabId === "menu") {
      const isDashboard = activeTab.startsWith("dashboard-");
      if (isDashboard) {
        window.dispatchEvent(new CustomEvent("toggle-mobile-menu"));
      } else {
        sessionStorage.setItem("inventra_open_mobile_menu", "true");
        setActiveTab(`dashboard-${tier}`);
      }
    }
  };

  const isDashboard = activeTab.startsWith("dashboard-");
  
  const checkIsActive = (tabId) => {
    if (tabId === "home") {
      return isDashboard && currentSection === "overview";
    }
    if (tabId === "analytics") {
      return isDashboard && currentSection === "analytics";
    }
    if (tabId === "billing") {
      return activeTab.startsWith("billing-pos-");
    }
    if (tabId === "inventory") {
      return (isDashboard && currentSection === "inventory") || activeTab.startsWith("inventory-ops-");
    }
    if (tabId === "menu") {
      return isMenuOpen;
    }
    return false;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-150 grid grid-cols-5 items-center z-50 shadow-md transition-all">
      {tabs.map((tab) => {
        const isActive = checkIsActive(tab.id);
        return (
          <div key={tab.id} className="flex justify-center items-center w-full h-full">
            <button
              className={`flex flex-col items-center justify-center cursor-pointer bg-none border-none transition-all duration-200 ${
                isActive 
                  ? "bg-[#0EA5E9]/10 text-[#0EA5E9] rounded-xl py-1.5 px-3 font-black scale-105" 
                  : "text-slate-400 hover:text-slate-650 py-1.5 px-3 font-bold"
              }`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.icon}
              <span className="text-[9px] tracking-wide mt-0.5">{tab.label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

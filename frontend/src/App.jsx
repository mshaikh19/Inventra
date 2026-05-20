import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import Login from "./pages/Login";

function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [backendData, setBackendData] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

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
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-24 relative transition-all">
      {/* Top Header Navigation */}
      {activeTab !== "login" && (
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
        {activeTab === "login" && (
          <Login setActiveTab={setActiveTab} backendStatus={backendStatus} />
        )}
        {activeTab === "analytics" && <Analytics />}
        {activeTab === "inventory" && <Inventory />}
        {activeTab === "settings" && <Settings />}
      </main>

      {/* Bottom Floating Navigation (Mobile Only, Hidden on Desktop) */}
      {activeTab !== "login" && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      {/* Go Back to Top Button */}
      {activeTab !== "login" && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 p-3.5 rounded-full bg-[#0F172A] hover:bg-slate-800 text-white shadow-xl hover:shadow-[#0EA5E9]/15 transition-all duration-500 hover:-translate-y-1 active:translate-y-0 cursor-pointer border border-slate-800/40 group flex items-center justify-center ${
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
    </div>
  );
}

export default App;

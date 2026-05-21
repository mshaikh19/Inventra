import React from "react";

export default function Header({
  activeTab,
  setActiveTab,
  backendStatus,
  setBackendStatus,
  setBackendData,
}) {
  const [activeSection, setActiveSection] = React.useState(null);

  // Auto-highlight nav link based on which section is scrolled into view
  React.useEffect(() => {
    const sectionIds = ["features", "partners", "metrics", "cta"];
    const observers = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: "-10% 0px -60% 0px", threshold: 0 },
      );
      observer.observe(el);
      observers.push(observer);
    });

    // Clear highlight when scrolled back to very top (hero area)
    const handleScroll = () => {
      if (window.scrollY < 100) setActiveSection(null);
    };
    window.addEventListener("scroll", handleScroll);

    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const triggerReconnect = () => {
    setBackendStatus("checking");
    fetch("http://127.0.0.1:8000/")
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus("connected");
        setBackendData(data);
      })
      .catch(() => setBackendStatus("failed"));
  };

  const handleNavClick = (sectionId) => {
    setActiveSection(sectionId);
    setActiveTab("home");
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        const headerOffset = 74;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    }, 80);
  };

  const handleLogoClick = () => {
    setActiveTab("home");
    setActiveSection("features");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <header className="sticky top-0 left-0 right-0 z-50 w-full bg-white/85 backdrop-blur-md border-b border-slate-100 py-4 px-6 md:px-16 lg:px-24 xl:px-32 flex items-center justify-between shadow-[0_2px_15px_rgba(0,0,0,0.015)] transition-all duration-300">
      {/* Brand logo & Name with tiny server connection indicator */}
      <div
        className="flex items-center gap-2.5 cursor-pointer group"
        onClick={handleLogoClick}
      >
        <span className="text-[15px] font-black tracking-tight text-slate-900 font-sans">
          Inventra
        </span>

        {/* Dynamic Connection Indicator next to logo */}
        <div
          className="flex items-center justify-center cursor-pointer p-0.5"
          onClick={triggerReconnect}
          title={`Server connection status: ${backendStatus}. Click to reconnect.`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              backendStatus === "connected"
                ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                : backendStatus === "failed"
                  ? "bg-rose-500 shadow-[0_0_8px_#ef4444]"
                  : "bg-amber-500 shadow-[0_0_8px_#f59e0b]"
            }`}
          ></span>
        </div>
      </div>

      {/* Centered Navigation Links scrolling smoothly to elements on the Home page */}
      <nav className="hidden md:flex items-center gap-8 text-[12.5px] font-semibold text-slate-500">
        <button
          className={`cursor-pointer transition-all hover:text-slate-950 pb-1 ${activeSection === "partners" && activeTab === "home" ? "text-slate-950 border-b-2 border-slate-950 font-bold" : ""}`}
          onClick={() => handleNavClick("partners")}
        >
          Partners
        </button>
        <button
          className={`cursor-pointer transition-all hover:text-slate-950 pb-1 ${activeSection === "features" && activeTab === "home" ? "text-slate-950 border-b-2 border-slate-950 font-bold" : ""}`}
          onClick={() => handleNavClick("features")}
        >
          Features
        </button>
        <button
          className={`cursor-pointer transition-all hover:text-slate-950 pb-1 ${activeSection === "metrics" && activeTab === "home" ? "text-slate-950 border-b-2 border-slate-950 font-bold" : ""}`}
          onClick={() => handleNavClick("metrics")}
        >
          Performance
        </button>
        <button
          className={`cursor-pointer transition-all hover:text-slate-950 pb-1 ${activeSection === "cta" && activeTab === "home" ? "text-slate-950 border-b-2 border-slate-950 font-bold" : ""}`}
          onClick={() => handleNavClick("cta")}
        >
          Get Started
        </button>
      </nav>

      {/* Right controls: A beautiful, clean high-contrast CTA button instead of application links */}
      <div className="flex items-center gap-4">
        <button
          className="hidden sm:inline-flex py-2.5 px-4.5 rounded-lg font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all duration-200 active:scale-98 cursor-pointer text-[12px] items-center justify-center gap-1.5 font-sans"
          onClick={() => setActiveTab("login")}
        >
          <span>Login</span>
        </button>
        <button
          className="py-2.5 px-4.5 rounded-lg font-bold bg-[#0f172a] hover:bg-slate-800 text-white transition-all duration-200 active:scale-98 cursor-pointer text-[12px] flex items-center justify-center gap-1.5 font-sans"
          onClick={() => handleNavClick("cta")}
        >
          <span>Start Session</span>
          <span className="text-[13px]">→</span>
        </button>
      </div>
    </header>
  );
}

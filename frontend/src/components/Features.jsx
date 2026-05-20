import React from 'react';

export default function Features({ setActiveTab }) {
  const features = [
    {
      id: "analytics",
      title: "Predictive Analytics",
      desc: "Stop reacting and start anticipating. Our proprietary models predict stockouts and demand shifts 30 days before they happen — across any retail category.",
      icon: (
        <svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25 5.106 11.856a2.25 2.25 0 1 0-3.182 3.182l3.01 3.01m13.177-11.515 2.394 2.394a2.25 2.25 0 1 1-3.182 3.182l-3.01-3.01m0 0L7.5 14.25m7.5-7.5 3.01 3.01M10.5 18v-4.5h4.5M12 21a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" />
        </svg>
      )
    },
    {
      id: "inventory",
      title: "Smart Inventory Management",
      desc: "A unified real-time view of your entire stock. Track quantities, locations, and reorder thresholds across all product lines from a single dashboard.",
      icon: (
        <svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
      )
    },
    {
      id: "settings",
      title: "Automated Profit & Tax Reporting",
      desc: "Receive weekly summaries of your business's gross profit, operational expenses, and automated tax calculations — ready for review with zero manual effort.",
      icon: (
        <svg className="w-5 h-5 text-slate-800" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
        </svg>
      )
    }
  ];

  return (
    <section id="features" className="py-20 md:py-28 px-6 md:px-16 lg:px-24 xl:px-32 bg-white w-full max-w-none transition-all">
      <div className="flex flex-col items-center justify-center text-center mb-20 max-w-3xl mx-auto gap-4">
        <h2 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-slate-900 tracking-tighter leading-none font-sans">
          Precision Engineering for Modern Retail
        </h2>
        <p className="text-[18px] md:text-[19px] text-slate-700 leading-relaxed font-semibold font-sans">
          We strip away the noise so you can focus on the metrics that actually move the needle for your retail business.
        </p>
      </div>

      {/* Responsive Grid: stacks on mobile, 3-columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {features.map((item) => (
          <div 
            key={item.id}
            className="bg-white border border-slate-100 rounded-[14px] p-8 text-left transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.03)] hover:-translate-y-1 cursor-pointer flex flex-col gap-6"
            onClick={() => setActiveTab(item.id)}
          >
            {/* Soft gray icon container */}
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
              {item.icon}
            </div>
            
            <div className="flex flex-col gap-3.5">
              <h3 className="text-[22px] md:text-[24px] lg:text-[26px] font-extrabold text-slate-900 leading-tight font-sans">
                {item.title}
              </h3>
              <p className="text-[15.5px] text-slate-600 leading-relaxed font-medium font-sans">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

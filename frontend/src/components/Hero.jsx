import React, { useState } from 'react';

export default function Hero({ setActiveTab }) {
  const [hoveredNode, setHoveredNode] = useState(null);

  return (
    <section className="px-6 md:px-16 lg:px-24 xl:px-32 py-16 md:py-28 w-full max-w-none relative overflow-hidden bg-white">

      {/* Dynamic blurred radial backdrop nodes */}
      <div className="absolute w-[500px] h-[500px] top-[-50px] right-[5%] bg-sky-100/10 blur-[100px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute w-[400px] h-[400px] bottom-[-50px] left-[5%] bg-slate-50/50 blur-[90px] rounded-full pointer-events-none z-0"></div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10 w-full max-w-none">

        <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left">

          {/* Title */}
          <h1 className="text-5xl md:text-[62px] font-black text-slate-900 leading-[1.08] mb-8 tracking-tight max-w-xl font-sans">
            Inventra. <br />
            <span className="text-[#0EA5E9]">Master Your Market</span>
            <br />
            <span className="text-[#0EA5E9]">Through Intelligence.</span>
          </h1>

          <p className="text-[17px] md:text-[18px] text-slate-600 leading-relaxed max-w-xl mb-12 font-semibold font-sans">
            Transform complex retail metrics into actionable growth. Inventra delivers a sophisticated, AI-driven interface for high-stakes retail decision making.
          </p>

          {/* Action buttons matching screenshot */}
          <div className="flex flex-col sm:flex-row gap-3.5 w-full max-w-[420px] lg:max-w-none mt-10">
            <button
              className="py-3.5 px-7 rounded-lg font-bold bg-[#0f172a] hover:bg-slate-800 text-white transition-all duration-200 active:scale-98 cursor-pointer text-[14px] flex items-center justify-center gap-1.5 font-sans"
              onClick={() => setActiveTab("inventory")}
            >
              <span>Start for Free</span>
              <span className="text-[15px]">→</span>
            </button>
            <button
              className="py-3.5 px-7 rounded-lg font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-205 flex items-center justify-center transition-all duration-200 active:scale-98 cursor-pointer text-[14px] font-sans"
              onClick={() => setActiveTab("analytics")}
            >
              See How It Works
            </button>
          </div>

          {/* Stacked circle gray badges */}
          <div className="flex items-center gap-3 mt-14">
            <div className="flex -space-x-1.5">
              <div className="w-5 h-5 rounded-full border border-white bg-slate-200"></div>
              <div className="w-5 h-5 rounded-full border border-white bg-slate-300"></div>
              <div className="w-5 h-5 rounded-full border border-white bg-slate-400"></div>
            </div>
            <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider font-sans">
              Trusted by retail leaders worldwide
            </span>
          </div>
        </div>

        {/* Right Column: Comparative SVG line/bar chart forecasting card */}
        <div className="lg:col-span-6 flex justify-center w-full relative">

          {/* Backdrop ambient soft glow */}
          <div className="absolute w-[420px] h-[420px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sky-200/10 blur-[90px] rounded-full pointer-events-none z-0"></div>

          {/* White Mockup Chassis */}
          <div className="w-full max-w-[480px] bg-white border border-slate-100 rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.04)] relative p-6.5 flex flex-col justify-between gap-5 text-left transition-all duration-300 hover:shadow-[0_35px_80px_rgba(0,0,0,0.06)] z-10">

            {/* Top link navigation */}
            <div className="flex flex-col gap-1 border-b border-slate-50 pb-3">
              <div className="text-[7.5px] font-extrabold text-slate-400 font-mono tracking-wider uppercase">
                Inventra Insights / Retail / Demand-Forecasting
              </div>

              <div className="flex justify-between items-center mt-1">
                <div>
                  <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider font-sans">Sales Forecast</span>
                  <span className="text-[12px] font-black text-slate-900 block font-sans">Actual Sales vs. AI-Predicted Demand</span>
                </div>

                {/* Visual indicator lines legend */}
                <div className="flex items-center gap-3 text-[7.5px] font-bold text-slate-400 font-sans">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1]"></span>
                    <span>Actual Sales</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]"></span>
                    <span>AI-Predicted Demand</span>
                  </div>
                </div>
              </div>
            </div>

            {/* High-Fidelity SVG Line Chart */}
            <div className="relative w-full h-24 mt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80">
                {/* Horizontal grid lines */}
                <line x1="0" y1="10" x2="300" y2="10" stroke="#f8fafc" strokeWidth="1" />
                <line x1="0" y1="30" x2="300" y2="30" stroke="#f8fafc" strokeWidth="1" />
                <line x1="0" y1="50" x2="300" y2="50" stroke="#f8fafc" strokeWidth="1" />
                <line x1="0" y1="70" x2="300" y2="70" stroke="#f8fafc" strokeWidth="1" />

                {/* Grey Wave Path (Dynamics) */}
                <path
                  d="M 0,48 C 50,48 70,55 105,55 C 135,55 150,35 165,35 C 180,35 210,68 240,68 C 270,68 285,45 300,45"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
                <circle cx="155" cy="39.5" r="2.5" fill="#cbd5e1" />

                {/* Teal Wave Path (Dynamic-Ridge-alpha) */}
                <path
                  d="M 0,45 C 50,45 70,53 105,53 C 135,53 155,22 190,22 C 220,22 240,72 255,72 C 265,72 268,40 270,40"
                  fill="none"
                  stroke="#0EA5E9"
                  strokeWidth="2.2"
                />

                {/* Peak highlight dot */}
                <circle
                  cx="175"
                  cy="30"
                  r="3.5"
                  fill="#0EA5E9"
                  className="cursor-pointer transition-all hover:scale-125"
                  onMouseEnter={() => setHoveredNode({ val: "24%", time: "12:00" })}
                  onMouseLeave={() => setHoveredNode(null)}
                />
                <circle cx="175" cy="30" r="7" fill="#0EA5E9" fillOpacity="0.12" className="pointer-events-none" />
              </svg>

              {/* Dynamic hover node tooltip inside SVG chassis */}
              {hoveredNode && (
                <div className="absolute top-[5px] left-[165px] bg-[#0f172a] text-white rounded px-2 py-0.5 text-[7.5px] font-black uppercase font-mono shadow-md z-30">
                  {hoveredNode.val} delta @ {hoveredNode.time}
                </div>
              )}
            </div>

            {/* X-Axis labels */}
            <div className="flex justify-between text-[7px] font-bold text-slate-400 font-mono px-1 border-b border-slate-50 pb-2">
              <span>10:00</span>
              <span>11:00</span>
              <span>12:00</span>
              <span>13:00</span>
              <span>14:00</span>
              <span>15:00</span>
            </div>

            {/* Beautiful Bottom Bar Chart - Shifted right to perfectly clear the AI Prediction card */}
            <div className="w-full flex justify-end h-8 mt-1">
              <div className="flex justify-between items-end w-[60%] h-full gap-2.5">
                {[30, 45, 60, 50, 75, 40, 55, 35, 65].map((height, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                    <div
                      className="w-2 bg-gradient-to-t from-[#0EA5E9]/20 to-[#0EA5E9]/80 rounded-t-sm hover:from-[#0EA5E9] hover:to-[#38bdf8] transition-all duration-200"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`Distribution index: ${height}`}
                    ></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating Glassmorphic AI PREDICTION card at bottom-left matching screenshot */}
            <div
              className="absolute bottom-[-24px] left-[-35px] bg-white border border-slate-100 rounded-xl p-3.5 max-w-[210px] shadow-[0_20px_45px_rgba(0,0,0,0.06)] flex flex-col gap-1.5 cursor-pointer z-20 text-left"
            >
              <div className="flex items-center gap-1.5">
                {/* Teal Sparkles Icon */}
                <svg className="w-3.5 h-3.5 text-[#0EA5E9]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l-.813-5.096L3.096 15 8 14.187 8.813 9l.813 5.187L15 15l-5.187.904ZM18.063 5.485 17.5 9l-.563-3.515L13.42 5l3.518-.485L17.5 1.5l.563 3.515L21.5 5l-3.438.485Z" />
                </svg>
                <span className="text-[8.5px] font-black text-slate-900 uppercase tracking-widest font-sans">AI Prediction</span>
              </div>
              <p className="text-[9.5px] font-semibold text-slate-400 leading-normal font-sans">
                Demand for <strong className="text-slate-800 font-extrabold">Category A</strong> is projected to spike by <strong className="text-[#0EA5E9] font-black">45%</strong> this week. Recommended restock: <strong className="text-slate-800 font-extrabold">Friday morning</strong>.
              </p>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}

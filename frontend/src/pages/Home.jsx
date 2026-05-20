import React from 'react';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Footer from '../components/Footer';

export default function Home({ setActiveTab }) {
  return (
    <>
      <Hero setActiveTab={setActiveTab} />

      {/* Partner Brand Logos Bar widely spaced - matching screenshot */}
      <section id="partners" className="py-8 px-6 md:px-16 lg:px-24 xl:px-32 bg-[#F8FAFC] border-y border-slate-100 w-full">
        <div className="flex flex-wrap justify-between items-center w-full max-w-7xl mx-auto text-[12.5px] tracking-[0.22em] font-black text-slate-800 uppercase font-sans gap-y-4">
          <span className="hover:text-[#0EA5E9] transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5">
            VALO STUDIO
          </span>
          <span className="hover:text-[#0EA5E9] transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5">
            AETHER COLLECTIVE
          </span>
          <span className="hover:text-[#0EA5E9] transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5">
            KAIZEN GOODS
          </span>
          <span className="hover:text-[#0EA5E9] transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5">
            NEXUS WEAR
          </span>
          <span className="hover:text-[#0EA5E9] transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5">
            VERTICE LABEL
          </span>
        </div>
      </section>

      <Features setActiveTab={setActiveTab} />

      {/* Section Divider */}
      <div className="px-6 md:px-16 lg:px-24 xl:px-32">
        <div className="max-w-7xl mx-auto">
          <hr className="border-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>
      </div>

      {/* Performance Section */}
      <section id="metrics" className="py-20 md:py-28 px-6 md:px-16 lg:px-24 xl:px-32 bg-white w-full max-w-none transition-all">
        {/* Section heading */}
        <div className="flex flex-col items-center justify-center text-center mb-16 max-w-3xl mx-auto gap-4">
          <h2 className="text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-black text-slate-900 tracking-tight leading-tight font-sans font-extrabold">
            Real Performance. Real Results.
          </h2>
          <p className="text-[18px] md:text-[19px] text-slate-700 leading-relaxed font-semibold font-sans">
            Measurable outcomes that directly impact your store's bottom line — from day one.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl mx-auto">
          {/* Stat Card 1 */}
          <div className="flex flex-col items-start text-left gap-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl p-9 hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] cursor-pointer group">
            <div className="text-[40px] font-black text-[#0EA5E9] tracking-tight">
              24/7
            </div>
            <strong className="text-[19px] font-black text-slate-900 tracking-tight font-sans">
              Real-Time Inventory Monitoring
            </strong>
            <p className="text-[15.5px] text-slate-600 leading-relaxed font-medium font-sans">
              Continuous, automated stock tracking across every product category and branch location.
            </p>
          </div>

          {/* Stat Card 2 */}
          <div className="flex flex-col items-start text-left gap-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl p-9 hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] cursor-pointer group">
            <div className="text-[40px] font-black text-[#0EA5E9] tracking-tight">
              94%
            </div>
            <strong className="text-[19px] font-black text-slate-900 tracking-tight font-sans">
              Demand Forecast Accuracy
            </strong>
            <p className="text-[15.5px] text-slate-600 leading-relaxed font-medium font-sans">
              Our AI models anticipate sales trends, preventing overstock and stockouts across your retail operation.
            </p>
          </div>

          {/* Stat Card 3 */}
          <div className="flex flex-col items-start text-left gap-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl p-9 hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] cursor-pointer group">
            <div className="text-[40px] font-black text-[#0EA5E9] tracking-tight">
              3.5x
            </div>
            <strong className="text-[19px] font-black text-slate-900 tracking-tight font-sans">
              Faster Decision-Making
            </strong>
            <p className="text-[15.5px] text-slate-600 leading-relaxed font-medium font-sans">
              Automated AI insights eliminate manual reporting cycles, so your team acts on data — not spreadsheets.
            </p>
          </div>
        </div>
      </section>

      {/* Royal Navy CTA Banner - Matching Screenshot layout */}
      <section id="cta" className="px-6 md:px-16 lg:px-24 xl:px-32 pb-20 md:pb-28 bg-white w-full max-w-none transition-all">
        <div className="w-full max-w-7xl mx-auto bg-[#0F172A] text-white rounded-[24px] py-16 px-10 md:py-24 md:px-20 text-center flex flex-col items-center justify-center relative overflow-hidden shadow-[0_40px_80px_rgba(15,23,42,0.08)]">
          {/* Subtle neon circular decoration glow inside the card */}
          <div className="absolute w-[450px] h-[450px] bg-[#0EA5E9]/10 blur-[90px] pointer-events-none rounded-full top-[-100px] left-1/2 -translate-x-1/2"></div>

          <h2 className="text-4xl md:text-[46px] font-black tracking-tight mb-5 relative z-10 max-w-3xl leading-[1.15] text-white font-sans">
            Ready to Scale Your Retail Business?
          </h2>

          <p className="text-[16px] md:text-[17.5px] text-slate-300 max-w-xl mx-auto mb-10 leading-relaxed font-semibold relative z-10 font-sans">
            Join the world's most efficient retailers. No credit card required to get started with your free trial.
          </p>

          {/* CTA Buttons side-by-side */}
          <div className="flex flex-col sm:flex-row gap-3.5 w-full max-w-[420px] justify-center relative z-10 mt-8">
            <button
              className="flex-1 bg-white hover:bg-slate-50 text-[#0F172A] text-[15px] font-bold py-4 px-7 rounded-lg transition-all duration-200 active:scale-98 cursor-pointer font-sans"
              onClick={() => setActiveTab("inventory")}
            >
              Start for Free
            </button>
            <button
              className="flex-1 bg-transparent hover:bg-white/5 border border-slate-700 hover:border-slate-500 text-white text-[15px] font-bold py-4 px-7 rounded-lg transition-all duration-200 active:scale-98 cursor-pointer font-sans"
              onClick={() => setActiveTab("analytics")}
            >
              Speak to an Expert
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

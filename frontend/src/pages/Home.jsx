import React from 'react';
import Hero from '../components/hero';
import Features from '../components/features';
import Footer from '../components/footer';

export default function Home({ setActiveTab }) {
  const partners = [
    'VALO STUDIO',
    'AETHER COLLECTIVE',
    'KAIZEN GOODS',
    'NEXUS WEAR',
    'VERTICE LABEL',
  ];

  const renderPartners = () =>
    partners.map((partner, index) => (
      <React.Fragment key={partner}>
        <span className="hover:text-[#0EA5E9] transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5 whitespace-nowrap">
          {partner}
        </span>
        {index < partners.length - 1 && (
          <span
            aria-hidden="true"
            className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400/80"
          />
        )}
      </React.Fragment>
    ));

  return (
    <>
      <Hero setActiveTab={setActiveTab} />

      {/* Partner Brand Logos Bar widely spaced - matching screenshot */}
      <section id="partners" className="relative py-6 sm:py-7 md:py-8 px-4 sm:px-6 md:px-16 lg:px-24 xl:px-32 bg-[#F8FAFC] border-y border-slate-100 w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-16 md:w-24 bg-gradient-to-r from-[#F8FAFC] via-[#F8FAFC]/90 to-transparent z-10"></div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-16 md:w-24 bg-gradient-to-l from-[#F8FAFC] via-[#F8FAFC]/90 to-transparent z-10"></div>
        <div className="partners-marquee-track flex w-max items-center gap-8 sm:gap-10 md:gap-16 text-[9px] sm:text-[10px] md:text-[12px] lg:text-[12.5px] tracking-[0.12em] sm:tracking-[0.15em] md:tracking-[0.22em] font-black text-slate-800 uppercase font-sans relative z-0">
          <div className="flex items-center gap-4 sm:gap-5 md:gap-6 shrink-0 pr-8 sm:pr-10 md:pr-16">
            {renderPartners()}
          </div>
          <span aria-hidden="true" className="inline-flex h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 shrink-0 rounded-full bg-slate-400/80 shadow-[0_0_0_4px_rgba(248,250,252,0.85)] mx-3 sm:mx-5 md:mx-7" />
          <div className="flex items-center gap-4 sm:gap-5 md:gap-6 shrink-0 pr-8 sm:pr-10 md:pr-16" aria-hidden="true">
            {renderPartners()}
          </div>
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
          <div onClick={() => setActiveTab('signup')} className="flex flex-col items-start text-left gap-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl p-9 hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] cursor-pointer group">
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
          <div onClick={() => setActiveTab('signup')} className="flex flex-col items-start text-left gap-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl p-9 hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] cursor-pointer group">
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
          <div onClick={() => setActiveTab('signup')} className="flex flex-col items-start text-left gap-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl p-9 hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] cursor-pointer group">
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
              onClick={() => setActiveTab("signup")}
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

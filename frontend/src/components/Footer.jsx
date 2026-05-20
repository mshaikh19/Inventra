import React from 'react';

export default function Footer() {
  return (
    <footer className="py-8 px-6 md:px-16 lg:px-24 xl:px-32 bg-white border-t border-slate-100 w-full font-sans">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">

        {/* Brand */}
        <span className="text-[14px] font-black tracking-tight text-slate-900">Inventra</span>

        {/* Copyright */}
        <span className="text-[12px] text-slate-400 font-semibold">
          © 2026 Inventra. All rights reserved.
        </span>

        {/* Legal links */}
        <div className="flex gap-5 text-[12px] font-semibold text-slate-400">
          <a href="#" className="hover:text-slate-800 transition-all">Privacy</a>
          <a href="#" className="hover:text-slate-800 transition-all">Terms</a>
        </div>

      </div>
    </footer>
  );
}

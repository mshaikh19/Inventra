import React from "react";

export default function FormError({ type = "error", children }) {
  if (!children) return null;

  const base = "rounded-lg px-4 py-3 text-sm font-semibold mt-4";
  const variants = {
    error: "border border-rose-200 bg-rose-50 text-rose-700",
    success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border border-slate-200 bg-slate-50 text-slate-700",
  };

  const cls = `${base} ${variants[type] || variants.error}`;
  return <div className={cls}>{children}</div>;
}

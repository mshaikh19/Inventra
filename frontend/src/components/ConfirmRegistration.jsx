import React from "react";
import { getTierDisplayName } from "../utils/dashboard";

export default function ConfirmRegistration({ form, classification }) {
  return (
    <>
      <div className="flex flex-col gap-1 mb-3">
        <h2 className="text-xl sm:text-[1.7rem] lg:text-[1.75rem] xl:text-[1.8rem] 2xl:text-[1.8rem] font-black text-slate-950 tracking-tight leading-tight">
          Confirm registration
        </h2>
        <p className="text-xs sm:text-sm md:text-[14px] lg:text-sm text-slate-600 font-medium leading-relaxed">
          Review your classification profile prior to launching your workspace.
        </p>
      </div>

      <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-4 sm:p-5 flex flex-col gap-4 text-[13px] font-semibold text-slate-650">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 border-b border-slate-100 pb-3">
          <span className="text-slate-400">Workplace Owner</span>
          <span className="text-slate-900 font-bold">
            {form.firstName} {form.lastName}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 border-b border-slate-100 pb-3">
          <span className="text-slate-400">Company Name</span>
          <span className="text-slate-900 font-bold">
            {form.company || "—"}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-slate-400">Estimated Workspace Tier</span>

          {/* show sales unit and entered sales value for clarity */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[12px] text-slate-500 mt-1">
            <div>Monthly sales unit:</div>
            <div className="font-bold text-slate-700">INR (₹) / month</div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[13px] text-slate-700 font-semibold">
            <div>Provided monthly sales</div>
            <div>
              {form.transactionsLast30d
                ? `₹${Number(form.transactionsLast30d).toLocaleString()}`
                : "—"}
            </div>
          </div>

          {classification === "large" ? (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 flex flex-col sm:flex-row items-start gap-3 mt-1 text-left">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-650">
                ✨
              </div>
              <div>
                <span className="text-indigo-950 font-extrabold text-[13.5px] block leading-none mb-1">
                  {getTierDisplayName(classification)} Tier
                </span>
                <span className="text-[11.5px] text-indigo-600 block leading-normal font-medium">
                  Uncapped store locations, dedicated AI demand models, and
                  real-time ledger pipeline.
                </span>
                <div className="text-[11px] text-indigo-600 mt-1 font-medium">
                  Best for: national chains, large distributors, marketplaces
                  with high transaction volume.
                </div>
              </div>
            </div>
          ) : classification === "medium" ? (
            <div className="bg-[#0EA5E9]/5 border border-[#0EA5E9]/15 rounded-xl p-3.5 flex flex-col sm:flex-row items-start gap-3 mt-1 text-left">
              <div className="w-8 h-8 rounded-lg bg-[#0EA5E9]/10 border border-[#0EA5E9]/15 flex items-center justify-center shrink-0 text-[#0EA5E9]">
                📈
              </div>
              <div>
                <span className="text-[#0ea5e9]-950 font-extrabold text-[13.5px] block leading-none mb-1 text-slate-900">
                  {getTierDisplayName(classification)} Tier
                </span>
                <span className="text-[11.5px] text-[#0EA5E9] block leading-normal font-semibold">
                  Support for up to 10 branches, standard AI demand pipelines,
                  and custom reports.
                </span>
                <div className="text-[11px] text-slate-700 mt-1 font-medium">
                  Best for: multi-location retailers, regional chains, and
                  fast-growing brands.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col sm:flex-row items-start gap-3 mt-1 text-left">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-150 flex items-center justify-center shrink-0 text-slate-650">
                ⚡
              </div>
              <div>
                <span className="text-slate-950 font-extrabold text-[13.5px] block leading-none mb-1">
                  {getTierDisplayName(classification)} Tier
                </span>
                <span className="text-[11.5px] text-slate-500 block leading-normal font-medium">
                  Perfect for single-branch setups. Simple demand analytics and
                  dashboard triggers.
                </span>
                <div className="text-[11px] text-slate-700 mt-1 font-medium">
                  Best for: single-location retailers, cafes, and small
                  boutiques.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

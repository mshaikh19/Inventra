import React from "react";
import CustomDropdown from "./CustomDropdown";

export default function ExecutiveProfileModal({
  isOpen,
  onClose,
  isOwner,
  userProfile,
  userSession,
  getRoleDisplayName,
  profileDraft,
  setProfileDraft,
  handleSaveProfile
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)] my-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
              Edit Profile
            </span>
            <h3 className="text-xl font-black text-slate-950 mt-1">
              Update Executive Profile
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">
              Your role will remain{" "}
              <strong>
                {isOwner
                  ? "OWNER"
                  : getRoleDisplayName(
                      userProfile?.role || userSession?.user?.role,
                    )}
              </strong>
              .
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              First Name
            </span>
            <input
              value={profileDraft.firstName}
              onChange={(e) =>
                setProfileDraft((p) => ({
                  ...p,
                  firstName: e.target.value,
                }))
              }
              placeholder="First name"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Last Name
            </span>
            <input
              value={profileDraft.lastName}
              onChange={(e) =>
                setProfileDraft((p) => ({
                  ...p,
                  lastName: e.target.value,
                }))
              }
              placeholder="Last name"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
            />
          </label>

          {isOwner && (
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Business / Company
              </span>
              <input
                value={profileDraft.businessName}
                onChange={(e) =>
                  setProfileDraft((p) => ({
                    ...p,
                    businessName: e.target.value,
                  }))
                }
                placeholder="Business name"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
              />
            </label>
          )}

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Email (login)
            </span>
            <input
              value={profileDraft.email}
              onChange={(e) =>
                setProfileDraft((p) => ({
                  ...p,
                  email: e.target.value,
                }))
              }
              placeholder="email@example.com"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
            />
          </label>

          {isOwner && (
            <>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Business Category
                </span>
                <CustomDropdown
                  value={profileDraft.businessType || "other"}
                  onChange={(val) =>
                    setProfileDraft((p) => ({ ...p, businessType: val }))
                  }
                  options={[
                    { value: "retail", label: "Retail" },
                    { value: "grocery", label: "Grocery" },
                    { value: "pharmacy", label: "Pharmacy" },
                    { value: "apparel", label: "Apparel" },
                    { value: "other", label: "Other" },
                  ]}
                  theme="emerald"
                  className="mt-1"
                  buttonClassName="font-bold"
                  up={true}
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Business Description
                </span>
                <textarea
                  value={profileDraft.businessDescription || ""}
                  onChange={(e) =>
                    setProfileDraft((p) => ({
                      ...p,
                      businessDescription: e.target.value,
                    }))
                  }
                  placeholder="Briefly describe what you sell or specialize in..."
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white resize-none h-20"
                />
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-1">
                <input
                  type="checkbox"
                  checked={!!profileDraft.isSmartStockEnabled}
                  onChange={(e) =>
                    setProfileDraft((p) => ({
                      ...p,
                      isSmartStockEnabled: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-700 select-none">
                  Enable Smart Stock Recommendations
                </span>
              </label>
            </>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 w-full rounded-xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-700 transition-all cursor-pointer"
            >
              Save Profile
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-100 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

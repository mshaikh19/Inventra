import React from "react";

function getBranchLabel(branch) {
  return branch?.branch_name || branch?.name || branch?.label || "Unknown branch";
}

function getBranchKey(branch) {
  return branch?.branch_id || branch?.id || getBranchLabel(branch);
}

export default function BranchDropdown({
  branches = [],
  selectedBranchId = "",
  onSelect,
  loading = false,
  syncing = false,
  statusText = "",
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapperRef = React.useRef(null);

  const selectedBranch = React.useMemo(
    () => branches.find((branch) => getBranchKey(branch) === selectedBranchId) || branches[0] || null,
    [branches, selectedBranchId],
  );

  const filteredBranches = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return branches;
    return branches.filter((branch) => {
      const haystack = [
        getBranchLabel(branch),
        branch?.branch_code,
        branch?.branch_id,
        branch?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [branches, query]);

  React.useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const handleSelect = (branch) => {
    setOpen(false);
    setQuery("");
    onSelect?.(branch);
  };

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0 md:min-w-[320px] md:max-w-[520px]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group relative w-full rounded-2xl border border-emerald-500/30 bg-slate-950/80 py-2 pl-5 pr-4 text-left text-slate-100 shadow-lg shadow-black/25 transition hover:border-emerald-500/50 hover:bg-slate-900/90 overflow-hidden"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-emerald-500/80">Branch</div>
            <div className="flex items-center gap-2">
              <div className="truncate text-xs font-semibold normal-case tracking-tight text-white">
                {selectedBranch ? getBranchLabel(selectedBranch) : (loading ? "Loading…" : "Select branch")}
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
                {selectedBranch?.branch_code || selectedBranch?.branch_id || "DB"}
              </span>
            </div>
          </div>

          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 transition group-hover:border-emerald-500/30 group-hover:text-emerald-400 shadow-sm shrink-0">
            <svg className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 w-[min(100vw-1.5rem,520px)] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/50 md:left-auto md:right-0">
          <div className="border-b border-slate-900 p-3">
            <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">Branch</div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search branch name or code"
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-slate-400">Loading branches from database…</div>
            ) : filteredBranches.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-400">No matching branches found.</div>
            ) : (
              filteredBranches.map((branch) => {
                const branchId = getBranchKey(branch);
                const active = branchId === selectedBranchId;
                return (
                  <button
                    key={branchId}
                    type="button"
                    onClick={() => handleSelect(branch)}
                    className={`mb-1 flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition last:mb-0 ${
                      active
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold"
                        : "border-slate-900 bg-slate-900/50 text-slate-350 hover:border-slate-700 hover:bg-slate-800/70"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-xs normal-case tracking-tight ${active ? "font-black text-emerald-400" : "font-semibold text-slate-200"}`}>
                        {getBranchLabel(branch)}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[9px]">
                        <span className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 uppercase tracking-[0.12em] text-[9px] ${
                          active
                            ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
                            : "border-slate-800 bg-slate-850 text-slate-400"
                        }`}>
                          {branch?.branch_code || branchId}
                        </span>
                        <span className={active ? "text-emerald-400/80" : "text-slate-400"}>
                          {branch?.status || "Active"}
                        </span>
                      </div>
                    </div>
                    {active ? (
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        Selected
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

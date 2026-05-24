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
    <div ref={wrapperRef} className="relative min-w-[320px] max-w-[520px]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group w-full rounded-2xl border border-slate-700/70 bg-slate-950/80 px-4 py-2 text-left text-slate-100 shadow-lg shadow-black/20 transition hover:border-sky-400/40 hover:bg-slate-900/90"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-400">Branch</div>
            <div className="flex items-center gap-2">
              <div className="truncate text-xs font-semibold normal-case tracking-tight text-white">
                {selectedBranch ? getBranchLabel(selectedBranch) : (loading ? "Loading…" : "Select branch")}
              </div>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                {selectedBranch?.branch_code || selectedBranch?.branch_id || "DB"}
              </span>
            </div>
            
          </div>

          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition group-hover:border-sky-400/40 group-hover:text-white">
            <svg className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(100vw-1.5rem,520px)] overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/50">
          <div className="border-b border-slate-800 p-3">
            <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">Branch</div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search branch name or code"
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/60"
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
                    className={`mb-1 flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition last:mb-0 ${active ? "border-sky-500/50 bg-sky-500/10" : "border-slate-800 bg-slate-900/70 hover:border-slate-600 hover:bg-slate-800"}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold normal-case tracking-tight text-white">{getBranchLabel(branch)}</div>
                      <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-400">
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 uppercase tracking-[0.12em] text-slate-300 text-[9px]">
                          {branch?.branch_code || branchId}
                        </span>
                        <span className="truncate">{branch?.status || "Active"}</span>
                      </div>
                    </div>
                    {active ? <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-300">Selected</span> : null}
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

import React from "react";

const DEFAULT_OPTIONS = [
  { value: "", label: "Select business type (optional)" },
  { value: "retail", label: "General Retail" },
  { value: "grocery", label: "Supermarket / Grocery" },
  { value: "bakery", label: "Bakery / Pastry" },
  { value: "pharmacy", label: "Pharmacy / Healthcare" },
  { value: "apparel", label: "Apparel / Fashion" },
  { value: "other", label: "Other" },
];

export default function BusinessTypeSelect({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  placeholder = "Select business type (optional)",
  className = "",
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const [openUp, setOpenUp] = React.useState(false);
  const rootRef = React.useRef(null);

  const normalized = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  React.useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  React.useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function handleKey(e) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, normalized.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = normalized[highlight];
      if (sel) {
        onChange(sel.value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const current = options.find((o) => o.value === value) || {
    label: placeholder,
    value: "",
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => {
            const willOpen = !o;
            if (willOpen && rootRef.current) {
              const rect = rootRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const spaceAbove = rect.top;
              setOpenUp(spaceBelow < 260 && spaceAbove > spaceBelow);
            }
            return willOpen;
          });
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            setOpen(true);
            e.preventDefault();
          }
        }}
        className="w-full text-left border border-slate-200 bg-slate-50/50 px-4 py-3 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-[#0EA5E9]/10 focus:border-[#0EA5E9] focus:bg-white transition-all duration-200 font-sans text-[12px] font-semibold flex items-center justify-between text-slate-700"
      >
        <span className={current.value ? "text-slate-800" : "text-slate-400"}>
          {current.label}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 w-full bg-white border border-slate-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] overflow-hidden"
          style={
            openUp
              ? { bottom: "calc(100% + 0.4rem)" }
              : { top: "calc(100% + 0.4rem)" }
          }
        >
          {/* Search input */}
          <div className="p-2.5 border-b border-slate-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search business type..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[11.5px] font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/10 focus:bg-white transition-all"
            />
          </div>

          {/* Options list */}
          <ul
            role="listbox"
            aria-activedescendant={`opt-${highlight}`}
            className="max-h-40 overflow-auto"
          >
            {normalized.map((opt, i) => (
              <li
                id={`opt-${i}`}
                key={opt.value + i}
                role="option"
                aria-selected={value === opt.value}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`
                  px-4 py-2.5 cursor-pointer flex items-center justify-between
                  text-[11.5px] font-semibold transition-colors
                  ${i === highlight ? "bg-slate-50" : "bg-white"}
                  ${value === opt.value ? "text-[#0EA5E9] font-bold" : "text-slate-700"}
                  ${i < normalized.length - 1 ? "border-b border-slate-100" : ""}
                `}
              >
                <span>{opt.label}</span>
                {value === opt.value && (
                  <span className="text-[#0EA5E9] text-xs font-black">✓</span>
                )}
              </li>
            ))}

            {normalized.length === 0 && (
              <li className="px-4 py-3 text-[11px] text-slate-400 font-semibold text-center">
                No results found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

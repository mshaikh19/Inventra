import React, { useState, useRef, useEffect } from "react";

export default function CustomDropdown({
  value,
  onChange,
  options = [], // array of { value, label }
  className = "",
  buttonClassName = "",
  theme = "sky", // 'emerald', 'sky', 'purple', 'rose', 'slate'
  size = "md", // 'sm', 'md', 'lg'
  dark = false, // Explicitly force dark theme (e.g. for POS scanner widgets)
  up = false, // If true, opens upwards instead of downwards
}) {
  const [open, setOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options[0] || null;

  // Theme-specific styles using valid standard Tailwind CSS classes
  const themeClasses = {
    sky: {
      focus: dark ? "focus:border-sky-500 focus:ring-sky-500/20" : "focus:border-sky-500 focus:ring-sky-500/10",
      activeItem: dark ? "bg-sky-500/20 text-sky-400" : "bg-sky-50 text-sky-700 font-bold",
      hoverItem: dark ? "hover:bg-slate-800" : "hover:bg-slate-50",
      accentText: dark ? "text-sky-400" : "text-sky-600",
    },
    emerald: {
      focus: dark ? "focus:border-emerald-500 focus:ring-emerald-500/20" : "focus:border-emerald-500 focus:ring-emerald-500/10",
      activeItem: dark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-700 font-bold",
      hoverItem: dark ? "hover:bg-slate-800" : "hover:bg-slate-50",
      accentText: dark ? "text-emerald-400" : "text-emerald-600",
    },
    purple: {
      focus: dark ? "focus:border-purple-500 focus:ring-purple-500/20" : "focus:border-purple-500 focus:ring-purple-500/10",
      activeItem: dark ? "bg-purple-500/20 text-purple-400" : "bg-purple-50 text-purple-700 font-bold",
      hoverItem: dark ? "hover:bg-slate-800" : "hover:bg-slate-50",
      accentText: dark ? "text-purple-400" : "text-purple-600",
    },
    rose: {
      focus: dark ? "focus:border-rose-500 focus:ring-rose-550/20" : "focus:border-rose-500 focus:ring-rose-500/10",
      activeItem: dark ? "bg-rose-500/20 text-rose-400" : "bg-rose-50 text-rose-700 font-bold",
      hoverItem: dark ? "hover:bg-slate-800" : "hover:bg-slate-50",
      accentText: dark ? "text-rose-400" : "text-rose-600",
    },
    slate: {
      focus: dark ? "focus:border-slate-500 focus:ring-slate-500/20" : "focus:border-slate-500 focus:ring-slate-500/10",
      activeItem: dark ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-900 font-bold",
      hoverItem: dark ? "hover:bg-slate-800" : "hover:bg-slate-50",
      accentText: dark ? "text-slate-100" : "text-slate-900",
    },
  };

  const selectedTheme = themeClasses[theme] || themeClasses.sky;

  const sizeClasses = {
    sm: {
      button: "px-3 py-1.5 text-xs rounded-xl",
      list: "text-xs rounded-xl",
      item: "px-3 py-1.5",
    },
    md: {
      button: "px-4 py-2.5 text-sm rounded-2xl",
      list: "text-sm rounded-2xl",
      item: "px-4 py-2.5",
    },
    lg: {
      button: "px-4 py-3 text-sm rounded-2xl font-bold",
      list: "text-sm rounded-2xl",
      item: "px-4 py-3",
    },
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  // Check if buttonClassName has custom background, text, or border classes
  const hasCustomBg = buttonClassName.includes("bg-");
  const hasCustomText = buttonClassName.includes("text-");
  const hasCustomBorder = buttonClassName.includes("border-");

  // Base background and text colors depending on explicit dark prop, dynamically omitting conflicting classes
  const buttonBg = dark
    ? `${hasCustomBg ? "" : "bg-slate-900"} ${hasCustomBorder ? "" : "border-slate-800"} ${hasCustomText ? "" : "text-slate-100"} hover:bg-slate-800 hover:border-slate-700`
    : `${hasCustomBg ? "" : "bg-white"} ${hasCustomBorder ? "" : "border-slate-300"} ${hasCustomText ? "" : "text-slate-900"} hover:bg-slate-50 hover:border-slate-300`;

  const listBg = dark
    ? "bg-slate-900 border-slate-800 text-slate-100 shadow-black/40"
    : "bg-white border-slate-300 text-slate-900 shadow-slate-200/50";

  // Dynamic positioning depending on 'up' prop
  const positionClass = up ? "bottom-full mb-1.5" : "top-full mt-1.5";

  // Inline style overrides to absolutely guarantee high contrast on light mode
  // preventing any automatic prefers-color-scheme or browser auto-dark overrides.
  const buttonStyle = !dark
    ? {
        ...(hasCustomBg ? {} : { backgroundColor: "#ffffff" }),
        ...(hasCustomText ? {} : { color: "#0f172a" }),
        ...(hasCustomBorder ? {} : { borderColor: "#cbd5e1" }),
      }
    : {};

  const listStyle = !dark
    ? {
        backgroundColor: "#ffffff",
        color: "#0f172a",
        borderColor: "#cbd5e1",
      }
    : {};

  const optionStyle = (isActive, isHovered) => {
    if (dark) return {};
    
    // Default inactive option styling:
    let style = {
      backgroundColor: "#ffffff",
      color: "#334155",
    };
    
    if (isActive) {
      const activeColors = {
        sky: { backgroundColor: "#f0f9ff", color: "#0369a1" },
        emerald: { backgroundColor: "#f0fdf4", color: "#047857" },
        purple: { backgroundColor: "#faf5ff", color: "#7e22ce" },
        rose: { backgroundColor: "#fff1f2", color: "#be123c" },
        slate: { backgroundColor: "#f1f5f9", color: "#0f172a" },
      };
      style = activeColors[theme] || activeColors.sky;
    } else if (isHovered) {
      style = {
        backgroundColor: "#f8fafc",
        color: "#0f172a",
      };
    }
    
    return style;
  };

  return (
    <div ref={containerRef} className={`relative inline-block w-full text-left ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between border outline-none transition-all duration-250 cursor-pointer focus:outline-none focus:ring-4 ${selectedSize.button} ${buttonBg} ${selectedTheme.focus} ${buttonClassName}`}
        style={buttonStyle}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : "Select..."}</span>
        <svg
          className={`h-4 w-4 transition-transform duration-250 ${open ? "rotate-180" : ""} ${dark ? "text-slate-400" : "text-slate-500"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 z-50 max-h-60 overflow-y-auto border shadow-2xl animate-fade-in ${listBg} ${selectedSize.list} ${positionClass}`}
          style={listStyle}
        >
          <div className="py-1">
            {options.map((opt, idx) => {
              const isActive = opt.value === value;
              const isHovered = hoveredIndex === idx;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between text-left cursor-pointer transition-colors duration-150 ${selectedSize.item} ${
                    isActive
                      ? selectedTheme.activeItem
                      : `${selectedTheme.hoverItem} ${dark ? "text-slate-300" : "text-slate-700"}`
                  }`}
                  style={optionStyle(isActive, isHovered)}
                >
                  <span className={isActive ? "font-bold" : "font-semibold"}>{opt.label}</span>
                  {isActive && <span className={selectedTheme.accentText}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

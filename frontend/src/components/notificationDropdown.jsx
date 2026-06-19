import React, { useEffect, useRef, useState } from "react";
import { useNotifications } from "../contexts/NotificationContext.jsx";

const TYPE_META = {
  expiry: { icon: "⏳", accent: "text-amber-600", ring: "ring-amber-100" },
  low_stock: { icon: "⚠️", accent: "text-rose-600", ring: "ring-rose-100" },
  festival: { icon: "✨", accent: "text-sky-600", ring: "ring-sky-100" },
  success: { icon: "✓", accent: "text-emerald-600", ring: "ring-emerald-100" },
  warning: { icon: "!", accent: "text-orange-600", ring: "ring-orange-100" },
  info: { icon: "•", accent: "text-slate-600", ring: "ring-slate-100" },
};

export default function NotificationDropdown({
  buttonClassName = "",
  panelClassName = "",
  title = "Notifications",
  emptyMessage = "No active notifications.",
}) {
  const { notifications, unreadCount, dismissNotification, clearNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`relative inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:bg-slate-50 hover:text-slate-900 cursor-pointer ${buttonClassName}`}
        aria-label={title}
        aria-expanded={isOpen}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1 text-[10px] font-black text-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50 ${panelClassName}`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">{title}</h4>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {unreadCount} active
              </p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearNotifications}
                className="text-[10px] font-black uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-900 cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-xs font-semibold text-slate-400">{emptyMessage}</p>
            ) : (
              notifications.slice(0, 8).map((notification) => {
                const meta = TYPE_META[notification.type] || TYPE_META.info;
                const timestamp = notification.createdAt ? new Date(notification.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

                return (
                  <div key={notification.id} className={`rounded-2xl border border-slate-100 bg-slate-50/80 p-3 ring-1 ${meta.ring}`}>
                    <div className="flex items-start gap-3">
                      <div className={`grid h-8 w-8 place-items-center rounded-xl bg-white text-sm shadow-sm ${meta.accent}`}>
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        {notification.title && <div className="text-xs font-black text-slate-900">{notification.title}</div>}
                        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-600">{notification.text}</p>
                        {timestamp && <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{timestamp}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissNotification(notification.id)}
                        className="shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-900 cursor-pointer"
                        aria-label={`Dismiss ${notification.title || notification.text}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import React from "react";

export default function FormInput({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required = false,
  className = "",
  helper = null,
}) {
  return (
    <label className="block">
      {label && <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>}
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={`w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${className}`}
      />
      {helper && <div className="mt-2 text-xs text-slate-500">{helper}</div>}
    </label>
  );
}

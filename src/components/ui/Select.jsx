import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(function Select(
  {
    label,
    options = [],
    error,
    helperText,
    className = '',
    selectClassName = '',
    ...props
  },
  ref
) {
  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>{label}</span>
          {props.required && <span className="text-rose-400 text-xs">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <select
          ref={ref}
          className={`w-full appearance-none bg-slate-900 border text-slate-100 text-sm rounded-lg pl-3 pr-9 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer disabled:opacity-50 disabled:bg-slate-800 ${
            error
              ? 'border-rose-500 focus:ring-rose-500'
              : 'border-slate-700/80 hover:border-slate-600'
          } ${selectClassName}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
              {opt.label}
            </option>
          ))}
        </select>

        <div className="absolute right-3 pointer-events-none text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {error ? (
        <span className="text-xs text-rose-400 font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-slate-400">{helperText}</span>
      ) : null}
    </div>
  );
});

export default Select;

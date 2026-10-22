import React, { forwardRef } from 'react';

const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    icon: Icon = null,
    suffix = null,
    className = '',
    inputClassName = '',
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
        {Icon && (
          <div className="absolute left-3 pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={ref}
          className={`w-full bg-slate-900 border text-slate-100 text-sm rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-800 ${
            Icon ? 'pl-9' : 'pl-3'
          } ${suffix ? 'pr-12' : 'pr-3'} py-2 ${
            error
              ? 'border-rose-500 focus:ring-rose-500'
              : 'border-slate-700/80 hover:border-slate-600'
          } ${inputClassName}`}
          {...props}
        />

        {suffix && (
          <div className="absolute right-3 text-xs text-slate-400 pointer-events-none font-medium">
            {suffix}
          </div>
        )}
      </div>

      {error ? (
        <span className="text-xs text-rose-400 font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-slate-400">{helperText}</span>
      ) : null}
    </div>
  );
});

export default Input;

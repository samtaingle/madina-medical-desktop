import React from 'react';

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
}) {
  const variants = {
    default: 'bg-slate-800 text-slate-300 border border-slate-700',
    primary: 'bg-blue-950/80 text-blue-400 border border-blue-800/80',
    success: 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80',
    warning: 'bg-amber-950/80 text-amber-400 border border-amber-800/80',
    danger: 'bg-rose-950/80 text-rose-400 border border-rose-800/80',
    purple: 'bg-purple-950/80 text-purple-400 border border-purple-800/80',
    cyan: 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/80',
  };

  const dots = {
    default: 'bg-slate-400',
    primary: 'bg-blue-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    purple: 'bg-purple-400',
    cyan: 'bg-cyan-400',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-0.5 font-semibold',
    lg: 'text-sm px-3 py-1 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full select-none ${
        variants[variant] || variants.default
      } ${sizes[size] || sizes.md} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dots[variant] || dots.default}`}
        ></span>
      )}
      {children}
    </span>
  );
}

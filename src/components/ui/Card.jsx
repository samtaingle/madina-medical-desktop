import React from 'react';

export default function Card({
  children,
  title,
  subtitle,
  action,
  className = '',
  bodyClassName = '',
}) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden flex flex-col ${className}`}>
      {(title || subtitle || action) && (
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={`p-5 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

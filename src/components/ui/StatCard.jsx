import React from 'react';

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend = null, // { value: '+12%', isPositive: true }
  color = 'blue', // 'blue', 'emerald', 'amber', 'purple', 'rose'
}) {
  const colorSchemes = {
    blue: {
      bg: 'from-blue-900/30 to-slate-900',
      border: 'border-blue-500/30',
      iconBg: 'bg-blue-600/20 text-blue-400 border border-blue-500/30',
      valueColor: 'text-white',
    },
    emerald: {
      bg: 'from-emerald-900/30 to-slate-900',
      border: 'border-emerald-500/30',
      iconBg: 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30',
      valueColor: 'text-emerald-400',
    },
    amber: {
      bg: 'from-amber-900/30 to-slate-900',
      border: 'border-amber-500/30',
      iconBg: 'bg-amber-600/20 text-amber-400 border border-amber-500/30',
      valueColor: 'text-amber-400',
    },
    purple: {
      bg: 'from-purple-900/30 to-slate-900',
      border: 'border-purple-500/30',
      iconBg: 'bg-purple-600/20 text-purple-400 border border-purple-500/30',
      valueColor: 'text-purple-300',
    },
    rose: {
      bg: 'from-rose-900/30 to-slate-900',
      border: 'border-rose-500/30',
      iconBg: 'bg-rose-600/20 text-rose-400 border border-rose-500/30',
      valueColor: 'text-rose-400',
    },
  };

  const scheme = colorSchemes[color] || colorSchemes.blue;

  return (
    <div
      className={`relative bg-gradient-to-b ${scheme.bg} border ${scheme.border} rounded-xl p-5 shadow-lg overflow-hidden flex flex-col justify-between transition-all hover:border-slate-600`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            {title}
          </span>
          <span className={`text-2xl font-black tracking-tight ${scheme.valueColor}`}>
            {value}
          </span>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${scheme.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400">{subtitle}</span>
        {trend && (
          <span
            className={`font-semibold ${
              trend.isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

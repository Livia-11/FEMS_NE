import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const colorConfig = {
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',    value: 'text-red-600' },
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600',  value: 'text-green-600' },
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   value: 'text-blue-600' },
  orange: { bg: 'bg-orange-50', icon: 'bg-orange-100 text-orange-600', value: 'text-orange-600' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', value: 'text-purple-600' },
};

const fallbackColor = colorConfig.blue;

export default function StatCard({ title, value, icon: Icon, color = 'blue', subtitle, trend }) {
  const cfg = colorConfig[color] ?? fallbackColor;

  const TrendIcon =
    trend > 0 ? TrendingUp :
    trend < 0 ? TrendingDown :
    Minus;

  const trendColor =
    trend > 0 ? 'text-green-600' :
    trend < 0 ? 'text-red-600' :
    'text-gray-400';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-start gap-4 hover:shadow-md transition-shadow">
      {/* Icon circle */}
      {Icon && (
        <div className={`shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${cfg.icon}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 truncate">{title}</p>

        <div className="flex items-end gap-2 mt-1">
          <span className={`text-3xl font-bold leading-none ${cfg.value}`}>
            {value ?? '—'}
          </span>
          {trend !== undefined && trend !== null && (
            <span className={`flex items-center gap-0.5 text-xs font-medium mb-0.5 ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              {Math.abs(trend)}%
            </span>
          )}
        </div>

        {subtitle && (
          <p className="mt-1 text-xs text-gray-400 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

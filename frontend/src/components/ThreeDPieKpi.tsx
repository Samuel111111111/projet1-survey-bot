import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type ThreeDPieKpiProps = {
  label: string;
  value: number;
  maxValue?: number; // used to compute percentage. If omitted, we render as "full" donut with value shown.
  subLabel?: string;
  className?: string;
};

/**
 * Faux "3D" donut KPI using layered pies.
 * - Bottom layer is slightly shifted down to simulate depth.
 * - Top layer uses a subtle gradient + drop shadow.
 * - Recharts animation is enabled for a light, pleasant motion.
 *
 * Note: true 3D charts are not recommended for analytics accuracy, but the visual effect is intentional for dashboard appeal.
 */
const ThreeDPieKpi: React.FC<ThreeDPieKpiProps> = ({ label, value, maxValue, subLabel, className }) => {
  const safeMax = typeof maxValue === 'number' && maxValue > 0 ? maxValue : undefined;
  const pct = safeMax ? Math.max(0, Math.min(1, value / safeMax)) : 1;

  const data = [
    { name: 'value', v: pct },
    { name: 'rest', v: 1 - pct },
  ];

  // We avoid hardcoding explicit colors; Tailwind/Theme controls the surrounding UI.
  // Recharts needs fills though—use neutral fills that look good in light/dark.
  const topFill = 'url(#kpiGrad)';
  const restFill = 'rgba(148, 163, 184, 0.35)'; // slate-ish
  const depthFill = 'rgba(15, 23, 42, 0.18)'; // subtle depth shadow

  return (
    <div className={['relative rounded-xl p-4', className || ''].join(' ')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-200">{label}</div>
          {subLabel ? <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">{subLabel}</div> : null}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        </div>
      </div>

      <div className="mt-3 h-28 w-full">
        <div className="h-full w-full animate-[kpiFloat_5s_ease-in-out_infinite]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <linearGradient id="kpiGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgba(34,197,94,0.95)" />
                  <stop offset="100%" stopColor="rgba(16,185,129,0.95)" />
                </linearGradient>
                <filter id="kpiShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.25)" />
                </filter>
              </defs>

              {/* Depth layer */}
              <Pie
                data={data}
                dataKey="v"
                cx="50%"
                cy="56%"
                innerRadius={30}
                outerRadius={46}
                startAngle={220}
                endAngle={-40}
                isAnimationActive={false}
                stroke="transparent"
              >
                <Cell key="d0" fill={depthFill} />
                <Cell key="d1" fill="rgba(148, 163, 184, 0.20)" />
              </Pie>

              {/* Top layer */}
              <Pie
                data={data}
                dataKey="v"
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={46}
                startAngle={220}
                endAngle={-40}
                animationDuration={650}
                animationEasing="ease-out"
                stroke="transparent"
                filter="url(#kpiShadow)"
              >
                <Cell key="t0" fill={topFill} />
                <Cell key="t1" fill={restFill} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {safeMax ? (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-300">
          {Math.round(pct * 100)}% • sur {safeMax}
        </div>
      ) : null}
    </div>
  );
};

export default ThreeDPieKpi;

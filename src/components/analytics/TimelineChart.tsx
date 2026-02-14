'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TimelineData {
  date: string;
  itemsAdded: number;
  totalValue: number;
}

interface TimelineChartProps {
  data: TimelineData[];
  showValue?: boolean;
}

export function TimelineChart({ data, showValue = false }: TimelineChartProps) {
  const [canRenderChart, setCanRenderChart] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCanRenderChart(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-sm font-medium text-zinc-500 mb-4">Inventory Timeline (Last 30 Days)</h3>
        <div className="h-72 flex items-center justify-center text-zinc-400">
          No data available
        </div>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  // Calculate cumulative values for trend visualization
  const chartData = data.reduce<Array<TimelineData & { dateLabel: string; cumulative: number }>>(
    (acc, item) => {
      const previousCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      acc.push({
        ...item,
        dateLabel: formatDate(item.date),
        cumulative: previousCumulative + item.itemsAdded,
      });
      return acc;
    },
    []
  );

  // Calculate summary stats for accessibility
  const totalAdded = chartData.reduce((sum, item) => sum + item.itemsAdded, 0);
  const totalValue = chartData.reduce((sum, item) => sum + item.totalValue, 0);
  const dateRange = chartData.length > 0 
    ? `from ${chartData[0].dateLabel} to ${chartData[chartData.length - 1].dateLabel}`
    : '';

  return (
    <div 
      className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
      role="figure"
      aria-labelledby="timeline-chart-title"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 id="timeline-chart-title" className="text-sm font-medium text-zinc-500">Inventory Timeline (Last 30 Days)</h3>
        <div className="flex items-center gap-4 text-xs" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            Items Added
          </span>
        </div>
      </div>
      <div 
        className="h-72"
        role="img"
        aria-label={`Inventory timeline chart ${dateRange} showing ${totalAdded} items added with total value of $${totalValue.toLocaleString()}`}
      >
        {canRenderChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorItems" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
              <XAxis 
                dataKey="dateLabel" 
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => showValue ? `$${(value / 1000).toFixed(0)}k` : String(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                labelStyle={{ color: '#9CA3AF' }}
                formatter={(value, name) => {
                  const numValue = value as number;
                  if (name === 'itemsAdded') return [`${numValue} items`, 'Added'];
                  if (name === 'totalValue') return [`$${numValue.toLocaleString()}`, 'Value'];
                  return [String(value), String(name)];
                }}
              />
              <Area
                type="monotone"
                dataKey="itemsAdded"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#colorItems)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </div>
  );
}

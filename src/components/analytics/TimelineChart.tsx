'use client';

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
  let cumulative = 0;
  const chartData = data.map(item => {
    cumulative += item.itemsAdded;
    return {
      ...item,
      dateLabel: formatDate(item.date),
      cumulative,
    };
  });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-500">Inventory Timeline (Last 30 Days)</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            Items Added
          </span>
        </div>
      </div>
      <div className="h-72">
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
              formatter={(value: number, name: string) => {
                if (name === 'itemsAdded') return [`${value} items`, 'Added'];
                if (name === 'totalValue') return [`$${value.toLocaleString()}`, 'Value'];
                return [value, name];
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
      </div>
    </div>
  );
}

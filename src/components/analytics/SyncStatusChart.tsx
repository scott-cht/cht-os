'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SyncStatusData {
  status: string;
  label: string;
  count: number;
}

interface SyncStatusChartProps {
  data: SyncStatusData[];
}

const COLORS = {
  synced: '#10B981',   // Green
  pending: '#F59E0B',  // Amber
  syncing: '#3B82F6',  // Blue
  error: '#EF4444',    // Red
  default: '#6B7280',  // Gray
};

export function SyncStatusChart({ data }: SyncStatusChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-sm font-medium text-zinc-500 mb-4">Sync Status</h3>
        <div className="h-64 flex items-center justify-center text-zinc-400">
          No data available
        </div>
      </div>
    );
  }

  const chartData = data.map(item => ({
    name: item.label,
    value: item.count,
    status: item.status,
  }));

  const totalItems = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h3 className="text-sm font-medium text-zinc-500 mb-4">Sync Status</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.status as keyof typeof COLORS] || COLORS.default}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value} items`, 'Count']}
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => <span className="text-sm text-zinc-600 dark:text-zinc-400">{String(value)}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-center text-sm text-zinc-500">
        Total: {totalItems} items
      </div>
    </div>
  );
}

'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PieChartData {
  type: string;
  label: string;
  count: number;
  value: number;
}

interface InventoryPieChartProps {
  data: PieChartData[];
  title: string;
  showValue?: boolean;
}

const COLORS = {
  new: '#10B981',      // Emerald
  trade_in: '#3B82F6', // Blue
  ex_demo: '#8B5CF6',  // Purple
  default: '#6B7280', // Gray
};

export function InventoryPieChart({ data, title, showValue = false }: InventoryPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-sm font-medium text-zinc-500 mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center text-zinc-400">
          No data available
        </div>
      </div>
    );
  }

  const chartData = data.map(item => ({
    name: item.label,
    value: showValue ? item.value : item.count,
    type: item.type,
  }));

  const formatValue = (value: number) => {
    if (showValue) {
      return `$${value.toLocaleString()}`;
    }
    return `${value} items`;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h3 className="text-sm font-medium text-zinc-500 mb-4">{title}</h3>
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
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.type as keyof typeof COLORS] || COLORS.default}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatValue(value)}
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
    </div>
  );
}

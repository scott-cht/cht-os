import { cn } from '@/lib/utils/cn';
import { Card } from './Card';

interface StatsCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: 'default' | 'emerald' | 'blue' | 'amber' | 'red' | 'purple';
  isLoading?: boolean;
  className?: string;
}

const colorStyles = {
  default: 'text-zinc-900 dark:text-white',
  emerald: 'text-emerald-600',
  blue: 'text-blue-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  purple: 'text-purple-600',
};

export function StatsCard({
  label,
  value,
  icon,
  color = 'default',
  isLoading = false,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className={cn('text-3xl font-bold mt-1', colorStyles[color])}>
            {isLoading ? '—' : value}
          </p>
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// Convenience component for inventory stats
export function InventoryStatsGrid({
  stats,
  isLoading = false,
}: {
  stats: {
    totalItems: number;
    newRetail: number;
    preOwned: number;
    pendingSync: number;
  };
  isLoading?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatsCard
        label="Total Inventory"
        value={stats.totalItems}
        isLoading={isLoading}
      />
      <StatsCard
        label="New Retail"
        value={stats.newRetail}
        color="emerald"
        isLoading={isLoading}
      />
      <StatsCard
        label="Pre-Owned"
        value={stats.preOwned}
        color="blue"
        isLoading={isLoading}
      />
      <StatsCard
        label="Pending Sync"
        value={stats.pendingSync}
        color="amber"
        isLoading={isLoading}
      />
    </div>
  );
}

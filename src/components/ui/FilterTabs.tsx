import { cn } from '@/lib/utils/cn';

interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterTabsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: FilterTabsProps<T>) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            value === option.value
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={cn(
              'ml-2 px-1.5 py-0.5 text-xs rounded',
              value === option.value
                ? 'bg-emerald-500'
                : 'bg-zinc-200 dark:bg-zinc-700'
            )}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Pre-configured filter for listing types
export function ListingTypeFilter({
  value,
  onChange,
}: {
  value: 'all' | 'new' | 'trade_in' | 'ex_demo';
  onChange: (value: 'all' | 'new' | 'trade_in' | 'ex_demo') => void;
}) {
  return (
    <FilterTabs
      options={[
        { value: 'all', label: 'All' },
        { value: 'new', label: 'New Retail' },
        { value: 'trade_in', label: 'Trade-In' },
        { value: 'ex_demo', label: 'Ex-Demo' },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

// Pre-configured filter for sync status
export function SyncStatusFilter({
  value,
  onChange,
}: {
  value: 'all' | 'pending' | 'synced' | 'error';
  onChange: (value: 'all' | 'pending' | 'synced' | 'error') => void;
}) {
  return (
    <FilterTabs
      options={[
        { value: 'all', label: 'All' },
        { value: 'pending', label: 'Pending' },
        { value: 'synced', label: 'Synced' },
        { value: 'error', label: 'Error' },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

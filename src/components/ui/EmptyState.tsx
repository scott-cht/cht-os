import { cn } from '@/lib/utils/cn';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('p-8 text-center', className)}>
      {icon && (
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-3xl">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-zinc-500 dark:text-zinc-400 mb-4 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}

// Pre-configured empty states for common scenarios
export function NoInventoryItems() {
  return (
    <EmptyState
      icon="📦"
      title="No items yet"
      description="Start by listing your first product"
      action={{ label: 'Create listing', href: '/lister' }}
    />
  );
}

export function NoSearchResults({ query }: { query?: string }) {
  return (
    <EmptyState
      icon="🔍"
      title="No results found"
      description={query ? `No items matching "${query}"` : 'Try adjusting your search or filters'}
    />
  );
}

export function NoPendingSync() {
  return (
    <EmptyState
      icon="✓"
      title="All caught up!"
      description="No items pending sync"
    />
  );
}

export function ComingSoon({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon="🚧"
      title="Coming Soon"
      description={`${feature} is under development`}
    />
  );
}

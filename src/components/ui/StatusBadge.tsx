import { cn } from '@/lib/utils/cn';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
}

// Auto-detect variant based on status string
function getVariantFromStatus(status: string): BadgeVariant {
  const lowered = status.toLowerCase();
  
  // Success states
  if (['synced', 'ready', 'complete', 'completed', 'active', 'connected', 'mint', 'excellent'].includes(lowered)) {
    return 'success';
  }
  
  // Warning states
  if (['pending', 'syncing', 'processing', 'on_demo', 'good', 'fair'].includes(lowered)) {
    return 'warning';
  }
  
  // Error states
  if (['error', 'failed', 'disconnected', 'poor', 'archived'].includes(lowered)) {
    return 'error';
  }
  
  // Info states
  if (['new', 'trade_in', 'ex_demo', 'draft'].includes(lowered)) {
    return 'info';
  }
  
  return 'neutral';
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const resolvedVariant = variant ?? getVariantFromStatus(status);
  
  // Format display text
  const displayText = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles[resolvedVariant],
        className
      )}
    >
      {displayText}
    </span>
  );
}

// Convenience components for specific use cases
export function SyncStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

export function ConditionBadge({ condition }: { condition: string }) {
  return <StatusBadge status={condition} />;
}

export function ListingTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    new: 'New Retail',
    trade_in: 'Trade-In',
    ex_demo: 'Ex-Demo',
  };
  return <StatusBadge status={labels[type] || type} variant="info" />;
}

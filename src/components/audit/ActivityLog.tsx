'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface AuditEntry {
  id: string;
  created_at: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
  summary?: string;
  user_email?: string;
}

interface ActivityLogProps {
  entityId: string;
  entityType?: string;
  limit?: number;
  className?: string;
}

const actionIcons: Record<string, { icon: string; color: string }> = {
  create: { icon: '➕', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  update: { icon: '✏️', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  delete: { icon: '🗑️', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  archive: { icon: '📦', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
  unarchive: { icon: '📤', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
  sync_started: { icon: '🔄', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  sync_completed: { icon: '✅', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  sync_failed: { icon: '❌', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  price_update: { icon: '💰', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  bulk_operation: { icon: '📋', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

export function ActivityLog({ entityId, entityType = 'inventory_item', limit = 20, className }: ActivityLogProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAuditLog() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          entity_id: entityId,
          entity_type: entityType,
          limit: limit.toString(),
        });

        const response = await fetch(`/api/audit?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch activity log');
        }

        setEntries(data.entries || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAuditLog();
  }, [entityId, entityType, limit]);

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-center text-zinc-500 dark:text-zinc-400', className)}>
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={cn('p-4 text-center text-zinc-500 dark:text-zinc-400', className)}>
        No activity recorded yet
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {entries.map((entry, index) => {
        const { icon, color } = actionIcons[entry.action] || { icon: '📝', color: 'bg-zinc-100 text-zinc-700' };
        const isLast = index === entries.length - 1;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline */}
            <div className="flex flex-col items-center">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm', color)}>
                {icon}
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700 my-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {entry.summary || formatAction(entry.action)}
              </p>
              
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {formatDate(entry.created_at)}
                {entry.user_email && ` • ${entry.user_email}`}
              </p>

              {/* Show changes if available */}
              {entry.changes && Object.keys(entry.changes).length > 0 && (
                <div className="mt-2 text-xs bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 space-y-1">
                  {Object.entries(entry.changes).slice(0, 5).map(([field, change]) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="font-medium text-zinc-600 dark:text-zinc-400">
                        {formatFieldName(field)}:
                      </span>
                      <span className="text-red-600 dark:text-red-400 line-through">
                        {formatValue(change.old)}
                      </span>
                      <span className="text-zinc-400">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatValue(change.new)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(entry.changes).length > 5 && (
                    <p className="text-zinc-500">
                      +{Object.keys(entry.changes).length - 5} more changes
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string' && value.length > 50) return value.slice(0, 50) + '...';
  return String(value);
}

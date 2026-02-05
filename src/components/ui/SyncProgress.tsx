'use client';

import { cn } from '@/lib/utils/cn';

interface SyncProgressProps {
  progress: number;
  message: string;
  isActive: boolean;
  currentPlatform?: 'shopify' | 'hubspot' | 'notion';
  platformResults?: {
    shopify?: { success: boolean; productId?: string; error?: string };
    hubspot?: { success: boolean; dealId?: string; error?: string };
    notion?: { success: boolean; pageId?: string; error?: string };
  };
  error?: string;
  className?: string;
}

const platformConfig = {
  shopify: { name: 'Shopify', color: 'emerald', icon: '🛒' },
  hubspot: { name: 'HubSpot', color: 'orange', icon: '📊' },
  notion: { name: 'Notion', color: 'zinc', icon: '📝' },
};

export function SyncProgress({
  progress,
  message,
  isActive,
  currentPlatform,
  platformResults = {},
  error,
  className,
}: SyncProgressProps) {
  if (!isActive && progress === 0 && !error) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border p-4', className, {
      'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20': isActive && !error,
      'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20': error,
      'border-zinc-200 dark:border-zinc-700': !isActive && !error,
    })}>
      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {isActive ? 'Syncing...' : error ? 'Sync Failed' : 'Sync Complete'}
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div 
            className={cn('h-full transition-all duration-300 rounded-full', {
              'bg-emerald-500': !error,
              'bg-red-500': error,
            })}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current message */}
      <p className={cn('text-sm mb-3', {
        'text-emerald-700 dark:text-emerald-400': isActive && !error,
        'text-red-700 dark:text-red-400': error,
        'text-zinc-600 dark:text-zinc-400': !isActive && !error,
      })}>
        {isActive && currentPlatform && (
          <span className="mr-2">{platformConfig[currentPlatform].icon}</span>
        )}
        {message}
      </p>

      {/* Platform status */}
      <div className="flex gap-4">
        {(['shopify', 'hubspot', 'notion'] as const).map((platform) => {
          const result = platformResults[platform];
          const config = platformConfig[platform];
          
          return (
            <div 
              key={platform}
              className={cn('flex items-center gap-2 text-sm', {
                'text-zinc-400 dark:text-zinc-600': !result,
                'text-emerald-600 dark:text-emerald-400': result?.success,
                'text-red-600 dark:text-red-400': result && !result.success,
              })}
            >
              {result?.success ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : result && !result.success ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : currentPlatform === platform ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              )}
              <span>{config.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact inline progress indicator
 */
export function SyncProgressInline({ 
  progress, 
  isActive,
  error,
}: Pick<SyncProgressProps, 'progress' | 'isActive' | 'error'>) {
  if (!isActive && progress === 0 && !error) return null;

  return (
    <div className="flex items-center gap-2">
      {isActive ? (
        <svg className="w-4 h-4 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : error ? (
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {isActive ? `${Math.round(progress)}%` : error ? 'Failed' : 'Done'}
      </span>
    </div>
  );
}

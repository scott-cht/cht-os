'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Skeleton Loading Components
 * 
 * Provides shimmer loading states for various UI elements.
 */

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component with shimmer animation
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700',
        className
      )}
    />
  );
}

/**
 * Text skeleton - mimics a line of text
 */
export function SkeletonText({ className, lines = 1 }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            'h-4',
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )} 
        />
      ))}
    </div>
  );
}

/**
 * Avatar skeleton - circular placeholder
 */
export function SkeletonAvatar({ className, size = 'md' }: SkeletonProps & { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  
  return <Skeleton className={cn('rounded-full', sizeClasses[size], className)} />;
}

/**
 * Card skeleton - placeholder for card content
 */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-4', className)}>
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Table row skeleton
 */
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-zinc-200 dark:border-zinc-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Table skeleton with header and rows
 */
export function SkeletonTable({ 
  rows = 5, 
  columns = 5,
  className,
}: SkeletonProps & { rows?: number; columns?: number }) {
  return (
    <div className={cn('rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden', className)}>
      <table className="w-full">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Stats card skeleton
 */
export function SkeletonStatsCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-xl border border-zinc-200 dark:border-zinc-700 p-4', className)}>
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

/**
 * Dashboard skeleton - complete dashboard loading state
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border-2 border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatsCard key={i} />
        ))}
      </div>
      
      {/* Content cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="text-right space-y-2">
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-5 w-12 rounded-full ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inventory list skeleton
 */
export function SkeletonInventoryList({ items = 10 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      
      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: items }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Item detail skeleton
 */
export function SkeletonItemDetail() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
      
      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Images */}
        <div className="space-y-4">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
        
        {/* Details */}
        <div className="space-y-6">
          {/* Price section */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          
          {/* Info sections */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

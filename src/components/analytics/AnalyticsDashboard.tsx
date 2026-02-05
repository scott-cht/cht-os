'use client';

import { useEffect, useState } from 'react';
import { InventoryPieChart } from './InventoryPieChart';
import { SyncStatusChart } from './SyncStatusChart';
import { TimelineChart } from './TimelineChart';
import type { AnalyticsData } from '@/app/api/analytics/route';

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch('/api/analytics');
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        console.error('Analytics error:', err);
        setError('Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 h-80">
              <div className="animate-pulse">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-4" />
                <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 h-80">
          <div className="animate-pulse">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4 mb-4" />
            <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Analytics</h2>
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl p-6 text-center">
          {error}
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Analytics</h2>
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <span>Total Value: <strong className="text-zinc-900 dark:text-white">${analytics.summary.totalValue.toLocaleString()}</strong></span>
          <span>Avg Margin: <strong className="text-zinc-900 dark:text-white">{analytics.summary.averageMargin.toFixed(1)}%</strong></span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InventoryPieChart
          data={analytics.byListingType}
          title="Inventory by Type"
        />
        <SyncStatusChart data={analytics.bySyncStatus} />
      </div>

      {/* Timeline Chart */}
      <TimelineChart data={analytics.timeline} />
    </div>
  );
}

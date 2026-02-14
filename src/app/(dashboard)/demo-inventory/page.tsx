'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { InventoryItem } from '@/types';

// Calculate days between two dates
function daysBetween(date1: string, date2: Date = new Date()): number {
  const d1 = new Date(date1);
  const diffTime = date2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Get alert level based on days on demo
function getAlertLevel(daysOnDemo: number): 'ok' | 'warning' | 'critical' {
  if (daysOnDemo >= 730) return 'critical'; // 24+ months
  if (daysOnDemo >= 365) return 'warning'; // 12+ months
  return 'ok';
}

function DemoInventoryContent() {
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get('registered') === 'true';
  
  const [demoItems, setDemoItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(justRegistered);
  const [filter, setFilter] = useState<'all' | 'warning' | 'critical'>('all');

  // Fetch demo inventory
  const fetchDemoItems = useCallback(async () => {
    try {
      const response = await fetch('/api/inventory?listing_type=ex_demo&listing_status=on_demo');
      const data = await response.json();
      setDemoItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch demo inventory:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDemoItems();
  }, [fetchDemoItems]);

  // Auto-hide success message
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => setShowSuccessMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  // Calculate stats
  const stats = {
    total: demoItems.length,
    totalValue: demoItems.reduce((sum, item) => sum + (item.cost_price || 0), 0),
    warning: demoItems.filter(item => {
      const days = item.demo_start_date ? daysBetween(item.demo_start_date) : 0;
      return getAlertLevel(days) === 'warning';
    }).length,
    critical: demoItems.filter(item => {
      const days = item.demo_start_date ? daysBetween(item.demo_start_date) : 0;
      return getAlertLevel(days) === 'critical';
    }).length,
    avgDaysOnDemo: demoItems.length > 0
      ? Math.round(demoItems.reduce((sum, item) => {
          return sum + (item.demo_start_date ? daysBetween(item.demo_start_date) : 0);
        }, 0) / demoItems.length)
      : 0,
  };

  // Filter items
  const filteredItems = demoItems.filter(item => {
    if (filter === 'all') return true;
    const days = item.demo_start_date ? daysBetween(item.demo_start_date) : 0;
    const level = getAlertLevel(days);
    if (filter === 'warning') return level === 'warning' || level === 'critical';
    if (filter === 'critical') return level === 'critical';
    return true;
  });

  return (
    <Shell 
      title="Demo Inventory" 
      subtitle="Track demonstration units before selling"
      headerActions={
        <Link href="/lister/ex-demo">
          <Button>+ Register Demo</Button>
        </Link>
      }
    >
      <div className="max-w-6xl mx-auto p-6">
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-emerald-700 dark:text-emerald-400">Demo unit registered successfully!</p>
            </div>
            <button onClick={() => setShowSuccessMessage(false)} className="text-emerald-600 hover:text-emerald-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-zinc-500">Total Demo Units</p>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-zinc-500">Total Demo Value</p>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">
              ${stats.totalValue.toLocaleString()}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-zinc-500">Avg Days on Demo</p>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">{stats.avgDaysOnDemo}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-zinc-500">Need Attention</p>
            <div className="flex items-center gap-2">
              {stats.critical > 0 && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {stats.critical} critical
                </span>
              )}
              {stats.warning > 0 && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  {stats.warning} warning
                </span>
              )}
              {stats.warning === 0 && stats.critical === 0 && (
                <span className="text-emerald-600">All good!</span>
              )}
            </div>
          </Card>
        </div>

        {/* Alerts */}
        {(stats.critical > 0 || stats.warning > 0) && (
          <div className="mb-6 space-y-3">
            {stats.critical > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      {stats.critical} item{stats.critical !== 1 ? 's' : ''} on demo for 24+ months
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-500">
                      Consider converting these to sale listings
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="ml-auto"
                    onClick={() => setFilter('critical')}
                  >
                    View Items
                  </Button>
                </div>
              </div>
            )}
            {stats.warning > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-yellow-700 dark:text-yellow-400">
                      {stats.warning} item{stats.warning !== 1 ? 's' : ''} on demo for 12+ months
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-500">
                      These units have been on demo for over a year
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="ml-auto"
                    onClick={() => setFilter('warning')}
                  >
                    View Items
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'warning'
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            12+ Months ({stats.warning + stats.critical})
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'critical'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            24+ Months ({stats.critical})
          </button>
        </div>

        {/* Demo Items Table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-zinc-500">Loading demo inventory...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-1">
                {filter === 'all' ? 'No demo units registered' : 'No items match this filter'}
              </h3>
              <p className="text-sm text-zinc-500 mb-4">
                {filter === 'all' 
                  ? 'Register demo units to track them before selling'
                  : 'Try a different filter'
                }
              </p>
              {filter === 'all' && (
                <Link href="/lister/ex-demo">
                  <Button>Register Demo Unit</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Product</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Serial</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Demo Start</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Days on Demo</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-zinc-500">Cost Price</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-zinc-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredItems.map((item) => {
                    const daysOnDemo = item.demo_start_date ? daysBetween(item.demo_start_date) : 0;
                    const alertLevel = getAlertLevel(daysOnDemo);
                    
                    return (
                      <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.registration_images?.[0] ? (
                               
                              <img 
                                src={item.registration_images[0]} 
                                alt={item.model}
                                className="w-10 h-10 rounded object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                <span className="text-zinc-400 text-xs">📦</span>
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-zinc-900 dark:text-white">{item.brand}</p>
                              <p className="text-sm text-zinc-500">{item.model}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
                            {item.serial_number || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {item.demo_start_date 
                              ? new Date(item.demo_start_date).toLocaleDateString('en-AU', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : '—'
                            }
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`
                              px-2 py-1 text-xs font-medium rounded-full
                              ${alertLevel === 'critical' 
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                                : alertLevel === 'warning'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                              }
                            `}>
                              {daysOnDemo} days
                            </span>
                            {alertLevel === 'critical' && (
                              <span className="text-red-500" title="24+ months on demo">⚠️</span>
                            )}
                            {alertLevel === 'warning' && (
                              <span className="text-yellow-500" title="12+ months on demo">⏰</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-zinc-900 dark:text-white">
                            ${(item.cost_price || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/inventory/${item.id}`}>
                            <Button size="sm" variant="secondary">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}

export default function DemoInventoryPage() {
  return (
    <Suspense fallback={
      <Shell title="Demo Inventory" subtitle="Loading...">
        <div className="p-8 text-center text-zinc-500">Loading...</div>
      </Shell>
    }>
      <DemoInventoryContent />
    </Suspense>
  );
}

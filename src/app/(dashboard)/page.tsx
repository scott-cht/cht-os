'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import type { InventoryItem } from '@/types';

interface DashboardStats {
  totalItems: number;
  newRetail: number;
  preOwned: number;
  pendingSync: number;
  syncedToday: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    newRetail: 0,
    preOwned: 0,
    pendingSync: 0,
    syncedToday: 0,
  });
  const [recentItems, setRecentItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/inventory?limit=5');
        const data = await response.json();
        
        if (data.items) {
          setRecentItems(data.items);
          
          // Calculate stats
          const items = data.items as InventoryItem[];
          setStats({
            totalItems: items.length,
            newRetail: items.filter(i => i.listing_type === 'new').length,
            preOwned: items.filter(i => i.listing_type !== 'new').length,
            pendingSync: items.filter(i => i.sync_status === 'pending').length,
            syncedToday: items.filter(i => {
              if (!i.last_synced_at) return false;
              const today = new Date().toDateString();
              return new Date(i.last_synced_at).toDateString() === today;
            }).length,
          });
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <Shell title="Dashboard" subtitle="Welcome to CHT Command Centre">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/lister/new"
          className="group p-6 bg-white dark:bg-zinc-900 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              📦
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-emerald-600">
                List New Product
              </h3>
              <p className="text-sm text-zinc-500">Scrape from retailer</p>
            </div>
          </div>
        </Link>

        <Link
          href="/lister/trade-in"
          className="group p-6 bg-white dark:bg-zinc-900 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              🔄
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-blue-600">
                Trade-In Intake
              </h3>
              <p className="text-sm text-zinc-500">Camera identification</p>
            </div>
          </div>
        </Link>

        <Link
          href="/inventory"
          className="group p-6 bg-white dark:bg-zinc-900 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              📋
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-purple-600">
                View Inventory
              </h3>
              <p className="text-sm text-zinc-500">{stats.totalItems} items</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Inventory</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white mt-1">
            {isLoading ? '—' : stats.totalItems}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">New Retail</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">
            {isLoading ? '—' : stats.newRetail}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Pre-Owned</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {isLoading ? '—' : stats.preOwned}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Pending Sync</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">
            {isLoading ? '—' : stats.pendingSync}
          </p>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Items */}
        <Card>
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Recent Items</h2>
            <Link href="/inventory" className="text-sm text-emerald-600 hover:text-emerald-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {isLoading ? (
              <div className="p-8 text-center text-zinc-500">Loading...</div>
            ) : recentItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-zinc-500 mb-4">No items yet</p>
                <Link
                  href="/lister"
                  className="text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Create your first listing
                </Link>
              </div>
            ) : (
              recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/inventory/${item.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                    item.listing_type === 'new' 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                      : 'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                    {item.listing_type === 'new' ? '📦' : '🔄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">
                      {item.brand} {item.model}
                    </p>
                    <p className="text-sm text-zinc-500 truncate">
                      {item.listing_type === 'new' ? 'New Retail' : 
                       item.listing_type === 'trade_in' ? 'Trade-In' : 'Ex-Demo'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-zinc-900 dark:text-white">
                      ${item.sale_price?.toLocaleString()}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.sync_status === 'synced' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : item.sync_status === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {item.sync_status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Sync Status */}
        <Card>
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="font-semibold text-zinc-900 dark:text-white">Integration Status</h2>
          </div>
          <div className="p-4 space-y-4">
            {/* Shopify */}
            <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.337 3.416c-.194-.066-.488.009-.637.159-.149.15-.252.47-.252.47l-.927 2.836s-1.078-.198-1.553-.198c-1.301 0-1.382 1.146-1.382 1.146l-.006 5.573c0 .19.155.342.346.342h.694c.19 0 .345-.153.345-.342v-3.03h.866v3.03c0 .19.155.342.345.342h.694c.19 0 .345-.153.345-.342v-3.03h.866v3.03c0 .19.155.342.345.342h.694c.19 0 .346-.153.346-.342V7.83s-.082-1.146-1.383-1.146c-.475 0-1.553.198-1.553.198l.928-2.836s.103-.32-.117-.63z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">Shopify</p>
                <p className="text-sm text-zinc-500">Push products as DRAFT</p>
              </div>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Ready
              </span>
            </div>

            {/* HubSpot */}
            <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.08 14.436l-.033-.082-.001-.002-.001-.002-.001-.002-.001-.001-.001-.002-2.698-6.699c-.275-.678-.803-1.227-1.47-1.527-.665-.3-1.418-.335-2.105-.098l-.003.001-11.53 3.988-.003.001c-.7.243-1.278.748-1.612 1.405-.334.656-.397 1.414-.174 2.114l.001.003 2.697 6.699.001.002.001.003c.276.679.804 1.227 1.47 1.527.666.3 1.419.335 2.106.098l.003-.001 11.53-3.988.003-.001c.7-.243 1.278-.748 1.612-1.405.335-.656.397-1.415.175-2.115l-.001-.002-.001-.003z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">HubSpot</p>
                <p className="text-sm text-zinc-500">Create deals for trade-ins</p>
              </div>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Not configured
              </span>
            </div>

            {/* Notion */}
            <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3h13A1.5 1.5 0 0 1 20 4.5v2.286a1.5 1.5 0 0 1-.645 1.233l-5.855 4.073v6.037a1.5 1.5 0 0 1-.645 1.233l-2 1.393A1.5 1.5 0 0 1 8.5 19.5v-7.621L2.645 7.805A1.5 1.5 0 0 1 2 6.572V4.5z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">Notion</p>
                <p className="text-sm text-zinc-500">Global inventory log</p>
              </div>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Not configured
              </span>
            </div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

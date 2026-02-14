'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { AnalyticsDashboard } from '@/components/analytics';
import type { InventoryItem } from '@/types';

interface DashboardStats {
  totalItems: number;
  newRetail: number;
  preOwned: number;
  pendingSync: number;
  syncedToday: number;
}

interface IntegrationStatus {
  shopify: { configured: boolean; status: string; needsAuth?: boolean };
  hubspot: { configured: boolean; status: string };
  notion: { configured: boolean; status: string };
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
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    shopify: { configured: false, status: 'not_configured' },
    hubspot: { configured: false, status: 'not_configured' },
    notion: { configured: false, status: 'not_configured' },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setError(null);
        
        // Fetch stats, recent items, and integration status in parallel
        const [statsRes, inventoryRes, integrationsRes] = await Promise.all([
          fetch('/api/inventory/stats'),
          fetch('/api/inventory?limit=5'),
          fetch('/api/integrations/status'),
        ]);
        
        // Check for failed responses
        const failedRequests: string[] = [];
        if (!statsRes.ok) failedRequests.push('stats');
        if (!inventoryRes.ok) failedRequests.push('inventory');
        if (!integrationsRes.ok) failedRequests.push('integrations');
        
        if (failedRequests.length === 3) {
          throw new Error('Unable to connect to the server. Please check your connection and try again.');
        }
        
        const statsData = await statsRes.json();
        const inventoryData = await inventoryRes.json();
        const integrationsData = await integrationsRes.json();
        
        // Set stats from dedicated endpoint (accurate counts)
        if (statsData && !statsData.error) {
          setStats({
            totalItems: statsData.totalItems,
            newRetail: statsData.newRetail,
            preOwned: statsData.preOwned,
            pendingSync: statsData.pendingSync,
            syncedToday: statsData.syncedToday,
          });
        } else if (statsData.error) {
          console.warn('Stats API error:', statsData.error);
        }
        
        // Set recent items for display
        if (inventoryData.items) {
          setRecentItems(inventoryData.items);
        }
        
        if (integrationsData && !integrationsData.error) {
          setIntegrations(integrationsData);
        }
        
        // Show partial error if some requests failed
        if (failedRequests.length > 0) {
          setError(`Some data could not be loaded (${failedRequests.join(', ')}). The dashboard may show incomplete information.`);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load dashboard data. Please try refreshing the page.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <Shell title="Dashboard" subtitle="Welcome to CHT Command Centre">
      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 text-sm text-amber-700 dark:text-amber-400 hover:underline"
            >
              Refresh Page
            </button>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-400"
            aria-label="Dismiss error"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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

      {/* Analytics Charts */}
      <div className="mb-8">
        <AnalyticsDashboard />
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
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                integrations.shopify.configured 
                  ? 'bg-green-100 dark:bg-green-900/30' 
                  : 'bg-zinc-200 dark:bg-zinc-700'
              }`}>
                <svg className={`w-6 h-6 ${integrations.shopify.configured ? 'text-green-600' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.337 3.416c-.194-.066-.488.009-.637.159-.149.15-.252.47-.252.47l-.927 2.836s-1.078-.198-1.553-.198c-1.301 0-1.382 1.146-1.382 1.146l-.006 5.573c0 .19.155.342.346.342h.694c.19 0 .345-.153.345-.342v-3.03h.866v3.03c0 .19.155.342.345.342h.694c.19 0 .345-.153.345-.342v-3.03h.866v3.03c0 .19.155.342.345.342h.694c.19 0 .346-.153.346-.342V7.83s-.082-1.146-1.383-1.146c-.475 0-1.553.198-1.553.198l.928-2.836s.103-.32-.117-.63z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">Shopify</p>
                <p className="text-sm text-zinc-500">Push products as DRAFT</p>
              </div>
              {integrations.shopify.needsAuth ? (
                <a
                  href="/api/shopify/auth"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  Connect
                </a>
              ) : (
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  integrations.shopify.configured 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {integrations.shopify.configured ? 'Ready' : 'Not configured'}
                </span>
              )}
            </div>

            {/* HubSpot */}
            <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                integrations.hubspot.configured 
                  ? 'bg-orange-100 dark:bg-orange-900/30' 
                  : 'bg-zinc-200 dark:bg-zinc-700'
              }`}>
                <svg className={`w-6 h-6 ${integrations.hubspot.configured ? 'text-orange-600' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.08 14.436l-.033-.082-.001-.002-.001-.002-.001-.002-.001-.001-.001-.002-2.698-6.699c-.275-.678-.803-1.227-1.47-1.527-.665-.3-1.418-.335-2.105-.098l-.003.001-11.53 3.988-.003.001c-.7.243-1.278.748-1.612 1.405-.334.656-.397 1.414-.174 2.114l.001.003 2.697 6.699.001.002.001.003c.276.679.804 1.227 1.47 1.527.666.3 1.419.335 2.106.098l.003-.001 11.53-3.988.003-.001c.7-.243 1.278-.748 1.612-1.405.335-.656.397-1.415.175-2.115l-.001-.002-.001-.003z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">HubSpot</p>
                <p className="text-sm text-zinc-500">Create deals for trade-ins</p>
              </div>
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                integrations.hubspot.configured 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}>
                {integrations.hubspot.configured ? 'Ready' : 'Not configured'}
              </span>
            </div>

            {/* Notion */}
            <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                integrations.notion.configured 
                  ? 'bg-zinc-800 dark:bg-zinc-200' 
                  : 'bg-zinc-200 dark:bg-zinc-700'
              }`}>
                <svg className={`w-6 h-6 ${integrations.notion.configured ? 'text-white dark:text-zinc-800' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3h13A1.5 1.5 0 0 1 20 4.5v2.286a1.5 1.5 0 0 1-.645 1.233l-5.855 4.073v6.037a1.5 1.5 0 0 1-.645 1.233l-2 1.393A1.5 1.5 0 0 1 8.5 19.5v-7.621L2.645 7.805A1.5 1.5 0 0 1 2 6.572V4.5z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">Notion</p>
                <p className="text-sm text-zinc-500">Global inventory log</p>
              </div>
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                integrations.notion.configured 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}>
                {integrations.notion.configured ? 'Ready' : 'Not configured'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { notify } from '@/lib/store/app-store';
import type { InventoryItem } from '@/types';

export default function SyncStatusPage() {
  const [pendingItems, setPendingItems] = useState<InventoryItem[]>([]);
  const [errorItems, setErrorItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchItems() {
      try {
        // Fetch pending
        const pendingRes = await fetch('/api/inventory?sync_status=pending');
        const pendingData = await pendingRes.json();
        setPendingItems(pendingData.items || []);

        // Fetch errors
        const errorRes = await fetch('/api/inventory?sync_status=error');
        const errorData = await errorRes.json();
        setErrorItems(errorData.items || []);
      } catch (error) {
        console.error('Failed to fetch sync items:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchItems();
  }, []);

  const handleSync = async (itemId: string) => {
    setSyncingId(itemId);
    try {
      const response = await fetch(`/api/inventory/${itemId}/sync`, {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        // Remove from pending list
        const item = pendingItems.find(i => i.id === itemId);
        setPendingItems(prev => prev.filter(item => item.id !== itemId));
        notify.success('Sync complete', `${item?.brand} ${item?.model} synced successfully`);
      } else {
        // Move to error list
        const item = pendingItems.find(i => i.id === itemId);
        if (item) {
          setPendingItems(prev => prev.filter(i => i.id !== itemId));
          setErrorItems(prev => [...prev, { ...item, sync_status: 'error' }]);
          notify.error('Sync failed', `${item.brand} ${item.model} failed to sync`);
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
      notify.error('Sync failed', 'Please try again');
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    const totalItems = pendingItems.length;
    notify.info('Syncing all', `Starting sync of ${totalItems} items...`);
    for (const item of pendingItems) {
      await handleSync(item.id);
    }
    notify.success('Batch sync complete', `Finished syncing ${totalItems} items`);
  };

  return (
    <Shell title="Sync Status" subtitle="Platform synchronization queue">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{pendingItems.length}</p>
              <p className="text-sm text-zinc-500">Pending Sync</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{errorItems.length}</p>
              <p className="text-sm text-zinc-500">Failed Sync</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">Ready</p>
              <p className="text-sm text-zinc-500">Integrations</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending Items */}
      <Card className="mb-6">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900 dark:text-white">Pending Sync</h2>
          {pendingItems.length > 0 && (
            <Button size="sm" onClick={handleSyncAll}>
              Sync All ({pendingItems.length})
            </Button>
          )}
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {isLoading ? (
            <div className="p-8 text-center text-zinc-500">Loading...</div>
          ) : pendingItems.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No items pending sync
            </div>
          ) : (
            pendingItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/inventory/${item.id}`} className="font-medium text-zinc-900 dark:text-white hover:text-emerald-600">
                    {item.brand} {item.model}
                  </Link>
                  <p className="text-sm text-zinc-500">
                    {item.listing_type === 'new' ? 'New' : item.listing_type === 'trade_in' ? 'Trade-In' : 'Ex-Demo'}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSync(item.id)}
                  isLoading={syncingId === item.id}
                >
                  Sync
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Error Items */}
      {errorItems.length > 0 && (
        <Card>
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="font-semibold text-red-600">Failed Sync</h2>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {errorItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/inventory/${item.id}`} className="font-medium text-zinc-900 dark:text-white hover:text-emerald-600">
                    {item.brand} {item.model}
                  </Link>
                  <p className="text-sm text-red-500 truncate">{item.sync_error || 'Unknown error'}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSync(item.id)}
                  isLoading={syncingId === item.id}
                >
                  Retry
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Shell>
  );
}

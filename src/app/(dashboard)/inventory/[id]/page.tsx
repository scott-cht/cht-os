'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { InventoryItem, ConditionGrade, SyncResult } from '@/types';

const CONDITION_GRADES: { value: ConditionGrade; label: string; color: string }[] = [
  { value: 'mint', label: 'Mint', color: 'emerald' },
  { value: 'excellent', label: 'Excellent', color: 'green' },
  { value: 'good', label: 'Good', color: 'yellow' },
  { value: 'fair', label: 'Fair', color: 'orange' },
  { value: 'poor', label: 'Poor', color: 'red' },
];

export default function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<InventoryItem>>({});

  useEffect(() => {
    async function fetchItem() {
      try {
        const response = await fetch(`/api/inventory/${id}`);
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
        } else {
          setItem(data.item);
          setFormData(data.item);
        }
      } catch (err) {
        setError('Failed to load item');
      } finally {
        setIsLoading(false);
      }
    }

    fetchItem();
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setItem(data.item);
        setFormData(data.item);
      }
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await fetch(`/api/inventory/${id}/sync`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSyncResult(data.result);
        // Refresh item to get updated sync status
        const refreshResponse = await fetch(`/api/inventory/${id}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.item) {
          setItem(refreshData.item);
          setFormData(refreshData.item);
        }
      }
    } catch (err) {
      setError('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to archive this item?')) return;

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/inventory');
      }
    } catch (err) {
      setError('Failed to delete item');
    }
  };

  if (isLoading) {
    return (
      <Shell title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      </Shell>
    );
  }

  if (error && !item) {
    return (
      <Shell title="Error">
        <Card className="p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/inventory">
            <Button>Back to Inventory</Button>
          </Link>
        </Card>
      </Shell>
    );
  }

  if (!item) return null;

  return (
    <Shell 
      title={`${item.brand} ${item.model}`}
      subtitle={item.listing_type === 'new' ? 'New Retail' : item.listing_type === 'trade_in' ? 'Trade-In' : 'Ex-Demo'}
    >
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className={`mb-6 p-4 rounded-lg ${
          syncResult.success 
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        }`}>
          <h3 className={`font-semibold mb-2 ${syncResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {syncResult.success ? 'Sync Complete' : 'Sync Partial'}
          </h3>
          <div className="space-y-1 text-sm">
            {syncResult.shopify && (
              <p className="text-emerald-600 dark:text-emerald-400">
                ✓ Shopify: <a href={syncResult.shopify.admin_url} target="_blank" rel="noopener noreferrer" className="underline">View Product</a>
              </p>
            )}
            {syncResult.hubspot && (
              <p className="text-emerald-600 dark:text-emerald-400">
                ✓ HubSpot: <a href={syncResult.hubspot.deal_url} target="_blank" rel="noopener noreferrer" className="underline">View Deal</a>
              </p>
            )}
            {syncResult.notion && (
              <p className="text-emerald-600 dark:text-emerald-400">
                ✓ Notion: <a href={syncResult.notion.page_url} target="_blank" rel="noopener noreferrer" className="underline">View Page</a>
              </p>
            )}
            {syncResult.errors?.map((err, i) => (
              <p key={i} className="text-red-600 dark:text-red-400">✗ {err}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Info */}
          <Card>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Product Information</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Brand</label>
                  <Input
                    value={formData.brand || ''}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Model</label>
                  <Input
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Serial Number</label>
                  <Input
                    value={formData.serial_number || ''}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">SKU</label>
                  <Input
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Condition (for pre-owned) */}
          {item.listing_type !== 'new' && (
            <Card>
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="font-semibold text-zinc-900 dark:text-white">Condition</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Grade</label>
                  <div className="flex gap-2">
                    {CONDITION_GRADES.map((grade) => (
                      <button
                        key={grade.value}
                        onClick={() => setFormData({ ...formData, condition_grade: grade.value })}
                        className={`flex-1 py-2 px-3 text-sm rounded-lg border-2 transition-colors ${
                          formData.condition_grade === grade.value
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        {grade.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Condition Notes</label>
                  <textarea
                    value={formData.condition_report || ''}
                    onChange={(e) => setFormData({ ...formData, condition_report: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Describe any wear, scratches, or issues..."
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Pricing */}
          <Card>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Pricing</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">RRP (AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <Input
                      type="number"
                      value={formData.rrp_aud || ''}
                      onChange={(e) => setFormData({ ...formData, rrp_aud: parseFloat(e.target.value) || undefined })}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Cost Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <Input
                      type="number"
                      value={formData.cost_price || ''}
                      onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || undefined })}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Sale Price *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <Input
                      type="number"
                      value={formData.sale_price || ''}
                      onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
              {formData.rrp_aud && formData.sale_price && formData.sale_price < formData.rrp_aud && (
                <p className="mt-2 text-sm text-emerald-600">
                  {Math.round((1 - formData.sale_price / formData.rrp_aud) * 100)}% below RRP
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card className="p-4">
            <div className="space-y-3">
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                className="w-full"
              >
                Save Changes
              </Button>
              
              <Button
                onClick={handleSync}
                isLoading={isSyncing}
                variant="secondary"
                className="w-full"
                disabled={item.sync_status === 'syncing'}
              >
                {item.sync_status === 'synced' ? 'Re-Sync' : 'Sync to Platforms'}
              </Button>

              <Button
                onClick={handleDelete}
                variant="ghost"
                className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Archive Item
              </Button>
            </div>
          </Card>

          {/* Status */}
          <Card>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Sync Status</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Status</span>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  item.sync_status === 'synced' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : item.sync_status === 'error'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {item.sync_status}
                </span>
              </div>

              {item.shopify_product_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Shopify</span>
                  <a 
                    href={`https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN}/admin/products/${item.shopify_product_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:underline"
                  >
                    View →
                  </a>
                </div>
              )}

              {item.hubspot_deal_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">HubSpot</span>
                  <span className="text-sm text-emerald-600">Connected</span>
                </div>
              )}

              {item.notion_page_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Notion</span>
                  <span className="text-sm text-emerald-600">Connected</span>
                </div>
              )}

              {item.last_synced_at && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-500">
                    Last synced: {new Date(item.last_synced_at).toLocaleString()}
                  </p>
                </div>
              )}

              {item.sync_error && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-red-600">{item.sync_error}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Meta */}
          <Card>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Details</h2>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Created</span>
                <span className="text-zinc-900 dark:text-white">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Updated</span>
                <span className="text-zinc-900 dark:text-white">
                  {new Date(item.updated_at).toLocaleDateString()}
                </span>
              </div>
              {item.rrp_source && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">RRP Source</span>
                  <span className="text-zinc-900 dark:text-white">{item.rrp_source}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

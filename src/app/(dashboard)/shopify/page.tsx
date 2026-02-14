'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { notify } from '@/lib/store/app-store';
import { postJsonWithIdempotency } from '@/lib/utils/idempotency-client';
import type { 
  ShopifyProduct, 
  EnrichmentStatus,
  ShopifyProductStatus 
} from '@/types/shopify-products';

type FilterStatus = 'all' | ShopifyProductStatus;
type FilterEnrichment = 'all' | EnrichmentStatus;
type FilterLinked = 'all' | 'linked' | 'unlinked';

export default function ShopifyProductsPage() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importLimit, setImportLimit] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterEnrichment, setFilterEnrichment] = useState<FilterEnrichment>('all');
  const [filterLinked, setFilterLinked] = useState<FilterLinked>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalLocal: 0,
    pendingEnrichment: 0,
    enriched: 0,
    synced: 0,
    linked: 0,
    unlinked: 0,
  });
  const [shopifyConfigured, setShopifyConfigured] = useState(false);

  // Fetch import status/stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/shopify/import');
      const data = await response.json();
      setShopifyConfigured(data.shopifyConfigured);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterEnrichment !== 'all') params.set('enrichmentStatus', filterEnrichment);
      if (filterLinked !== 'all') params.set('linked', filterLinked);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/shopify/products?${params.toString()}`);
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      notify.error('Error', 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterEnrichment, filterLinked, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchProducts();
  }, [fetchStats, fetchProducts]);

  // Open import dialog
  const openImportDialog = () => {
    if (!shopifyConfigured) {
      notify.error('Not configured', 'Please connect Shopify first');
      return;
    }
    setImportLimit('');
    setShowImportDialog(true);
  };

  // Import from Shopify
  const handleImport = async () => {
    setShowImportDialog(false);
    setIsImporting(true);
    
    try {
      const limit = importLimit ? parseInt(importLimit, 10) : undefined;
      const { response } = await postJsonWithIdempotency(
        '/api/shopify/import',
        {
          status: 'active',
          limit: limit && limit > 0 ? limit : undefined,
        },
        'shopify-import'
      );

      const data = await response.json();

      if (data.success) {
        const replayed = response.headers.get('idempotency-replayed') === 'true';
        notify.success(
          replayed ? 'Import replayed' : 'Import complete',
          data.message
        );
        fetchStats();
        fetchProducts();
      } else {
        if (response.status === 409 && typeof data.error === 'string') {
          notify.warning('Import in progress', data.error);
          return;
        }
        notify.error('Import failed', data.error || 'Unknown error');
      }
    } catch {
      notify.error('Import failed', 'Network error');
    } finally {
      setIsImporting(false);
    }
  };

  // Bulk enrich selected products
  const handleBulkEnrich = async () => {
    if (selectedIds.size === 0) {
      notify.warning('No selection', 'Please select products to enrich');
      return;
    }

    const selectedProducts = products.filter(p => selectedIds.has(p.id));
    let successCount = 0;
    let errorCount = 0;

    for (const product of selectedProducts) {
      try {
        const response = await fetch(`/api/shopify/products/${product.id}/enrich`, {
          method: 'POST',
        });
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    notify.success(
      'Bulk enrich complete',
      `${successCount} enriched, ${errorCount} failed`
    );
    setSelectedIds(new Set());
    fetchProducts();
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all visible
  const selectAll = () => {
    setSelectedIds(new Set(products.map(p => p.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Status badge component
  const EnrichmentBadge = ({ status }: { status: EnrichmentStatus }) => {
    const colors = {
      pending: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
      enriched: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      synced: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <Shell>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
            Shopify Products
          </h1>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-zinc-500">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkEnrich}
                >
                  Enrich Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear
                </Button>
              </>
            )}
            <Button
              variant="primary"
              onClick={openImportDialog}
              isLoading={isImporting}
              disabled={!shopifyConfigured || isImporting}
            >
              {isImporting ? 'Importing...' : 'Import from Shopify'}
            </Button>
          </div>
        </div>
        <p className="text-zinc-500 dark:text-zinc-400">
          Import and enrich your existing Shopify products with AI-optimized content.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Imported</p>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-white">
            {stats.totalLocal}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Pending Enrichment</p>
          <p className="text-2xl font-semibold text-amber-600">
            {stats.pendingEnrichment}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Enriched</p>
          <p className="text-2xl font-semibold text-blue-600">
            {stats.enriched}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Synced</p>
          <p className="text-2xl font-semibold text-emerald-600">
            {stats.synced}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Linked</p>
          <p className="text-2xl font-semibold text-purple-600">
            {stats.linked}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Unlinked</p>
          <p className="text-2xl font-semibold text-zinc-600">
            {stats.unlinked}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Enrichment Status Filter */}
          <select
            value={filterEnrichment}
            onChange={(e) => setFilterEnrichment(e.target.value as FilterEnrichment)}
            className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="enriched">Enriched</option>
            <option value="synced">Synced</option>
          </select>

          {/* Linked Filter */}
          <select
            value={filterLinked}
            onChange={(e) => setFilterLinked(e.target.value as FilterLinked)}
            className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Products</option>
            <option value="linked">Linked to Pricelist</option>
            <option value="unlinked">Unlinked</option>
          </select>

          {/* Shopify Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Shopify Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          {/* Select All Button */}
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select All
          </Button>
        </div>
      </Card>

      {/* Products Table */}
      <Card>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-zinc-500">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
              No products imported
            </h3>
            <p className="text-zinc-500 mb-4">
              Import your Shopify products to get started with AI enrichment.
            </p>
            <Button variant="primary" onClick={openImportDialog} disabled={!shopifyConfigured}>
              Import from Shopify
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === products.length && products.length > 0}
                      onChange={() => selectedIds.size === products.length ? clearSelection() : selectAll()}
                      className="rounded border-zinc-300 dark:border-zinc-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Linked
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Imported
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {products.map((product) => (
                  <tr 
                    key={product.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      selectedIds.has(product.id) ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelection(product.id)}
                        className="rounded border-zinc-300 dark:border-zinc-600"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {product.images[0] && (
                          <Image
                            src={product.images[0].url}
                            alt=""
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800"
                          />
                        )}
                        <div>
                          <Link
                            href={`/shopify/${product.id}`}
                            className="font-medium text-zinc-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400"
                          >
                            {product.title}
                          </Link>
                          <p className="text-sm text-zinc-500">{product.handle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                      {product.vendor || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <EnrichmentBadge status={product.enrichment_status} />
                    </td>
                    <td className="px-4 py-4">
                      {product.linked_inventory_id ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-500">
                      {new Date(product.last_imported_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link href={`/shopify/${product.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                Import from Shopify
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Number of products to import
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Leave empty for all products"
                  value={importLimit}
                  onChange={(e) => setImportLimit(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  For testing, try importing just 2-5 products first.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowImportDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                >
                  {importLimit ? `Import ${importLimit} Products` : 'Import All Products'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Shopify Not Configured Warning */}
      {!shopifyConfigured && (
        <div className="fixed bottom-4 right-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-medium text-amber-800 dark:text-amber-200">
                Shopify Not Connected
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Connect your Shopify store to import products.
              </p>
              <Link href="/sync" className="text-sm text-amber-600 dark:text-amber-400 hover:underline mt-2 inline-block">
                Go to Settings →
              </Link>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

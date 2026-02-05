'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ExportButton, 
  ImportDialog, 
  useImportDialog,
  FilterPresetsDropdown,
  SaveFilterDialog,
  useSaveFilterDialog,
  ComparisonModal,
  useComparisonModal,
} from '@/components/inventory';
import { PrintLabelsDialog, usePrintLabelsDialog } from '@/components/labels';
import { notify } from '@/lib/store/app-store';
import type { InventoryItem, ListingType, SyncStatus } from '@/types';
import type { InventoryFilters } from '@/types/filters';

type FilterType = 'all' | ListingType;
type FilterSync = 'all' | SyncStatus;

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterSync, setFilterSync] = useState<FilterSync>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const importDialog = useImportDialog();
  const saveFilterDialog = useSaveFilterDialog();
  const comparisonModal = useComparisonModal();
  const printLabelsDialog = usePrintLabelsDialog();

  // Max items for comparison
  const MAX_COMPARE_ITEMS = 5;

  // Toggle item selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_COMPARE_ITEMS) {
        next.add(id);
      } else {
        notify.warning('Selection limit', `You can compare up to ${MAX_COMPARE_ITEMS} items`);
        return prev;
      }
      return next;
    });
  }, []);

  // Get selected items
  const selectedItems = items.filter(item => selectedIds.has(item.id));

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Get current filters as InventoryFilters object
  const currentFilters: InventoryFilters = {
    listing_type: filterType,
    sync_status: filterSync,
    search: searchQuery || undefined,
  };

  // Apply a filter preset
  const handleApplyPreset = useCallback((filters: InventoryFilters) => {
    setFilterType((filters.listing_type as FilterType) || 'all');
    setFilterSync((filters.sync_status as FilterSync) || 'all');
    setSearchQuery(filters.search || '');
    setIsLoading(true);
  }, []);

  useEffect(() => {
    async function fetchInventory() {
      try {
        const params = new URLSearchParams();
        if (filterType !== 'all') {
          params.set('listing_type', filterType);
        }
        if (filterSync !== 'all') {
          params.set('sync_status', filterSync);
        }
        
        const response = await fetch(`/api/inventory?${params.toString()}`);
        const data = await response.json();
        
        if (data.items) {
          setItems(data.items);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchInventory();
  }, [filterType, filterSync]);

  // Filter by search query
  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.brand?.toLowerCase().includes(query) ||
      item.model?.toLowerCase().includes(query) ||
      item.serial_number?.toLowerCase().includes(query)
    );
  });

  const handleSync = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    try {
      const response = await fetch(`/api/inventory/${itemId}/sync`, {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.success) {
        // Refresh the list
        setItems(prev => prev.map(i => 
          i.id === itemId 
            ? { ...i, sync_status: 'synced' as SyncStatus }
            : i
        ));
        notify.success('Sync complete', `${item?.brand} ${item?.model} synced successfully`);
      } else {
        notify.error('Sync failed', result.error || 'Please try again');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      notify.error('Sync failed', 'Please try again');
    }
  };

  return (
    <Shell 
      title="Inventory" 
      subtitle={`${filteredItems.length} items`}
      headerActions={
        <div className="flex items-center gap-3">
          {/* Selection Actions - shows when items selected */}
          {selectedIds.size > 0 && (
            <>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={comparisonModal.open}
                className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Compare ({selectedIds.size})
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={printLabelsDialog.open}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print ({selectedIds.size})
              </Button>
            </>
          )}
          <FilterPresetsDropdown
            currentFilters={currentFilters}
            onApplyPreset={handleApplyPreset}
            onSaveClick={saveFilterDialog.open}
          />
          <Button variant="secondary" size="sm" onClick={importDialog.open}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </Button>
          <ExportButton items={filteredItems} />
          <Link href="/lister">
            <Button>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Listing
            </Button>
          </Link>
        </div>
      }
    >
      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by brand, model, or serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Type filter */}
          <div className="flex gap-2">
            {(['all', 'new', 'trade_in', 'ex_demo'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  filterType === type
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {type === 'all' ? 'All Types' : 
                 type === 'new' ? 'New' :
                 type === 'trade_in' ? 'Trade-In' : 'Ex-Demo'}
              </button>
            ))}
          </div>

          {/* Sync status filter */}
          <div className="flex gap-2">
            {(['all', 'pending', 'synced', 'error'] as FilterSync[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterSync(status)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  filterSync === status
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Items List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading inventory...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            No items found
          </h3>
          <p className="text-zinc-500 mb-6">
            {searchQuery ? 'Try a different search term' : 'Start by creating your first listing'}
          </p>
          <Link href="/lister">
            <Button>Create Listing</Button>
          </Link>
        </Card>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {/* Selection Info Bar */}
          {selectedIds.size > 0 && (
            <div className="px-6 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={clearSelection}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Table Header */}
          <div className="grid grid-cols-13 gap-4 px-6 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-500">
            <div className="col-span-1 flex items-center">
              <span className="sr-only">Select</span>
            </div>
            <div className="col-span-4">Product</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
              <div 
                key={item.id} 
                className={`grid grid-cols-13 gap-4 px-6 py-4 items-center transition-colors ${
                  isSelected 
                    ? 'bg-blue-50/50 dark:bg-blue-900/10' 
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
                }`}
              >
                {/* Checkbox */}
                <div className="col-span-1 flex items-center">
                  <label className="relative flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(item.id)}
                      className="sr-only peer"
                    />
                    <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
                      isSelected
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500'
                    }`}>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </label>
                </div>

                {/* Product */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                    item.listing_type === 'new' 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                      : 'bg-blue-100 dark:bg-blue-900/30'
                  }`}>
                    {item.listing_type === 'new' ? '📦' : '🔄'}
                  </div>
                  <div className="min-w-0">
                    <Link 
                      href={`/inventory/${item.id}`}
                      className="font-medium text-zinc-900 dark:text-white hover:text-emerald-600 truncate block"
                    >
                      {item.brand} {item.model}
                    </Link>
                    {item.serial_number && (
                      <p className="text-sm text-zinc-500 truncate">S/N: {item.serial_number}</p>
                    )}
                  </div>
                </div>

                {/* Type */}
                <div className="col-span-2">
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                    item.listing_type === 'new' 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : item.listing_type === 'trade_in'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  }`}>
                    {item.listing_type === 'new' ? 'New' :
                     item.listing_type === 'trade_in' ? 'Trade-In' : 'Ex-Demo'}
                  </span>
                </div>

                {/* Price */}
                <div className="col-span-2 text-right">
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    ${item.sale_price?.toLocaleString()}
                  </p>
                  {item.rrp_aud && item.rrp_aud !== item.sale_price && (
                    <p className="text-sm text-zinc-400 line-through">
                      ${item.rrp_aud.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                    item.sync_status === 'synced' 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : item.sync_status === 'syncing'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : item.sync_status === 'error'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {item.sync_status}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex justify-end gap-2">
                  {item.sync_status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleSync(item.id)}
                    >
                      Sync
                    </Button>
                  )}
                  <Link href={`/inventory/${item.id}`}>
                    <Button variant="secondary" size="sm">
                      Edit
                    </Button>
                  </Link>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      <ComparisonModal
        isOpen={comparisonModal.isOpen}
        onClose={comparisonModal.close}
        items={selectedItems}
        onClearSelection={clearSelection}
      />

      {/* Import Dialog */}
      <ImportDialog
        isOpen={importDialog.isOpen}
        onClose={importDialog.close}
        onSuccess={() => {
          // Trigger refetch by updating filter (will re-run useEffect)
          setFilterType('all');
          setFilterSync('all');
          setIsLoading(true);
        }}
      />

      {/* Save Filter Dialog */}
      <SaveFilterDialog
        isOpen={saveFilterDialog.isOpen}
        onClose={saveFilterDialog.close}
        filters={currentFilters}
        onSave={() => {
          // Refresh the presets list (handled internally by the dropdown)
        }}
      />

      {/* Print Labels Dialog */}
      <PrintLabelsDialog
        isOpen={printLabelsDialog.isOpen}
        onClose={printLabelsDialog.close}
        items={selectedItems}
      />
    </Shell>
  );
}

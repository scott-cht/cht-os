'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface BulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export function BulkActions({ selectedIds, onClearSelection, onActionComplete }: BulkActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(20);

  if (selectedIds.length === 0) return null;

  const handleAction = async (actionType: string, extraData?: Record<string, unknown>) => {
    setIsLoading(true);
    setAction(actionType);

    try {
      const response = await fetch('/api/inventory/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          itemIds: selectedIds,
          ...extraData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Action failed');
      }

      // Show success message
      alert(`${actionType} completed: ${result.successCount || result.updated || result.count} items`);
      
      onActionComplete();
      onClearSelection();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setIsLoading(false);
      setAction(null);
      setShowPriceModal(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          
          <div className="h-6 w-px bg-zinc-700" />
          
          {/* Sync button */}
          <button
            onClick={() => handleAction('sync')}
            disabled={isLoading}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
            )}
          >
            {isLoading && action === 'sync' ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing...
              </span>
            ) : (
              'Sync All'
            )}
          </button>

          {/* Update Prices */}
          <button
            onClick={() => setShowPriceModal(true)}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Update Prices
          </button>

          {/* Archive */}
          <button
            onClick={() => handleAction('archive')}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
          >
            {isLoading && action === 'archive' ? 'Archiving...' : 'Archive'}
          </button>

          {/* Clear selection */}
          <button
            onClick={onClearSelection}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Price Update Modal */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowPriceModal(false)}
          />
          <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Update Prices
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Discount from RRP (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
              <p className="mt-1 text-sm text-zinc-500">
                Sale price = RRP × {(100 - discountPercent) / 100}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPriceModal(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('update_prices', { discountPercent })}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Updating...' : 'Update Prices'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

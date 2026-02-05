'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import type { InventoryItem } from '@/types';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  onClearSelection: () => void;
}

// Comparison fields to display
const COMPARISON_FIELDS: { key: keyof InventoryItem | 'margin' | 'discount'; label: string; type: 'text' | 'price' | 'percent' | 'status' | 'date' }[] = [
  { key: 'brand', label: 'Brand', type: 'text' },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'sku', label: 'SKU', type: 'text' },
  { key: 'listing_type', label: 'Type', type: 'status' },
  { key: 'condition_grade', label: 'Condition', type: 'text' },
  { key: 'cost_price', label: 'Cost Price', type: 'price' },
  { key: 'rrp_aud', label: 'RRP', type: 'price' },
  { key: 'sale_price', label: 'Sale Price', type: 'price' },
  { key: 'margin', label: 'Margin %', type: 'percent' },
  { key: 'discount', label: 'Discount %', type: 'percent' },
  { key: 'sync_status', label: 'Sync Status', type: 'status' },
  { key: 'created_at', label: 'Created', type: 'date' },
];

export function ComparisonModal({ isOpen, onClose, items, onClearSelection }: ComparisonModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate derived values
  const getItemValue = (item: InventoryItem, key: string): string | number | null => {
    if (key === 'margin') {
      if (!item.cost_price || !item.sale_price) return null;
      const margin = ((item.sale_price - item.cost_price) / item.sale_price) * 100;
      return margin;
    }
    if (key === 'discount') {
      if (!item.rrp_aud || !item.sale_price) return null;
      const discount = ((item.rrp_aud - item.sale_price) / item.rrp_aud) * 100;
      return discount;
    }
    return item[key as keyof InventoryItem] as string | number | null;
  };

  // Format value for display
  const formatValue = (value: string | number | null | undefined, type: string): string => {
    if (value === null || value === undefined) return '—';
    
    switch (type) {
      case 'price':
        return `$${Number(value).toLocaleString()}`;
      case 'percent':
        return `${Number(value).toFixed(1)}%`;
      case 'date':
        return new Date(String(value)).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      case 'status':
        // Format status values
        const statusMap: Record<string, string> = {
          new: 'New Retail',
          trade_in: 'Trade-In',
          ex_demo: 'Ex-Demo',
          pending: 'Pending',
          synced: 'Synced',
          syncing: 'Syncing',
          error: 'Error',
          mint: 'Mint',
          excellent: 'Excellent',
          good: 'Good',
          fair: 'Fair',
          poor: 'Poor',
        };
        return statusMap[String(value)] || String(value);
      default:
        return String(value);
    }
  };

  // Find best value in a row
  const getBestIndex = (key: string, type: string, values: (string | number | null)[]): number | null => {
    if (type === 'price' && key === 'sale_price') {
      // Highest sale price is best
      let best = -1;
      let bestIdx = -1;
      values.forEach((v, i) => {
        if (typeof v === 'number' && v > best) {
          best = v;
          bestIdx = i;
        }
      });
      return bestIdx >= 0 ? bestIdx : null;
    }
    if (type === 'percent' && key === 'margin') {
      // Highest margin is best
      let best = -Infinity;
      let bestIdx = -1;
      values.forEach((v, i) => {
        if (typeof v === 'number' && v > best) {
          best = v;
          bestIdx = i;
        }
      });
      return bestIdx >= 0 ? bestIdx : null;
    }
    return null;
  };

  // Get status color class
  const getStatusColor = (key: string, value: string | number | null): string => {
    if (key === 'sync_status') {
      const colors: Record<string, string> = {
        synced: 'text-emerald-600 dark:text-emerald-400',
        pending: 'text-amber-600 dark:text-amber-400',
        error: 'text-red-600 dark:text-red-400',
        syncing: 'text-blue-600 dark:text-blue-400',
      };
      return colors[String(value)] || '';
    }
    if (key === 'listing_type') {
      const colors: Record<string, string> = {
        new: 'text-emerald-600 dark:text-emerald-400',
        trade_in: 'text-blue-600 dark:text-blue-400',
        ex_demo: 'text-purple-600 dark:text-purple-400',
      };
      return colors[String(value)] || '';
    }
    return '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Compare {items.length} Items
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Side-by-side comparison of selected inventory items
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comparison Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 w-40 sticky left-0 bg-zinc-50 dark:bg-zinc-800/50">
                  Field
                </th>
                {items.map((item) => (
                  <th key={item.id} className="px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-white min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {item.listing_type === 'new' ? '📦' : item.listing_type === 'trade_in' ? '🔄' : '🏷️'}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold truncate">{item.brand}</div>
                        <div className="font-normal text-zinc-500 truncate">{item.model}</div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {COMPARISON_FIELDS.map((field) => {
                const values = items.map(item => getItemValue(item, field.key));
                const bestIdx = getBestIndex(field.key, field.type, values);
                
                return (
                  <tr key={field.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-500 sticky left-0 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      {field.label}
                    </td>
                    {items.map((item, idx) => {
                      const value = values[idx];
                      const isBest = bestIdx === idx;
                      const statusColor = getStatusColor(field.key, value);
                      
                      return (
                        <td 
                          key={item.id} 
                          className={`px-4 py-3 text-sm ${
                            isBest 
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 font-semibold text-emerald-700 dark:text-emerald-400' 
                              : 'text-zinc-900 dark:text-white'
                          } ${statusColor}`}
                        >
                          <div className="flex items-center gap-2">
                            {formatValue(value, field.type)}
                            {isBest && (
                              <span className="text-emerald-500" title="Best">★</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-zinc-500">
            Comparing {items.length} of max 5 items
          </p>
          <div className="flex items-center gap-3">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => {
                onClearSelection();
                onClose();
              }}
            >
              Clear Selection
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage comparison modal state
 */
export function useComparisonModal() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}

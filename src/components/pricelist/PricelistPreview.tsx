'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import type { PricelistItem } from '@/lib/pricelist/parser';

interface PricelistPreviewProps {
  items: PricelistItem[];
  onItemsChange: (items: PricelistItem[]) => void;
  onImport: (items: PricelistItem[]) => void;
  isImporting: boolean;
}

/**
 * Editable table component for previewing and editing extracted pricelist data
 */
export function PricelistPreview({
  items,
  onItemsChange,
  onImport,
  isImporting,
}: PricelistPreviewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(items.map((_, i) => i))
  );

  const toggleItem = useCallback((index: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === items.length) {
        return new Set();
      }
      return new Set(items.map((_, i) => i));
    });
  }, [items]);

  const updateItem = useCallback((index: number, field: keyof PricelistItem, value: string | number | undefined) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  const removeItem = useCallback((index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
    setSelectedIds(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }, [items, onItemsChange]);

  const selectedItems = items.filter((_, i) => selectedIds.has(i));

  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return '-';
    return `$${price.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-center">
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">
            {items.length}
          </p>
          <p className="text-sm text-zinc-500">Total Extracted</p>
        </div>
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
          <p className="text-2xl font-bold text-emerald-600">
            {selectedIds.size}
          </p>
          <p className="text-sm text-zinc-500">Selected</p>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">
            {formatPrice(selectedItems.reduce((sum, item) => sum + item.cost_price, 0))}
          </p>
          <p className="text-sm text-zinc-500">Total Cost</p>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === items.length && items.length > 0}
                    onChange={toggleAll}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium text-zinc-500">SKU</th>
                <th className="px-3 py-3 text-left font-medium text-zinc-500">Product Name</th>
                <th className="px-3 py-3 text-left font-medium text-zinc-500">Brand</th>
                <th className="px-3 py-3 text-left font-medium text-zinc-500">Model</th>
                <th className="px-3 py-3 text-right font-medium text-zinc-500">Cost</th>
                <th className="px-3 py-3 text-right font-medium text-zinc-500">RRP</th>
                <th className="px-3 py-3 text-center font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((item, index) => (
                <tr 
                  key={index}
                  className={`
                    ${selectedIds.has(index) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}
                    hover:bg-zinc-50 dark:hover:bg-zinc-800/30
                  `}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(index)}
                      onChange={() => toggleItem(index)}
                      className="rounded border-zinc-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.sku || ''}
                      onChange={(e) => updateItem(index, 'sku', e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-emerald-500 rounded focus:outline-none text-zinc-900 dark:text-white"
                      placeholder="SKU"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.product_name}
                      onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-emerald-500 rounded focus:outline-none text-zinc-900 dark:text-white"
                      placeholder="Product name"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.brand || ''}
                      onChange={(e) => updateItem(index, 'brand', e.target.value)}
                      className="w-24 px-2 py-1 text-sm bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-emerald-500 rounded focus:outline-none text-zinc-900 dark:text-white"
                      placeholder="Brand"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.model || ''}
                      onChange={(e) => updateItem(index, 'model', e.target.value)}
                      className="w-28 px-2 py-1 text-sm bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-emerald-500 rounded focus:outline-none text-zinc-900 dark:text-white"
                      placeholder="Model"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={item.cost_price}
                      onChange={(e) => updateItem(index, 'cost_price', parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1 text-sm text-right bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-emerald-500 rounded focus:outline-none text-zinc-900 dark:text-white"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={item.rrp_aud || ''}
                      onChange={(e) => updateItem(index, 'rrp_aud', parseFloat(e.target.value) || undefined)}
                      className="w-24 px-2 py-1 text-sm text-right bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-emerald-500 rounded focus:outline-none text-zinc-900 dark:text-white"
                      min="0"
                      step="0.01"
                      placeholder="-"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => removeItem(index)}
                      className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                      title="Remove item"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          No products extracted. Try a different PDF or adjust the file.
        </div>
      )}

      {/* Import Button */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={() => onImport(selectedItems)}
            isLoading={isImporting}
            disabled={selectedIds.size === 0}
          >
            Import {selectedIds.size} Product{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}

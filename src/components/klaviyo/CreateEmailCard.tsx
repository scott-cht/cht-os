'use client';

import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils/cn';
import type { InventoryPickerItem, StyleGuide } from '@/components/klaviyo/types';

interface CreateEmailCardProps {
  maxPickerSelect: number;
  intentPresets: string[];
  pickerSearch: string;
  pickerListingType: string;
  pickerLoading: boolean;
  pickerItems: InventoryPickerItem[];
  pickerTotal: number;
  pickerOffset: number;
  selectedInventoryIds: string[];
  styleGuides: StyleGuide[];
  selectedGuideIds: Set<string>;
  filterListingTypes: string[];
  filterLimit: number;
  intent: string;
  generating: boolean;
  onPickerSearchChange: (value: string) => void;
  onPickerSearchEnter: () => void;
  onPickerListingTypeChange: (value: string) => void;
  onLoadProducts: () => void;
  onQuickFill: () => void;
  onClearPickerSelection: () => void;
  onTogglePickerProduct: (id: string) => void;
  onPrevPickerPage: () => void;
  onNextPickerPage: () => void;
  onSelectedGuideChange: (guideId: string) => void;
  onToggleFilterListingType: (listingType: string) => void;
  onFilterLimitChange: (value: number) => void;
  onIntentChange: (value: string) => void;
  onGenerate: () => void;
}

export function CreateEmailCard({
  maxPickerSelect,
  intentPresets,
  pickerSearch,
  pickerListingType,
  pickerLoading,
  pickerItems,
  pickerTotal,
  pickerOffset,
  selectedInventoryIds,
  styleGuides,
  selectedGuideIds,
  filterListingTypes,
  filterLimit,
  intent,
  generating,
  onPickerSearchChange,
  onPickerSearchEnter,
  onPickerListingTypeChange,
  onLoadProducts,
  onQuickFill,
  onClearPickerSelection,
  onTogglePickerProduct,
  onPrevPickerPage,
  onNextPickerPage,
  onSelectedGuideChange,
  onToggleFilterListingType,
  onFilterLimitChange,
  onIntentChange,
  onGenerate,
}: CreateEmailCardProps) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Create email</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        Select products (or use filter), pick a style guide, and set intent to generate email copy.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Select products</label>
          <p className="text-xs text-zinc-500 mb-2">Choose specific items (max {maxPickerSelect}). If none selected, generation uses the filter below.</p>
          <div className="flex flex-wrap gap-2 mb-2">
            <Input
              placeholder="Search brand, model, title..."
              value={pickerSearch}
              onChange={(e) => onPickerSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onPickerSearchEnter()}
              className="max-w-xs"
            />
            <select
              value={pickerListingType}
              onChange={(e) => onPickerListingTypeChange(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2 text-sm"
            >
              <option value="all">All types</option>
              <option value="new">new</option>
              <option value="trade_in">trade_in</option>
              <option value="ex_demo">ex_demo</option>
            </select>
            <Button variant="secondary" size="sm" onClick={onLoadProducts}>
              Load products
            </Button>
            <Button variant="secondary" size="sm" onClick={onQuickFill} disabled={pickerLoading}>
              Quick fill from filter
            </Button>
            {selectedInventoryIds.length > 0 && (
              <>
                <span className="text-sm text-zinc-600 dark:text-zinc-400 self-center">Selected: {selectedInventoryIds.length}</span>
                <Button variant="ghost" size="sm" onClick={onClearPickerSelection}>Clear</Button>
              </>
            )}
          </div>
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
            {pickerLoading ? (
              <p className="p-4 text-sm text-zinc-500">Loading…</p>
            ) : pickerItems.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">Click &quot;Load products&quot; or search to see inventory.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pickerItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <input
                      type="checkbox"
                      checked={selectedInventoryIds.includes(item.id)}
                      onChange={() => onTogglePickerProduct(item.id)}
                      disabled={!selectedInventoryIds.includes(item.id) && selectedInventoryIds.length >= maxPickerSelect}
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 flex-shrink-0"
                    />
                    <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                      {item.image_urls?.[0] ? (
                        <Image src={item.image_urls[0]} alt="" width={40} height={40} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-zinc-400 flex items-center justify-center h-full">-</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white truncate block">{item.brand} {item.model}</span>
                      <span className="text-xs text-zinc-500 truncate block">{item.title ?? item.listing_type}</span>
                    </div>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex-shrink-0">${item.sale_price}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {pickerTotal > pickerItems.length && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={pickerOffset === 0 || pickerLoading}
                onClick={onPrevPickerPage}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pickerOffset + 20 >= pickerTotal || pickerLoading}
                onClick={onNextPickerPage}
              >
                Next
              </Button>
              <span className="text-xs text-zinc-500 self-center">
                {pickerOffset + 1}-{Math.min(pickerOffset + 20, pickerTotal)} of {pickerTotal}
              </span>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Style guide</label>
          <p className="text-xs text-zinc-500 mb-1">Choose one style guide; the generated email will match its look and structure.</p>
          <select
            value={Array.from(selectedGuideIds)[0] ?? ''}
            onChange={(e) => onSelectedGuideChange(e.target.value)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white px-3 py-2 text-sm w-full max-w-md"
          >
            <option value="">Choose style guide</option>
            {styleGuides.map((g) => (
              <option key={g.id} value={g.id}>{g.name}{g.subject ? ` - ${g.subject.slice(0, 40)}${g.subject.length > 40 ? '...' : ''}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Inventory filter</label>
          <p className="text-xs text-zinc-500 mb-1">Used when no products are selected above, and for &quot;Quick fill from filter&quot;.</p>
          <div className="flex flex-wrap gap-3 items-center">
            {['new', 'trade_in', 'ex_demo'].map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={filterListingTypes.includes(t)}
                  onChange={() => onToggleFilterListingType(t)}
                />
                {t.replace('_', ' ')}
              </label>
            ))}
            <span className="text-zinc-500 text-sm">Limit</span>
            <Input
              type="number"
              min={1}
              max={50}
              value={filterLimit}
              onChange={(e) => onFilterLimitChange(Number(e.target.value) || 10)}
              className="w-20"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Intent</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {intentPresets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onIntentChange(p)}
                className={cn(
                  'text-sm px-2 py-1 rounded border',
                  intent === p
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                    : 'border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <Input
            placeholder="e.g. New arrivals from CHT this week"
            value={intent}
            onChange={(e) => onIntentChange(e.target.value)}
          />
        </div>
        <Button onClick={onGenerate} disabled={generating || selectedGuideIds.size === 0}>
          {generating ? 'Generating…' : 'Generate email'}
        </Button>
      </div>
    </Card>
  );
}

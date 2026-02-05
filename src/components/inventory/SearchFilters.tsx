'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { Input } from '@/components/ui/Input';

export interface FilterState {
  search: string;
  listing_type: 'all' | 'new' | 'trade_in' | 'ex_demo';
  sync_status: 'all' | 'pending' | 'syncing' | 'synced' | 'error';
  condition_grade: 'all' | 'mint' | 'excellent' | 'good' | 'fair' | 'poor';
  minPrice: string;
  maxPrice: string;
  dateFrom: string;
  dateTo: string;
  sortBy: 'created_at' | 'brand' | 'model' | 'sale_price';
  sortOrder: 'asc' | 'desc';
}

interface SearchFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onSearch: () => void;
  isLoading?: boolean;
}

const defaultFilters: FilterState = {
  search: '',
  listing_type: 'all',
  sync_status: 'all',
  condition_grade: 'all',
  minPrice: '',
  maxPrice: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
};

export function SearchFilters({ filters, onChange, onSearch, isLoading }: SearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  }, [filters, onChange]);

  const resetFilters = () => {
    onChange(defaultFilters);
  };

  const hasActiveFilters = 
    filters.listing_type !== 'all' ||
    filters.sync_status !== 'all' ||
    filters.condition_grade !== 'all' ||
    filters.minPrice !== '' ||
    filters.maxPrice !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  // Debounced search on typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.search) onSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
      {/* Main search bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search by brand, model, serial number..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400"
          />
        </div>
        
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            'px-4 py-2.5 rounded-lg border font-medium text-sm transition-colors',
            showAdvanced || hasActiveFilters
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
              : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          )}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </span>
        </button>

        <button
          onClick={onSearch}
          disabled={isLoading}
          className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        {/* Listing Type */}
        <select
          value={filters.listing_type}
          onChange={(e) => updateFilter('listing_type', e.target.value as FilterState['listing_type'])}
          className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
        >
          <option value="all">All Types</option>
          <option value="new">New Retail</option>
          <option value="trade_in">Trade-In</option>
          <option value="ex_demo">Ex-Demo</option>
        </select>

        {/* Sync Status */}
        <select
          value={filters.sync_status}
          onChange={(e) => updateFilter('sync_status', e.target.value as FilterState['sync_status'])}
          className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="syncing">Syncing</option>
          <option value="synced">Synced</option>
          <option value="error">Error</option>
        </select>

        {/* Sort */}
        <select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('-') as [FilterState['sortBy'], FilterState['sortOrder']];
            onChange({ ...filters, sortBy, sortOrder });
          }}
          className="px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
        >
          <option value="created_at-desc">Newest First</option>
          <option value="created_at-asc">Oldest First</option>
          <option value="brand-asc">Brand A-Z</option>
          <option value="brand-desc">Brand Z-A</option>
          <option value="sale_price-asc">Price: Low to High</option>
          <option value="sale_price-desc">Price: High to Low</option>
        </select>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Condition Grade */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Condition
              </label>
              <select
                value={filters.condition_grade}
                onChange={(e) => updateFilter('condition_grade', e.target.value as FilterState['condition_grade'])}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              >
                <option value="all">All Conditions</option>
                <option value="mint">Mint</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Price Range (AUD)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => updateFilter('minPrice', e.target.value)}
                  placeholder="Min"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => updateFilter('maxPrice', e.target.value)}
                  placeholder="Max"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Date Added
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Reset button */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { defaultFilters };
export type { FilterState };

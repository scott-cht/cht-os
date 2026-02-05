/**
 * Filter Types and Presets
 * Supports saved filter views for inventory management
 */

import type { ListingType, SyncStatus, ConditionGrade, ListingStatus } from './inventory';

/**
 * Filter state for inventory queries
 */
export interface InventoryFilters {
  listing_type?: ListingType | 'all';
  sync_status?: SyncStatus | 'all';
  listing_status?: ListingStatus | 'all';
  condition_grade?: ConditionGrade | 'all';
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'created_at' | 'updated_at' | 'sale_price' | 'brand' | 'model';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Saved filter preset
 */
export interface FilterPreset {
  id: string;
  name: string;
  icon: string;
  filters: InventoryFilters;
  isSystem: boolean;  // Built-in presets cannot be edited/deleted
  createdAt: string;
  updatedAt: string;
}

/**
 * Preset input for creating/updating
 */
export interface FilterPresetInput {
  name: string;
  icon?: string;
  filters: InventoryFilters;
}

/**
 * Available icons for filter presets
 */
export const PRESET_ICONS = [
  '📋', '📦', '🔄', '🏷️', '💰', '📅', '⚡', '⭐', '🔍', '📊',
  '✅', '❌', '⏳', '🎯', '💎', '🛒', '📈', '🔔', '💡', '🏆',
] as const;

/**
 * Default system presets
 */
export const SYSTEM_PRESETS: Omit<FilterPreset, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'pending-sync',
    name: 'Pending Sync',
    icon: '⏳',
    filters: { sync_status: 'pending' },
    isSystem: true,
  },
  {
    id: 'sync-errors',
    name: 'Sync Errors',
    icon: '❌',
    filters: { sync_status: 'error' },
    isSystem: true,
  },
  {
    id: 'trade-ins',
    name: 'Trade-Ins',
    icon: '🔄',
    filters: { listing_type: 'trade_in' },
    isSystem: true,
  },
  {
    id: 'ex-demo',
    name: 'Ex-Demo Units',
    icon: '🏷️',
    filters: { listing_type: 'ex_demo' },
    isSystem: true,
  },
  {
    id: 'new-retail',
    name: 'New Retail',
    icon: '📦',
    filters: { listing_type: 'new' },
    isSystem: true,
  },
  {
    id: 'on-demo',
    name: 'On Demo',
    icon: '🎯',
    filters: { listing_status: 'on_demo' },
    isSystem: true,
  },
  {
    id: 'synced',
    name: 'Synced to Shopify',
    icon: '✅',
    filters: { sync_status: 'synced' },
    isSystem: true,
  },
];

/**
 * Check if filters are empty/default
 */
export function areFiltersEmpty(filters: InventoryFilters): boolean {
  return (
    (!filters.listing_type || filters.listing_type === 'all') &&
    (!filters.sync_status || filters.sync_status === 'all') &&
    (!filters.listing_status || filters.listing_status === 'all') &&
    (!filters.condition_grade || filters.condition_grade === 'all') &&
    !filters.search &&
    !filters.minPrice &&
    !filters.maxPrice &&
    !filters.dateFrom &&
    !filters.dateTo
  );
}

/**
 * Compare two filter objects for equality
 */
export function areFiltersEqual(a: InventoryFilters, b: InventoryFilters): boolean {
  const normalize = (val: unknown) => (val === 'all' || val === undefined || val === null || val === '' ? undefined : val);
  
  return (
    normalize(a.listing_type) === normalize(b.listing_type) &&
    normalize(a.sync_status) === normalize(b.sync_status) &&
    normalize(a.listing_status) === normalize(b.listing_status) &&
    normalize(a.condition_grade) === normalize(b.condition_grade) &&
    normalize(a.search) === normalize(b.search) &&
    normalize(a.minPrice) === normalize(b.minPrice) &&
    normalize(a.maxPrice) === normalize(b.maxPrice) &&
    normalize(a.dateFrom) === normalize(b.dateFrom) &&
    normalize(a.dateTo) === normalize(b.dateTo)
  );
}

/**
 * Generate a human-readable description of filters
 */
export function describeFilters(filters: InventoryFilters): string {
  const parts: string[] = [];
  
  if (filters.listing_type && filters.listing_type !== 'all') {
    const labels: Record<string, string> = { new: 'New', trade_in: 'Trade-In', ex_demo: 'Ex-Demo' };
    parts.push(labels[filters.listing_type] || filters.listing_type);
  }
  
  if (filters.sync_status && filters.sync_status !== 'all') {
    const labels: Record<string, string> = { pending: 'Pending', synced: 'Synced', error: 'Errors', syncing: 'Syncing' };
    parts.push(labels[filters.sync_status] || filters.sync_status);
  }
  
  if (filters.listing_status && filters.listing_status !== 'all') {
    const labels: Record<string, string> = { on_demo: 'On Demo', ready_to_sell: 'Ready', sold: 'Sold' };
    parts.push(labels[filters.listing_status] || filters.listing_status);
  }
  
  if (filters.minPrice || filters.maxPrice) {
    if (filters.minPrice && filters.maxPrice) {
      parts.push(`$${filters.minPrice}-$${filters.maxPrice}`);
    } else if (filters.minPrice) {
      parts.push(`>$${filters.minPrice}`);
    } else {
      parts.push(`<$${filters.maxPrice}`);
    }
  }
  
  if (filters.search) {
    parts.push(`"${filters.search}"`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'All items';
}

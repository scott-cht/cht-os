/**
 * CSV/Excel Export Utilities
 * 
 * Utilities for exporting inventory data to CSV format.
 */

import type { InventoryItem } from '@/types';

interface ExportColumn {
  key: keyof InventoryItem | string;
  header: string;
  transform?: (value: unknown, item: InventoryItem) => string;
}

/**
 * Default export columns for inventory items
 */
export const INVENTORY_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'id', header: 'ID' },
  { key: 'brand', header: 'Brand' },
  { key: 'model', header: 'Model' },
  { key: 'sku', header: 'SKU' },
  { key: 'serial_number', header: 'Serial Number' },
  { key: 'listing_type', header: 'Listing Type', transform: (v) => formatListingType(v as string) },
  { key: 'listing_status', header: 'Listing Status', transform: (v) => formatListingStatus(v as string) },
  { key: 'condition_grade', header: 'Condition', transform: (v) => v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '' },
  { key: 'cost_price', header: 'Cost Price (AUD)', transform: (v) => formatCurrency(v as number | null) },
  { key: 'rrp_aud', header: 'RRP (AUD)', transform: (v) => formatCurrency(v as number | null) },
  { key: 'sale_price', header: 'Sale Price (AUD)', transform: (v) => formatCurrency(v as number | null) },
  { key: 'discount_percent', header: 'Discount %', transform: (v) => v ? `${Math.round(Number(v) * 100)}%` : '' },
  { key: 'margin', header: 'Margin', transform: (_, item) => calculateMargin(item) },
  { key: 'sync_status', header: 'Sync Status', transform: (v) => formatSyncStatus(v as string) },
  { key: 'shopify_product_id', header: 'Shopify ID' },
  { key: 'created_at', header: 'Created', transform: (v) => formatDate(v as string) },
  { key: 'updated_at', header: 'Updated', transform: (v) => formatDate(v as string) },
];

/**
 * Compact export columns (fewer fields)
 */
export const INVENTORY_EXPORT_COLUMNS_COMPACT: ExportColumn[] = [
  { key: 'brand', header: 'Brand' },
  { key: 'model', header: 'Model' },
  { key: 'sku', header: 'SKU' },
  { key: 'listing_type', header: 'Type', transform: (v) => formatListingType(v as string) },
  { key: 'condition_grade', header: 'Condition' },
  { key: 'sale_price', header: 'Sale Price', transform: (v) => formatCurrency(v as number | null) },
  { key: 'sync_status', header: 'Sync Status', transform: (v) => formatSyncStatus(v as string) },
];

function formatListingType(type: string | null): string {
  if (!type) return '';
  switch (type) {
    case 'new': return 'New Retail';
    case 'trade_in': return 'Trade-In';
    case 'ex_demo': return 'Ex-Demo';
    default: return type;
  }
}

function formatListingStatus(status: string | null): string {
  if (!status) return '';
  switch (status) {
    case 'draft': return 'Draft';
    case 'ready_to_sell': return 'Ready to Sell';
    case 'on_demo': return 'On Demo';
    case 'active': return 'Active';
    case 'sold': return 'Sold';
    case 'archived': return 'Archived';
    default: return status;
  }
}

function formatSyncStatus(status: string | null): string {
  if (!status) return '';
  switch (status) {
    case 'pending': return 'Pending';
    case 'syncing': return 'Syncing';
    case 'synced': return 'Synced';
    case 'error': return 'Error';
    default: return status;
  }
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '';
  return `$${value.toFixed(2)}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '';
  }
}

function calculateMargin(item: InventoryItem): string {
  if (!item.cost_price || !item.sale_price || item.sale_price === 0) return '';
  const margin = ((item.sale_price - item.cost_price) / item.sale_price) * 100;
  return `${margin.toFixed(1)}%`;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => 
    current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, 
    obj as Record<string, unknown>
  );
}

/**
 * Escape CSV value (handle quotes, commas, newlines)
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  
  const stringValue = String(value);
  
  // Check if escaping is needed
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    // Escape double quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Convert inventory items to CSV string
 */
export function inventoryToCSV(
  items: InventoryItem[],
  columns: ExportColumn[] = INVENTORY_EXPORT_COLUMNS
): string {
  // Build header row
  const headerRow = columns.map(col => escapeCSV(col.header)).join(',');
  
  // Build data rows
  const dataRows = items.map(item => {
    return columns.map(col => {
      const rawValue = getNestedValue(item as Record<string, unknown>, col.key);
      const value = col.transform ? col.transform(rawValue, item) : rawValue;
      return escapeCSV(value);
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file in browser
 */
export function downloadCSV(csv: string, filename: string = 'inventory-export.csv'): void {
  // Add BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Generate timestamped filename
 */
export function generateExportFilename(prefix: string = 'inventory'): string {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  return `${prefix}-${date}-${time}.csv`;
}

/**
 * Export options interface
 */
export interface ExportOptions {
  columns?: ExportColumn[];
  filename?: string;
  compact?: boolean;
}

/**
 * Export inventory items with options
 */
export function exportInventory(
  items: InventoryItem[],
  options: ExportOptions = {}
): void {
  const {
    columns = options.compact ? INVENTORY_EXPORT_COLUMNS_COMPACT : INVENTORY_EXPORT_COLUMNS,
    filename = generateExportFilename(),
  } = options;
  
  const csv = inventoryToCSV(items, columns);
  downloadCSV(csv, filename);
}

/**
 * Export filtered items summary for accounting
 */
export const ACCOUNTING_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'brand', header: 'Brand' },
  { key: 'model', header: 'Model' },
  { key: 'sku', header: 'SKU' },
  { key: 'cost_price', header: 'Cost (ex GST)', transform: (v) => v ? (Number(v) / 1.1).toFixed(2) : '' },
  { key: 'cost_price', header: 'Cost GST', transform: (v) => v ? (Number(v) - Number(v) / 1.1).toFixed(2) : '' },
  { key: 'cost_price', header: 'Cost (inc GST)', transform: (v) => formatCurrency(v as number | null) },
  { key: 'sale_price', header: 'Sale (ex GST)', transform: (v) => v ? (Number(v) / 1.1).toFixed(2) : '' },
  { key: 'sale_price', header: 'Sale GST', transform: (v) => v ? (Number(v) - Number(v) / 1.1).toFixed(2) : '' },
  { key: 'sale_price', header: 'Sale (inc GST)', transform: (v) => formatCurrency(v as number | null) },
  { key: 'margin', header: 'Profit', transform: (_, item) => {
    if (!item.cost_price || !item.sale_price) return '';
    return formatCurrency(item.sale_price - item.cost_price);
  }},
];

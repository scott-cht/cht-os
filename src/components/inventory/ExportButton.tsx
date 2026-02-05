'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  exportInventory, 
  INVENTORY_EXPORT_COLUMNS, 
  INVENTORY_EXPORT_COLUMNS_COMPACT,
  ACCOUNTING_EXPORT_COLUMNS,
  generateExportFilename 
} from '@/lib/utils/export';
import { notify } from '@/lib/store/app-store';
import type { InventoryItem } from '@/types';

interface ExportButtonProps {
  /** Items to export */
  items: InventoryItem[];
  /** Whether export is disabled */
  disabled?: boolean;
  /** Button variant */
  variant?: 'default' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Show dropdown with export options */
  showOptions?: boolean;
  /** Class name */
  className?: string;
}

type ExportType = 'full' | 'compact' | 'accounting';

/**
 * Export Button Component
 * 
 * Provides options to export inventory data to CSV format.
 */
export function ExportButton({
  items,
  disabled = false,
  variant = 'secondary',
  size = 'sm',
  showOptions = true,
  className,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = (type: ExportType) => {
    if (items.length === 0) {
      notify.warning('No items to export', 'Please select or filter items first');
      setIsOpen(false);
      return;
    }

    setIsExporting(true);
    
    try {
      let columns;
      let prefix = 'inventory';
      
      switch (type) {
        case 'compact':
          columns = INVENTORY_EXPORT_COLUMNS_COMPACT;
          prefix = 'inventory-compact';
          break;
        case 'accounting':
          columns = ACCOUNTING_EXPORT_COLUMNS;
          prefix = 'inventory-accounting';
          break;
        default:
          columns = INVENTORY_EXPORT_COLUMNS;
      }
      
      exportInventory(items, {
        columns,
        filename: generateExportFilename(prefix),
      });
      
      notify.success('Export complete', `Exported ${items.length} items to CSV`);
    } catch (error) {
      notify.error('Export failed', 'Failed to generate CSV file');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  if (!showOptions) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleExport('full')}
        disabled={disabled || items.length === 0}
        isLoading={isExporting}
        className={className}
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export CSV
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || items.length === 0}
        isLoading={isExporting}
        className={className}
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
        <svg className={`w-4 h-4 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-20">
            <div className="p-2">
              <p className="px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Export {items.length} item{items.length !== 1 ? 's' : ''} as:
              </p>
              
              <button
                onClick={() => handleExport('full')}
                className="w-full px-3 py-2 text-left text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">Full Export</p>
                  <p className="text-xs text-zinc-500">All fields, detailed data</p>
                </div>
              </button>
              
              <button
                onClick={() => handleExport('compact')}
                className="w-full px-3 py-2 text-left text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">Compact Export</p>
                  <p className="text-xs text-zinc-500">Essential fields only</p>
                </div>
              </button>
              
              <button
                onClick={() => handleExport('accounting')}
                className="w-full px-3 py-2 text-left text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">Accounting Export</p>
                  <p className="text-xs text-zinc-500">GST breakdown, profit</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PricelistPreview } from '@/components/pricelist';
import { notify } from '@/lib/store/app-store';
import type { PricelistItem } from '@/lib/pricelist/parser';

type PageStep = 'upload' | 'processing' | 'preview' | 'importing' | 'complete';

/**
 * PDF Pricelist Import Page
 * 
 * Allows users to upload a PDF pricelist, extract product data using AI,
 * review/edit the extracted data, and import to inventory.
 */
export default function PricelistImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<PageStep>('upload');
  const [items, setItems] = useState<PricelistItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.includes('pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    setError(null);
    setStep('processing');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/pricelist/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse PDF');
      }

      setItems(data.items || []);
      setWarnings(data.warnings || []);
      setPageCount(data.pageCount || 0);
      setStep('preview');
      
      if (data.items?.length > 0) {
        notify.success(
          'PDF processed',
          `Extracted ${data.items.length} products from ${data.pageCount} page${data.pageCount !== 1 ? 's' : ''}`
        );
      } else {
        notify.warning('No products found', 'Could not extract any product data from the PDF');
      }
    } catch (err) {
      console.error('PDF parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process PDF');
      setStep('upload');
      notify.error('Processing failed', err instanceof Error ? err.message : 'Please try again');
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleImport = useCallback(async (selectedItems: PricelistItem[]) => {
    if (selectedItems.length === 0) return;

    setIsImporting(true);
    setStep('importing');
    setError(null);

    try {
      // Convert pricelist items to inventory items
      const inventoryItems = selectedItems.map(item => ({
        brand: item.brand || item.product_name.split(' ')[0] || 'Unknown',
        model: item.model || item.product_name,
        sku: item.sku || null,
        listing_type: 'new' as const,
        listing_status: 'pending_enrichment' as const,
        cost_price: item.cost_price,
        rrp_aud: item.rrp_aud || null,
        sale_price: item.rrp_aud || item.cost_price * 1.3, // Default 30% markup if no RRP
        sync_status: 'pending' as const,
        image_urls: [],
        specifications: {},
      }));

      const response = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: inventoryItems.map(item => ({ data: item })) }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Import failed');
      }

      setImportedCount(data.imported || selectedItems.length);
      setStep('complete');
      notify.success('Import complete', `${data.imported} products imported successfully`);
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
      notify.error('Import failed', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setStep('upload');
    setItems([]);
    setWarnings([]);
    setPageCount(0);
    setError(null);
    setImportedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <Shell 
      title="Import from Pricelist" 
      subtitle="Upload a supplier PDF pricelist to bulk import products"
    >
      <div className="max-w-4xl mx-auto py-6">
        {/* Back Link */}
        <Link 
          href="/lister"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Listing Options
        </Link>

        <Card className="p-6">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📋</span>
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                  Upload Supplier Pricelist
                </h2>
                <p className="text-zinc-500 max-w-md mx-auto">
                  Upload a PDF pricelist from your supplier. Our AI will extract product codes, 
                  names, and prices automatically.
                </p>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                  ${isDragging 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                    : 'border-zinc-300 dark:border-zinc-600 hover:border-emerald-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }
                `}
              >
                <svg className="w-12 h-12 mx-auto text-zinc-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                  {isDragging ? 'Drop your PDF here' : 'Drag & drop your PDF here or click to browse'}
                </p>
                <p className="text-sm text-zinc-500">
                  PDF files only, max 20MB, up to 10 pages
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Tips */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                  Tips for best results:
                </h3>
                <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    Use clean, tabular pricelists with clear column headers
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    Ensure SKU/product codes, names, and prices are visible
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    PDFs with text-based content work better than scanned images
                  </li>
                </ul>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg className="w-8 h-8 text-emerald-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                Processing PDF...
              </h3>
              <p className="text-zinc-500">
                AI is extracting product data from your pricelist
              </p>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                    Review Extracted Products
                  </h2>
                  <p className="text-sm text-zinc-500">
                    {pageCount} page{pageCount !== 1 ? 's' : ''} processed. Edit data below before importing.
                  </p>
                </div>
                <Button variant="secondary" onClick={handleReset}>
                  Upload Different PDF
                </Button>
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
                    Extraction Warnings
                  </h3>
                  <ul className="space-y-1 text-sm text-amber-600 dark:text-amber-400 max-h-32 overflow-y-auto">
                    {warnings.slice(0, 10).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                    {warnings.length > 10 && (
                      <li>... and {warnings.length - 10} more warnings</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <PricelistPreview
                items={items}
                onItemsChange={setItems}
                onImport={handleImport}
                isImporting={isImporting}
              />

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg className="w-8 h-8 text-emerald-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                Importing Products...
              </h3>
              <p className="text-zinc-500">
                Creating inventory items from your pricelist
              </p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                Import Complete!
              </h3>
              <p className="text-zinc-500 mb-6">
                Successfully imported {importedCount} product{importedCount !== 1 ? 's' : ''} to inventory
              </p>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-1">
                  Next Steps
                </h4>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Your products have been imported with &quot;Pending Enrichment&quot; status. 
                  Go to Inventory and use the &quot;Enrich&quot; button on each item to add 
                  images and descriptions by searching Australian retailers.
                </p>
              </div>

              <div className="flex justify-center gap-3">
                <Button variant="secondary" onClick={handleReset}>
                  Import More
                </Button>
                <Button onClick={() => router.push('/inventory?status=pending_enrichment')}>
                  View Imported Items
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}

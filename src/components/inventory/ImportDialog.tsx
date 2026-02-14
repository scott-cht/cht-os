'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { notify } from '@/lib/store/app-store';
import { parseCSV, validateImport, downloadCSVTemplate, type ImportValidationResult } from '@/lib/utils/import';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

/**
 * Batch Import Dialog
 * 
 * Allows users to import multiple inventory items from a CSV file.
 */
export function ImportDialog({ isOpen, onClose, onSuccess }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processCSV = useCallback((text: string) => {
    setError(null);
    try {
      const rows = parseCSV(text);
      const result = validateImport(rows);
      setValidation(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCSV(text);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, [processCSV]);

  const handleImport = useCallback(async () => {
    if (!validation || validation.validCount === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      const response = await fetch('/api/inventory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validation.valid,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Import failed', data.error);
      } else {
        setImportResult({
          imported: data.imported,
          warnings: data.warnings || [],
        });
        setStep('complete');
        notify.success('Import complete', `Imported ${data.imported} items`);
      }
    } catch {
      setError('Failed to import items');
      notify.error('Import failed', 'Please try again');
    } finally {
      setIsImporting(false);
    }
  }, [validation]);

  const handleClose = useCallback(() => {
    // Reset state
    setValidation(null);
    setImportResult(null);
    setError(null);
    setStep('upload');
    
    if (importResult && importResult.imported > 0) {
      onSuccess();
    }
    onClose();
  }, [importResult, onClose, onSuccess]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processCSV(text);
      };
      reader.readAsText(file);
    } else {
      setError('Please drop a CSV file');
    }
  }, [processCSV]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Dialog */}
      <Card className="relative z-10 w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Import Inventory
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-500 transition-colors"
              >
                <svg className="w-12 h-12 mx-auto text-zinc-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                  Drop your CSV file here or click to browse
                </p>
                <p className="text-sm text-zinc-500">
                  Maximum 100 items per import
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Template download */}
              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    Need a template?
                  </p>
                  <p className="text-sm text-zinc-500">
                    Download our CSV template with required columns
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    downloadCSVTemplate();
                    notify.success('Template downloaded', 'Fill in your data and upload');
                  }}
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Template
                </Button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && validation && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {validation.totalRows}
                  </p>
                  <p className="text-sm text-zinc-500">Total Rows</p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {validation.validCount}
                  </p>
                  <p className="text-sm text-zinc-500">Valid</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {validation.invalidCount}
                  </p>
                  <p className="text-sm text-zinc-500">Invalid</p>
                </div>
              </div>

              {/* Errors */}
              {validation.invalid.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h3 className="font-medium text-red-700 dark:text-red-400 mb-2">
                    Validation Errors
                  </h3>
                  <ul className="space-y-1 text-sm text-red-600 dark:text-red-400 max-h-32 overflow-y-auto">
                    {validation.invalid.slice(0, 10).map((row, i) => (
                      <li key={i}>
                        Row {row.rowNumber}: {row.errors.join(', ')}
                      </li>
                    ))}
                    {validation.invalid.length > 10 && (
                      <li className="text-red-500">
                        ... and {validation.invalid.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h3 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
                    Warnings
                  </h3>
                  <ul className="space-y-1 text-sm text-amber-600 dark:text-amber-400 max-h-32 overflow-y-auto">
                    {validation.warnings.slice(0, 10).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                    {validation.warnings.length > 10 && (
                      <li>... and {validation.warnings.length - 10} more warnings</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              {validation.valid.length > 0 && (
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2 text-sm font-medium text-zinc-500">
                    Preview (first 5 items)
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {validation.valid.slice(0, 5).map((row, i) => (
                      <div key={i} className="px-4 py-2 text-sm">
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {row.data.brand} {row.data.model}
                        </span>
                        <span className="text-zinc-500 ml-2">
                          ${row.data.sale_price?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && importResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                Import Complete!
              </h3>
              <p className="text-zinc-500 mb-6">
                Successfully imported {importResult.imported} items
              </p>
              
              {importResult.warnings.length > 0 && (
                <div className="text-left bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
                    Import Warnings
                  </h4>
                  <ul className="space-y-1 text-sm text-amber-600 dark:text-amber-400">
                    {importResult.warnings.slice(0, 5).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-3">
          {step === 'upload' && (
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setStep('upload');
                  setValidation(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                isLoading={isImporting}
                disabled={validation?.validCount === 0}
              >
                Import {validation?.validCount || 0} Items
              </Button>
            </>
          )}
          
          {step === 'complete' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * Hook for managing import dialog state
 */
export function useImportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}

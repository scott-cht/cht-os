'use client';

import { useState, useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/Button';
import { LabelPreview } from './LabelPreview';
import type { InventoryItem } from '@/types';
import type { LabelContent, LabelTemplate } from '@/lib/labels/templates';
import { LABEL_TEMPLATES, DEFAULT_LABEL_CONTENT, getTemplateList } from '@/lib/labels/templates';

interface PrintLabelsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
}

export function PrintLabelsDialog({ isOpen, onClose, items }: PrintLabelsDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate>(LABEL_TEMPLATES.standard);
  const [content, setContent] = useState<LabelContent>(DEFAULT_LABEL_CONTENT);
  const [copies, setCopies] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Labels - ${items.map(i => `${i.brand} ${i.model}`).join(', ')}`,
    onAfterPrint: () => {
      // Optionally close after printing
    },
  });

  const toggleContent = useCallback((key: keyof LabelContent) => {
    setContent(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  if (!isOpen) return null;

  const templates = getTemplateList();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Print Labels
            </h2>
            <p className="text-sm text-zinc-500">
              {items.length} item{items.length !== 1 ? 's' : ''} selected
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

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Settings Panel */}
            <div className="space-y-6">
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Label Template
                </label>
                <select
                  value={selectedTemplate.id}
                  onChange={(e) => setSelectedTemplate(LABEL_TEMPLATES[e.target.value])}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Copies */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Copies per item
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={copies}
                  onChange={(e) => setCopies(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-24 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Content Options */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Label Content
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'showBrand', label: 'Brand' },
                    { key: 'showModel', label: 'Model' },
                    { key: 'showSku', label: 'SKU' },
                    { key: 'showPrice', label: 'Sale Price' },
                    { key: 'showRrp', label: 'RRP (crossed out)' },
                    { key: 'showDiscount', label: 'Discount %' },
                    { key: 'showQrCode', label: 'QR Code' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={content[key as keyof LabelContent] as boolean}
                        onChange={() => toggleContent(key as keyof LabelContent)}
                        className="w-4 h-4 text-emerald-500 rounded border-zinc-300 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* QR Code Size */}
              {content.showQrCode && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    QR Code Size
                  </label>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => setContent(prev => ({ ...prev, qrCodeSize: size }))}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          content.qrCodeSize === size
                            ? 'bg-emerald-500 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Preview Panel */}
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Preview
              </p>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
                {items[0] && (
                  <LabelPreview
                    item={items[0]}
                    template={selectedTemplate}
                    content={content}
                    baseUrl={typeof window !== 'undefined' ? window.location.origin : ''}
                  />
                )}
              </div>
              {items.length > 1 && (
                <p className="text-xs text-zinc-500 mt-2 text-center">
                  Showing preview of first item. All {items.length} items will be printed.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-zinc-500">
            {items.length * copies} label{items.length * copies !== 1 ? 's' : ''} will be printed
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => handlePrint()}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Labels
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden Print Content */}
      <div className="hidden">
        <div ref={printRef} className="print-labels">
          <style>{`
            @media print {
              @page {
                size: A4;
                margin: 0;
              }
              .print-labels {
                width: 210mm;
                padding: ${selectedTemplate.marginTop}mm ${selectedTemplate.marginLeft}mm;
              }
              .label-grid {
                display: grid;
                grid-template-columns: repeat(${selectedTemplate.columns}, ${selectedTemplate.labelWidth}mm);
                gap: ${selectedTemplate.gapY}mm ${selectedTemplate.gapX}mm;
              }
            }
          `}</style>
          <div className="label-grid">
            {items.flatMap(item =>
              Array.from({ length: copies }, (_, copyIndex) => (
                <LabelPreview
                  key={`${item.id}-${copyIndex}`}
                  item={item}
                  template={selectedTemplate}
                  content={content}
                  baseUrl={typeof window !== 'undefined' ? window.location.origin : ''}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage PrintLabelsDialog state
 */
export function usePrintLabelsDialog() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}

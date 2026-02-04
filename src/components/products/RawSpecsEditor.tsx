'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';

interface RawSpecsEditorProps {
  specifications: Record<string, string>;
  onSave: (specs: Record<string, string>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RawSpecsEditor({
  specifications,
  onSave,
  onCancel,
  isLoading = false,
}: RawSpecsEditorProps) {
  const [specs, setSpecs] = useState<Array<{ key: string; value: string }>>(
    Object.entries(specifications).map(([key, value]) => ({ key, value }))
  );
  const [hasChanges, setHasChanges] = useState(false);

  const updateSpec = useCallback((index: number, field: 'key' | 'value', newValue: string) => {
    setSpecs(prev => prev.map((spec, i) => 
      i === index ? { ...spec, [field]: newValue } : spec
    ));
    setHasChanges(true);
  }, []);

  const deleteSpec = useCallback((index: number) => {
    setSpecs(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  const addSpec = useCallback(() => {
    setSpecs(prev => [...prev, { key: '', value: '' }]);
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    // Convert back to Record, filtering out empty entries
    const result: Record<string, string> = {};
    specs.forEach(({ key, value }) => {
      if (key.trim() && value.trim()) {
        result[key.trim()] = value.trim();
      }
    });
    onSave(result);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {specs.length} specifications
        </span>
        <button
          type="button"
          onClick={addSpec}
          className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Spec
        </button>
      </div>

      {/* Specs list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {specs.map((spec, index) => (
          <div key={index} className="flex gap-2 items-start group">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input
                type="text"
                value={spec.key}
                onChange={(e) => updateSpec(index, 'key', e.target.value)}
                placeholder="Specification name"
                className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="text"
                value={spec.value}
                onChange={(e) => updateSpec(index, 'value', e.target.value)}
                placeholder="Value"
                className="px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={() => deleteSpec(index)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-50 group-hover:opacity-100 transition-opacity"
              title="Delete specification"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {specs.length === 0 && (
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          <p>No specifications</p>
          <button
            type="button"
            onClick={addSpec}
            className="mt-2 text-emerald-600 hover:text-emerald-700"
          >
            Add your first specification
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          isLoading={isLoading}
          disabled={!hasChanges}
          className="flex-1"
        >
          Save Specifications
        </Button>
      </div>
    </div>
  );
}

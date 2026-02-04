'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import type { CategorizedSpecifications, SpecificationCategory, SpecificationItem } from '@/types';

interface SpecificationsEditorProps {
  specifications: CategorizedSpecifications;
  onSave: (specs: CategorizedSpecifications) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function SpecificationsEditor({
  specifications,
  onSave,
  onCancel,
  isLoading = false,
}: SpecificationsEditorProps) {
  const [editedSpecs, setEditedSpecs] = useState<CategorizedSpecifications>(specifications);
  const [hasChanges, setHasChanges] = useState(false);

  const updateCategory = useCallback((categoryIndex: number, updates: Partial<SpecificationCategory>) => {
    setEditedSpecs(prev => ({
      ...prev,
      categories: prev.categories.map((cat, i) => 
        i === categoryIndex ? { ...cat, ...updates } : cat
      ),
    }));
    setHasChanges(true);
  }, []);

  const updateItem = useCallback((categoryIndex: number, itemIndex: number, updates: Partial<SpecificationItem>) => {
    setEditedSpecs(prev => ({
      ...prev,
      categories: prev.categories.map((cat, catIdx) => 
        catIdx === categoryIndex 
          ? {
              ...cat,
              items: cat.items.map((item, itemIdx) => 
                itemIdx === itemIndex ? { ...item, ...updates } : item
              ),
            }
          : cat
      ),
    }));
    setHasChanges(true);
  }, []);

  const deleteItem = useCallback((categoryIndex: number, itemIndex: number) => {
    setEditedSpecs(prev => ({
      ...prev,
      categories: prev.categories.map((cat, catIdx) => 
        catIdx === categoryIndex 
          ? { ...cat, items: cat.items.filter((_, i) => i !== itemIndex) }
          : cat
      ),
    }));
    setHasChanges(true);
  }, []);

  const addItem = useCallback((categoryIndex: number) => {
    setEditedSpecs(prev => ({
      ...prev,
      categories: prev.categories.map((cat, catIdx) => 
        catIdx === categoryIndex 
          ? { ...cat, items: [...cat.items, { key: '', value: '', unit: '' }] }
          : cat
      ),
    }));
    setHasChanges(true);
  }, []);

  const deleteCategory = useCallback((categoryIndex: number) => {
    setEditedSpecs(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== categoryIndex),
    }));
    setHasChanges(true);
  }, []);

  const addCategory = useCallback(() => {
    setEditedSpecs(prev => ({
      ...prev,
      categories: [
        ...prev.categories,
        {
          name: 'New Category',
          icon: '📋',
          items: [{ key: '', value: '', unit: '' }],
        },
      ],
    }));
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    // Filter out empty items before saving
    const cleanedSpecs: CategorizedSpecifications = {
      ...editedSpecs,
      categories: editedSpecs.categories
        .map(cat => ({
          ...cat,
          items: cat.items.filter(item => item.key.trim() && item.value.trim()),
        }))
        .filter(cat => cat.items.length > 0),
    };
    onSave(cleanedSpecs);
  };

  return (
    <div className="spec-editor">
      {editedSpecs.categories.map((category, catIdx) => (
        <div key={catIdx} className="spec-editor-category">
          <div className="spec-editor-header">
            <input
              type="text"
              value={category.icon || ''}
              onChange={(e) => updateCategory(catIdx, { icon: e.target.value })}
              className="w-10 text-center"
              placeholder="📋"
            />
            <input
              type="text"
              value={category.name}
              onChange={(e) => updateCategory(catIdx, { name: e.target.value })}
              className="flex-1 font-medium"
              placeholder="Category Name"
            />
            <button
              type="button"
              onClick={() => deleteCategory(catIdx)}
              className="spec-delete-btn"
              title="Delete category"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {category.items.map((item, itemIdx) => (
              <div key={itemIdx} className="spec-editor-row">
                <input
                  type="text"
                  value={item.key}
                  onChange={(e) => updateItem(catIdx, itemIdx, { key: e.target.value })}
                  placeholder="Specification name"
                />
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => updateItem(catIdx, itemIdx, { value: e.target.value })}
                  placeholder="Value"
                />
                <input
                  type="text"
                  value={item.unit || ''}
                  onChange={(e) => updateItem(catIdx, itemIdx, { unit: e.target.value })}
                  placeholder="Unit"
                  className="text-center"
                />
                <button
                  type="button"
                  onClick={() => deleteItem(catIdx, itemIdx)}
                  className="spec-delete-btn"
                  title="Delete specification"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          
          <button
            type="button"
            onClick={() => addItem(catIdx)}
            className="spec-add-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Specification
          </button>
        </div>
      ))}
      
      {/* Add new category button */}
      <button
        type="button"
        onClick={addCategory}
        className="w-full py-3 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-500 dark:text-zinc-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Category
      </button>
      
      {/* Action buttons */}
      <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
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

/**
 * Display-only view of categorized specifications (accordion style)
 */
export function SpecificationsDisplay({ specifications }: { specifications: CategorizedSpecifications }) {
  if (!specifications.categories?.length && !specifications.uncategorized?.length) {
    return (
      <p className="text-zinc-500 dark:text-zinc-400 text-sm italic">
        No specifications available
      </p>
    );
  }

  return (
    <div className="specifications-accordion">
      {specifications.categories.map((category, idx) => (
        <details key={idx} className="spec-category" open>
          <summary className="spec-category-header">
            <span className="spec-icon">{category.icon || '📋'}</span>
            <span className="spec-category-name">{category.name}</span>
            <span className="spec-count">{category.items.length} specs</span>
          </summary>
          <table className="spec-table">
            <tbody>
              {category.items.map((item, itemIdx) => (
                <tr key={itemIdx}>
                  <th>{item.key}</th>
                  <td>
                    {item.value}
                    {item.unit && <span className="spec-unit"> {item.unit}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
      
      {specifications.uncategorized && specifications.uncategorized.length > 0 && (
        <details className="spec-category" open>
          <summary className="spec-category-header">
            <span className="spec-icon">📋</span>
            <span className="spec-category-name">Other Specifications</span>
            <span className="spec-count">{specifications.uncategorized.length} specs</span>
          </summary>
          <table className="spec-table">
            <tbody>
              {specifications.uncategorized.map((item, idx) => (
                <tr key={idx}>
                  <th>{item.key}</th>
                  <td>
                    {item.value}
                    {item.unit && <span className="spec-unit"> {item.unit}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

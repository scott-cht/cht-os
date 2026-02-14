'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import type { FilterPreset, InventoryFilters } from '@/types/filters';
import { getAllPresets, deletePreset, findMatchingPresets } from '@/lib/filters/presets';
import { notify } from '@/lib/store/app-store';

interface FilterPresetsDropdownProps {
  currentFilters: InventoryFilters;
  onApplyPreset: (filters: InventoryFilters) => void;
  onSaveClick: () => void;
}

export function FilterPresetsDropdown({
  currentFilters,
  onApplyPreset,
  onSaveClick,
}: FilterPresetsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, setPresetVersion] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const presets = getAllPresets();

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }

      // Handle arrow key navigation within dropdown
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = dropdownRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="option"], button[data-preset-action]'
        );
        if (!buttons?.length) return;

        const currentIndex = Array.from(buttons).findIndex(
          btn => btn === document.activeElement
        );

        let nextIndex: number;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
        }

        buttons[nextIndex]?.focus();
      }

      // Handle Enter/Space to select
      if (e.key === 'Enter' || e.key === ' ') {
        const activeElement = document.activeElement as HTMLButtonElement;
        if (activeElement?.hasAttribute('role') && activeElement.getAttribute('role') === 'option') {
          activeElement.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleApply = (preset: FilterPreset) => {
    onApplyPreset(preset.filters);
    setIsOpen(false);
    notify.info('Filter applied', `Viewing: ${preset.name}`);
  };

  const handleDelete = (e: React.MouseEvent, preset: FilterPreset) => {
    e.stopPropagation();
    
    if (preset.isSystem) {
      notify.error('Cannot delete', 'System presets cannot be deleted');
      return;
    }

    try {
      deletePreset(preset.id);
      setPresetVersion((v) => v + 1);
      notify.success('Filter deleted', `"${preset.name}" has been removed`);
    } catch (error) {
      console.error('Failed to delete preset:', error);
      notify.error('Delete failed', 'Could not delete filter');
    }
  };

  // Check if current filters match any preset
  const matchingPresets = findMatchingPresets(currentFilters);
  const activePreset = matchingPresets.length > 0 ? matchingPresets[0] : null;

  // Separate system and custom presets
  const systemPresets = presets.filter(p => p.isSystem);
  const customPresets = presets.filter(p => !p.isSystem);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={activePreset ? `Current filter: ${activePreset.name}` : 'Select a saved view'}
      >
        {activePreset ? (
          <>
            <span aria-hidden="true">{activePreset.icon}</span>
            <span className="max-w-[120px] truncate">{activePreset.name}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Saved Views</span>
          </>
        )}
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl z-50 overflow-hidden"
          role="listbox"
          aria-label="Saved filter views"
        >
          {/* System Presets */}
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
            <p className="px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider" id="quick-filters-label">
              Quick Filters
            </p>
            <div className="space-y-0.5" role="group" aria-labelledby="quick-filters-label">
              {systemPresets.map((preset) => (
                <button
                  key={preset.id}
                  role="option"
                  aria-selected={activePreset?.id === preset.id}
                  onClick={() => handleApply(preset)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activePreset?.id === preset.id
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span className="text-lg" aria-hidden="true">{preset.icon}</span>
                  <span className="flex-1 text-sm font-medium">{preset.name}</span>
                  {activePreset?.id === preset.id && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Presets */}
          {customPresets.length > 0 && (
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
              <p className="px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider" id="my-views-label">
                My Views
              </p>
              <div className="space-y-0.5" role="group" aria-labelledby="my-views-label">
                {customPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                      activePreset?.id === preset.id
                        ? 'bg-emerald-50 dark:bg-emerald-900/30'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <button
                      role="option"
                      aria-selected={activePreset?.id === preset.id}
                      onClick={() => handleApply(preset)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <span className="text-lg" aria-hidden="true">{preset.icon}</span>
                      <span className={`flex-1 text-sm font-medium ${
                        activePreset?.id === preset.id
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {preset.name}
                      </span>
                    </button>
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, preset)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                      aria-label={`Delete ${preset.name} filter`}
                      data-preset-action="delete"
                    >
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Current Filter */}
          <div className="p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                onSaveClick();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
              data-preset-action="save"
              aria-label="Save current filters as a new view"
            >
              <span className="text-lg" aria-hidden="true">➕</span>
              <span className="flex-1 text-sm font-medium">Save Current Filters...</span>
            </button>
          </div>

          {/* Clear Filters */}
          {activePreset && (
            <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => {
                  onApplyPreset({});
                  setIsOpen(false);
                  notify.info('Filters cleared', 'Showing all items');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                data-preset-action="clear"
                aria-label="Clear all filters and show all items"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="flex-1 text-sm">Clear All Filters</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

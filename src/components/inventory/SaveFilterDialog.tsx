'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { InventoryFilters } from '@/types/filters';
import { PRESET_ICONS, describeFilters } from '@/types/filters';
import { savePreset } from '@/lib/filters/presets';
import { notify } from '@/lib/store/app-store';

interface SaveFilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filters: InventoryFilters;
  onSave: () => void;
}

export function SaveFilterDialog({ isOpen, onClose, filters, onSave }: SaveFilterDialogProps) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📋');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setSelectedIcon('📋');
      // Focus input after a brief delay
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
      focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      notify.error('Name required', 'Please enter a name for this filter');
      return;
    }

    setIsSaving(true);
    try {
      savePreset({
        name: name.trim(),
        icon: selectedIcon,
        filters,
      });
      
      notify.success('Filter saved', `"${name}" has been saved`);
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save preset:', error);
      notify.error('Save failed', 'Could not save filter preset');
    } finally {
      setIsSaving(false);
    }
  }, [name, selectedIcon, filters, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Save Current Filter
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Save this filter combination for quick access
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Filter Preview */}
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
              Current Filters
            </p>
            <p className="text-sm text-zinc-900 dark:text-white">
              {describeFilters(filters)}
            </p>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Filter Name
            </label>
            <Input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., High Value Trade-Ins"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving) {
                  handleSave();
                }
              }}
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                    selectedIcon === icon
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? 'Saving...' : 'Save Filter'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage SaveFilterDialog state
 */
export function useSaveFilterDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}

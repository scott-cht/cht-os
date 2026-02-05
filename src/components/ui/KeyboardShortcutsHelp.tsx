'use client';

import { useEffect, useRef, useState } from 'react';
import {
  KeyboardShortcut,
  formatShortcut,
  groupShortcutsByCategory,
} from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** List of shortcuts to display */
  shortcuts: KeyboardShortcut[];
  /** Title for the modal */
  title?: string;
}

/**
 * Keyboard Shortcuts Help Modal
 * 
 * Displays all available keyboard shortcuts grouped by category.
 */
export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
  shortcuts,
  title = 'Keyboard Shortcuts',
}: KeyboardShortcutsHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isMac, setIsMac] = useState(true);
  
  // Detect platform on mount
  useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes('mac'));
  }, []);
  
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    
    const previousActiveElement = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    
    return () => {
      previousActiveElement?.focus();
    };
  }, [isOpen]);
  
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const groupedShortcuts = groupShortcutsByCategory(
    shortcuts.filter(s => s.enabled !== false)
  );
  const categories = Object.keys(groupedShortcuts).sort();
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-auto rounded-lg bg-white shadow-xl dark:bg-gray-900"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <h2
            id="shortcuts-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {isMac ? (
              <span>⌘ = Command, ⌥ = Option, ⇧ = Shift, ⌃ = Control</span>
            ) : (
              <span>Ctrl = Control, Alt = Alt, Shift = Shift</span>
            )}
          </div>
          
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                  {category}
                </h3>
                <div className="space-y-1">
                  {groupedShortcuts[category].map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <kbd className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {formatShortcut(shortcut.shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {categories.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No keyboard shortcuts available.
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 px-6 py-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Press <kbd className="rounded border border-gray-300 px-1.5 py-0.5 font-mono dark:border-gray-600">?</kbd> to show this help</span>
            <span>Press <kbd className="rounded border border-gray-300 px-1.5 py-0.5 font-mono dark:border-gray-600">Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing keyboard shortcuts help modal state
 */
export function useKeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);
  
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);
  
  return {
    isOpen,
    open,
    close,
    toggle,
  };
}

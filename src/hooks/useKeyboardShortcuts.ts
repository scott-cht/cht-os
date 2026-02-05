'use client';

import { useEffect, useCallback, useMemo } from 'react';

/**
 * Keyboard Shortcuts Hook
 * 
 * Provides application-wide keyboard shortcuts for common actions.
 */

export interface KeyboardShortcut {
  /** Unique key identifier */
  key: string;
  /** Key or key combination (e.g., 'n', 'ctrl+s', 'cmd+shift+p') */
  shortcut: string;
  /** Description for help modal */
  description: string;
  /** Handler function */
  handler: (e: KeyboardEvent) => void;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Whether shortcut is enabled */
  enabled?: boolean;
  /** Category for grouping in help modal */
  category?: string;
}

interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled globally */
  enabled?: boolean;
  /** Elements to ignore shortcuts when focused (default: inputs, textareas, selects) */
  ignoreInputs?: boolean;
}

/**
 * Parse shortcut string into modifier keys and main key
 */
function parseShortcut(shortcut: string): {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  key: string;
} {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop() || '';
  
  return {
    ctrlKey: parts.includes('ctrl'),
    metaKey: parts.includes('cmd') || parts.includes('meta'),
    shiftKey: parts.includes('shift'),
    altKey: parts.includes('alt') || parts.includes('option'),
    key,
  };
}

/**
 * Check if event matches shortcut
 */
function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  
  // Handle special keys
  const eventKey = e.key.toLowerCase();
  const keyMatches = 
    eventKey === parsed.key || 
    (parsed.key === 'escape' && eventKey === 'escape') ||
    (parsed.key === 'enter' && eventKey === 'enter') ||
    (parsed.key === 'space' && eventKey === ' ');
  
  // On Mac, cmd is metaKey; on Windows, ctrl is ctrlKey
  const isMac = typeof window !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
  const modifierMatches = isMac
    ? e.metaKey === parsed.metaKey && e.ctrlKey === parsed.ctrlKey
    : e.ctrlKey === (parsed.ctrlKey || parsed.metaKey);
  
  return (
    keyMatches &&
    modifierMatches &&
    e.shiftKey === parsed.shiftKey &&
    e.altKey === parsed.altKey
  );
}

/**
 * Check if active element is an input-like element
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tagName)) return true;
  if (element.getAttribute('contenteditable') === 'true') return true;
  if (element.getAttribute('role') === 'textbox') return true;
  
  return false;
}

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, ignoreInputs = true } = options;
  
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check if shortcuts are enabled
      if (!enabled) return;
      
      // Ignore if focused on input element
      if (ignoreInputs && isInputElement(document.activeElement)) {
        // Allow certain shortcuts even in inputs (like Escape)
        const escapeShortcut = shortcuts.find(
          s => s.shortcut.toLowerCase() === 'escape' && s.enabled !== false
        );
        if (escapeShortcut && matchesShortcut(e, escapeShortcut.shortcut)) {
          escapeShortcut.handler(e);
          if (escapeShortcut.preventDefault) e.preventDefault();
        }
        return;
      }
      
      // Find matching shortcut
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;
        
        if (matchesShortcut(e, shortcut.shortcut)) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.handler(e);
          break;
        }
      }
    },
    [enabled, ignoreInputs, shortcuts]
  );
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Pre-defined common shortcuts factory
 */
export function createCommonShortcuts(handlers: {
  onNew?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onDelete?: () => void;
  onEscape?: () => void;
  onSelectAll?: () => void;
  onRefresh?: () => void;
  onHelp?: () => void;
}): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [];
  
  if (handlers.onNew) {
    shortcuts.push({
      key: 'new',
      shortcut: 'n',
      description: 'Create new item',
      handler: () => handlers.onNew?.(),
      category: 'Actions',
    });
  }
  
  if (handlers.onSave) {
    shortcuts.push({
      key: 'save',
      shortcut: 'cmd+s',
      description: 'Save changes',
      handler: () => handlers.onSave?.(),
      category: 'Actions',
    });
  }
  
  if (handlers.onSearch) {
    shortcuts.push({
      key: 'search',
      shortcut: '/',
      description: 'Focus search',
      handler: () => handlers.onSearch?.(),
      category: 'Navigation',
    });
    shortcuts.push({
      key: 'search-alt',
      shortcut: 'cmd+k',
      description: 'Focus search',
      handler: () => handlers.onSearch?.(),
      enabled: true,
      category: 'Navigation',
    });
  }
  
  if (handlers.onDelete) {
    shortcuts.push({
      key: 'delete',
      shortcut: 'cmd+backspace',
      description: 'Delete selected',
      handler: () => handlers.onDelete?.(),
      category: 'Actions',
    });
  }
  
  if (handlers.onEscape) {
    shortcuts.push({
      key: 'escape',
      shortcut: 'escape',
      description: 'Cancel / Close',
      handler: () => handlers.onEscape?.(),
      category: 'Navigation',
    });
  }
  
  if (handlers.onSelectAll) {
    shortcuts.push({
      key: 'selectAll',
      shortcut: 'cmd+a',
      description: 'Select all',
      handler: () => handlers.onSelectAll?.(),
      category: 'Selection',
    });
  }
  
  if (handlers.onRefresh) {
    shortcuts.push({
      key: 'refresh',
      shortcut: 'cmd+r',
      description: 'Refresh',
      handler: () => handlers.onRefresh?.(),
      category: 'Actions',
    });
  }
  
  if (handlers.onHelp) {
    shortcuts.push({
      key: 'help',
      shortcut: '?',
      description: 'Show keyboard shortcuts',
      handler: () => handlers.onHelp?.(),
      category: 'Help',
    });
  }
  
  return shortcuts;
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: string): string {
  const isMac = typeof window !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
  
  return shortcut
    .split('+')
    .map((part) => {
      switch (part.toLowerCase()) {
        case 'cmd':
        case 'meta':
          return isMac ? '⌘' : 'Ctrl';
        case 'ctrl':
          return isMac ? '⌃' : 'Ctrl';
        case 'shift':
          return isMac ? '⇧' : 'Shift';
        case 'alt':
        case 'option':
          return isMac ? '⌥' : 'Alt';
        case 'enter':
          return '↵';
        case 'escape':
          return 'Esc';
        case 'backspace':
          return isMac ? '⌫' : 'Backspace';
        case 'space':
          return 'Space';
        default:
          return part.toUpperCase();
      }
    })
    .join(isMac ? '' : '+');
}

/**
 * Group shortcuts by category for help display
 */
export function groupShortcutsByCategory(
  shortcuts: KeyboardShortcut[]
): Record<string, KeyboardShortcut[]> {
  return shortcuts.reduce((groups, shortcut) => {
    const category = shortcut.category || 'Other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(shortcut);
    return groups;
  }, {} as Record<string, KeyboardShortcut[]>);
}

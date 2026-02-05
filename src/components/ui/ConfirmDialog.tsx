'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Button } from './Button';
import { cn } from '@/lib/utils/cn';

/**
 * Confirmation Dialog Component
 * 
 * Modal dialog for confirming destructive or important actions.
 * Implements focus trapping and keyboard navigation.
 */

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Confirm handler */
  onConfirm: () => void;
  /** Dialog title */
  title: string;
  /** Dialog message/description */
  message: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Variant - affects confirm button color */
  variant?: 'danger' | 'warning' | 'default';
  /** Whether confirm action is loading */
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus the cancel button when dialog opens
    cancelButtonRef.current?.focus();

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isLoading, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose]
  );

  if (!isOpen) return null;

  const confirmButtonClass = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    default: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  };

  const iconClass = {
    danger: 'text-red-600 bg-red-100 dark:bg-red-900/30',
    warning: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
    default: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
  };

  const icons = {
    danger: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    warning: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    default: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleBackdropClick}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={dialogRef}
          className={cn(
            'relative bg-white dark:bg-zinc-900 rounded-xl shadow-xl',
            'w-full max-w-md transform transition-all',
            'animate-in fade-in zoom-in-95 duration-200'
          )}
        >
          <div className="p-6">
            {/* Icon */}
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4', iconClass[variant])}>
              {icons[variant]}
            </div>

            {/* Title */}
            <h3
              id="confirm-dialog-title"
              className="text-lg font-semibold text-zinc-900 dark:text-white text-center mb-2"
            >
              {title}
            </h3>

            {/* Message */}
            <p
              id="confirm-dialog-description"
              className="text-sm text-zinc-600 dark:text-zinc-400 text-center mb-6"
            >
              {message}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                ref={cancelButtonRef}
                variant="secondary"
                className="flex-1"
                onClick={onClose}
                disabled={isLoading}
              >
                {cancelText}
              </Button>
              <button
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg font-medium transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  confirmButtonClass[variant]
                )}
                onClick={onConfirm}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage confirm dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Omit<ConfirmDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>>({
    title: '',
    message: '',
  });
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback(
    (options: Omit<ConfirmDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfig(options);
        setIsOpen(true);
        resolveRef.current = resolve;
      });
    },
    []
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  return {
    isOpen,
    config,
    confirm,
    handleClose,
    handleConfirm,
  };
}

// Need to import useState for the hook
import { useState } from 'react';

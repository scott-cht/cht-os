'use client';

import { useEffect, useRef, useState } from 'react';
import { useNotifications, useAppStore, type Notification } from '@/lib/store/app-store';
import { cn } from '@/lib/utils/cn';

/**
 * Toast Notification System
 * 
 * Displays notifications from the global Zustand store
 */

const notificationStyles: Record<Notification['type'], { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    icon: '✓',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    icon: '✕',
    border: 'border-red-200 dark:border-red-800',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    icon: '⚠',
    border: 'border-amber-200 dark:border-amber-800',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    icon: 'ℹ',
    border: 'border-blue-200 dark:border-blue-800',
  },
};

const iconColors: Record<Notification['type'], string> = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-blue-500 text-white',
};

function NotificationItem({ notification }: { notification: Notification }) {
  const [isExiting, setIsExiting] = useState(false);
  const dismissNotification = useAppStore((state) => state.dismissNotification);
  const styles = notificationStyles[notification.type];
  const iconColor = iconColors[notification.type];
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = () => {
    setIsExiting(true);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    dismissTimerRef.current = setTimeout(() => {
      dismissNotification(notification.id);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all duration-200',
        styles.bg,
        styles.border,
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
      )}
      role="alert"
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm', iconColor)}>
        {styles.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
            {notification.message}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function Notifications() {
  const notifications = useNotifications();
  if (typeof window === 'undefined') return null;

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {notifications.slice(-5).map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationItem notification={notification} />
        </div>
      ))}
    </div>
  );
}

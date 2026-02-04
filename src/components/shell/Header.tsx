'use client';

import Link from 'next/link';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onMenuClick?: () => void;
  isSidebarCollapsed?: boolean;
}

export function Header({ title, subtitle, actions, onMenuClick, isSidebarCollapsed }: HeaderProps) {
  return (
    <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6">
      {/* Left side - Title */}
      <div className="flex items-center gap-4">
        {/* Mobile/collapsed menu button */}
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg lg:hidden"
          title={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb / Title */}
        <div>
          {title && (
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-4">
        {actions}

        {/* Quick add button */}
        <Link
          href="/lister"
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Listing
        </Link>

        {/* Notifications (placeholder) */}
        <button className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg relative">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="flex items-center gap-3 pl-4 border-l border-zinc-200 dark:border-zinc-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
            <span className="text-white text-sm font-medium">SD</span>
          </div>
        </div>
      </div>
    </header>
  );
}

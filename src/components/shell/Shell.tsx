'use client';

import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface ShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  fullWidth?: boolean;
  noPadding?: boolean;
}

export function Shell({ 
  children, 
  title, 
  subtitle, 
  headerActions,
  fullWidth = false,
  noPadding = false,
}: ShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Header */}
        <Header title={title} subtitle={subtitle} actions={headerActions} />

        {/* Page content */}
        <main className={noPadding ? '' : 'p-6'}>
          <div className={fullWidth ? '' : 'max-w-7xl mx-auto'}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

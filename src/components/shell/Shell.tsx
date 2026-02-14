'use client';

import { useEffect, useState } from 'react';
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

const SIDEBAR_COLLAPSED_KEY = 'cht-sidebar-collapsed';
const SIDEBAR_COLLAPSED_EVENT = 'cht-sidebar-collapsed-change';

function getSidebarCollapsedSnapshot(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  return stored === null ? true : stored === 'true';
}

export function Shell({ 
  children, 
  title, 
  subtitle, 
  headerActions,
  fullWidth = false,
  noPadding = false,
}: ShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === SIDEBAR_COLLAPSED_KEY) {
        setIsCollapsed(getSidebarCollapsedSnapshot());
      }
    };
    const handleCustom = () => {
      setIsCollapsed(getSidebarCollapsedSnapshot());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(SIDEBAR_COLLAPSED_EVENT, handleCustom);
    const frame = window.requestAnimationFrame(() => {
      setIsCollapsed(getSidebarCollapsedSnapshot());
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, handleCustom);
    };
  }, []);

  // Save preference when changed
  const handleToggle = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <Sidebar isCollapsed={isCollapsed} onToggle={handleToggle} />

      {/* Main content area - adjust margin based on sidebar state */}
      <div 
        className={`transition-all duration-300 ${
          isCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        }`}
      >
        {/* Header */}
        <Header 
          title={title} 
          subtitle={subtitle} 
          actions={headerActions}
          onMenuClick={handleToggle}
          isSidebarCollapsed={isCollapsed}
        />

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

'use client';

import { useState, useEffect } from 'react';
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

export function Shell({ 
  children, 
  title, 
  subtitle, 
  headerActions,
  fullWidth = false,
  noPadding = false,
}: ShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === 'true');
    }
  }, []);

  // Save preference when changed
  const handleToggle = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
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

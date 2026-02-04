'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  children?: { name: string; href: string }[];
  disabled?: boolean;
  phase?: string;
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Product Lister',
    href: '/lister',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
    children: [
      { name: 'New Retail', href: '/lister/new' },
      { name: 'Trade-In', href: '/lister/trade-in' },
      { name: 'Ex-Demo', href: '/lister/ex-demo' },
    ],
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    name: 'Sync Status',
    href: '/sync',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    name: 'Email Studio',
    href: '/klaviyo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    disabled: true,
    phase: 'Phase 3',
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    disabled: true,
    phase: 'Phase 4',
  },
];

const integrations = [
  { name: 'Shopify', color: 'bg-green-500', connected: true },
  { name: 'HubSpot', color: 'bg-orange-500', connected: false },
  { name: 'Notion', color: 'bg-zinc-700', connected: false },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside 
      className={`fixed left-0 top-0 z-40 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo & Toggle */}
      <div className="h-16 flex items-center border-b border-zinc-800">
        {isCollapsed ? (
          /* Collapsed: Just show toggle button centered */
          <div className="w-full flex justify-center">
            <button
              onClick={onToggle}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Expand sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        ) : (
          /* Expanded: Show logo and collapse button */
          <div className="w-full flex items-center justify-between px-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">CHT</span>
              </div>
              <span className="text-white font-semibold whitespace-nowrap">Command Centre</span>
            </Link>
            
            <button
              onClick={onToggle}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Collapse sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              {item.disabled ? (
                <div 
                  className={`flex items-center gap-3 px-3 py-2.5 text-zinc-500 cursor-not-allowed ${
                    isCollapsed ? 'justify-center' : ''
                  }`}
                  title={isCollapsed ? `${item.name} (${item.phase})` : undefined}
                >
                  <span className="opacity-50 flex-shrink-0">{item.icon}</span>
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-sm opacity-50">{item.name}</span>
                      {item.phase && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                          {item.phase}
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isCollapsed ? 'justify-center' : ''
                    } ${
                      isActive(item.href)
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-sm font-medium">{item.name}</span>
                        {item.badge && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                  
                  {/* Sub-navigation - only show when expanded and active */}
                  {!isCollapsed && item.children && isActive(item.href) && (
                    <ul className="mt-1 ml-8 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.name}>
                          <Link
                            href={child.href}
                            className={`block px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              pathname === child.href
                                ? 'text-emerald-400'
                                : 'text-zinc-500 hover:text-white'
                            }`}
                          >
                            {child.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Integrations Status - only show when expanded */}
      {!isCollapsed && (
        <div className="px-4 py-4 border-t border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Integrations
          </p>
          <div className="space-y-2">
            {integrations.map((integration) => (
              <div key={integration.name} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${integration.connected ? integration.color : 'bg-zinc-600'}`} />
                <span className={`text-sm ${integration.connected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {integration.name}
                </span>
                {!integration.connected && (
                  <span className="text-[10px] text-zinc-600">Not configured</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed integrations indicator */}
      {isCollapsed && (
        <div className="px-2 py-4 border-t border-zinc-800">
          <div className="flex flex-col items-center gap-2">
            {integrations.map((integration) => (
              <div 
                key={integration.name}
                className={`w-2 h-2 rounded-full ${integration.connected ? integration.color : 'bg-zinc-600'}`}
                title={`${integration.name}: ${integration.connected ? 'Connected' : 'Not configured'}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Version */}
      <div className={`px-4 py-3 border-t border-zinc-800 ${isCollapsed ? 'text-center' : ''}`}>
        <p className="text-xs text-zinc-600">
          {isCollapsed ? 'v1' : 'v1.0.0 · Phase 1'}
        </p>
      </div>
    </aside>
  );
}

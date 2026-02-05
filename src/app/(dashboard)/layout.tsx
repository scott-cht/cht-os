'use client';

import { PageErrorBoundary } from '@/components/ErrorBoundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageErrorBoundary>
      {children}
    </PageErrorBoundary>
  );
}

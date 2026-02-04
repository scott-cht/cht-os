'use client';

import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';

export default function KlaviyoPage() {
  return (
    <Shell title="Email Studio" subtitle="Phase 3 - Coming Soon">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
            Email Studio
          </h2>
          
          <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-md mx-auto">
            Generate AI-powered marketing emails from your inventory data. Pull products directly into beautiful Klaviyo templates.
          </p>

          <div className="space-y-4 text-left bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Planned Features:</h3>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                AI-generated email copy based on CHT brand voice
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Pull product data directly from inventory
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Klaviyo template integration
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Campaign performance tracking
              </li>
            </ul>
          </div>

          <div className="mt-8 p-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
            <p className="text-sm text-zinc-500">
              <span className="font-medium">Phase 3</span> • Development will begin after Phase 2 (CRM Automation) is complete
            </p>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

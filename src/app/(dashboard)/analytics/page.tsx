'use client';

import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';

export default function AnalyticsPage() {
  return (
    <Shell title="Analytics Dashboard" subtitle="Phase 4 - Coming Soon">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
            Business KOI Dashboard
          </h2>
          
          <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-md mx-auto">
            Real-time business health visibility. Track sales, expenses, and marketing ROI all in one unified view.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-left">
              <div className="w-8 h-8 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.337 3.416c-.194-.066-.488.009-.637.159-.149.15-.252.47-.252.47l-.927 2.836s-1.078-.198-1.553-.198c-1.301 0-1.382 1.146-1.382 1.146l-.006 5.573c0 .19.155.342.346.342h.694c.19 0 .345-.153.345-.342v-3.03h.866v3.03c0 .19.155.342.345.342h.694c.19 0 .345-.153.345-.342v-3.03h.866v3.03c0 .19.155.342.345.342h.694c.19 0 .346-.153.346-.342V7.83s-.082-1.146-1.383-1.146c-.475 0-1.553.198-1.553.198l.928-2.836s.103-.32-.117-.63z"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Shopify Sales</p>
              <p className="text-xs text-zinc-500">Revenue & orders</p>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-left">
              <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <span className="text-blue-600 font-bold text-xs">X</span>
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Xero Expenses</p>
              <p className="text-xs text-zinc-500">Costs & margins</p>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-left">
              <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2">
                <span className="text-purple-600 font-bold text-xs">K</span>
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Klaviyo ROI</p>
              <p className="text-xs text-zinc-500">Campaign performance</p>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-left">
              <div className="w-8 h-8 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Trends</p>
              <p className="text-xs text-zinc-500">Historical data</p>
            </div>
          </div>

          <div className="p-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
            <p className="text-sm text-zinc-500">
              <span className="font-medium">Phase 4</span> • Development will begin after Phase 3 (Klaviyo Engine) is complete
            </p>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

'use client';

import Link from 'next/link';
import { Shell } from '@/components/shell';

export default function ListerChoicePage() {
  return (
    <Shell title="Product Lister" subtitle="Choose listing type">
      <div className="max-w-3xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3">
            What are you listing?
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Select the type of product to start the listing process
          </p>
        </div>

        <div className="grid gap-4">
          {/* New Retail */}
          <Link
            href="/lister/new"
            className="group p-6 bg-white dark:bg-zinc-900 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                📦
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                  New Retail Product
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 mt-1 mb-3">
                  Brand new product from manufacturer. Scrape specs and pricing from Australian retailers.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Web Scraping
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    AI Copywriting
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Specs Extraction
                  </span>
                </div>
              </div>
              <svg className="w-6 h-6 text-zinc-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Trade-In */}
          <Link
            href="/lister/trade-in"
            className="group p-6 bg-white dark:bg-zinc-900 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                🔄
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  Customer Trade-In
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 mt-1 mb-3">
                  Pre-owned item from customer. Take a photo for AI identification and automatic RRP lookup.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Camera Capture
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    AI Vision ID
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    30% Auto-Pricing
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    HubSpot Deal
                  </span>
                </div>
              </div>
              <svg className="w-6 h-6 text-zinc-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Register Demo */}
          <Link
            href="/lister/ex-demo"
            className="group p-6 bg-white dark:bg-zinc-900 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-lg"
          >
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                🏷️
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  Register Demo Unit
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 mt-1 mb-3">
                  Track a new demo unit on display. Record cost, serial, and demo start date. Convert to sale when ready.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    AI Vision ID
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Track Cost Price
                  </span>
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    Demo Tracking
                  </span>
                </div>
              </div>
              <svg className="w-6 h-6 text-zinc-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Recent tip */}
        <div className="mt-8 p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">Tip:</span> For Trade-Ins and Ex-Demo, use your phone&apos;s camera to capture the product for instant AI identification.
          </p>
        </div>
      </div>
    </Shell>
  );
}

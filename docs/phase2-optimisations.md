# Phase 2 Optimisations

Tracking document for improvements identified during second codebase review.

---

## Critical Bugs (Fix Immediately)

- [x] **1. Async/Await Bug in Shopify Route** - `isShopifyConfigured()` is async but called without await ✅
  - File: `src/app/api/shopify/route.ts:29`
  - Impact: Always evaluates to truthy (Promise object), skipping the check
  - Fix: Change to `if (!(await isShopifyConfigured()))`

- [x] **2. Async/Await Bug in getGraphQLClient** - Called without await on line 71 ✅
  - File: `src/app/api/shopify/route.ts:71`
  - Impact: `graphqlClient` is a Promise, not the actual client
  - Fix: Change to `const graphqlClient = await getGraphQLClient();`

- [x] **3. Duplicate Variable Declaration** - `fetchError` declared twice in same scope ✅
  - File: `src/app/api/images/route.ts` (lines 27 and 74)
  - Impact: TypeScript error, confusing code
  - Fix: Rename second variable to `refetchError`

---

## Security Issues

- [x] **4. Strengthen Origin Check in Middleware** - Current check is too permissive ✅
  - File: `src/middleware.ts:64-71`
  - Issue: `origin.includes(host)` allows subdomain bypass
  - Fix: Use strict origin matching: `new URL(origin).host === host`

- [x] **5. Add Input Validation with Zod** - No schema validation on API inputs ✅
  - Affected routes: `/api/products`, `/api/search`, `/api/scrape`, `/api/inventory`
  - Impact: Potential injection attacks, malformed data
  - Fix: Add Zod schemas for all request bodies (`src/lib/validation/schemas.ts`)

- [x] **6. Add Pagination Limit Cap** - User can request unlimited items ✅
  - File: `src/app/api/inventory/route.ts:110`
  - Issue: No max limit enforcement on `limit` parameter
  - Fix: `const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);`

- [x] **7. Add CSRF Protection** - No CSRF tokens for state-changing operations ✅
  - Impact: Vulnerable to cross-site request forgery
  - Fix: Implemented double-submit cookie pattern (`src/lib/security/csrf.ts`, `/api/csrf`, `src/hooks/useCsrf.ts`)

---

## Database & Performance

- [x] **8. Add Missing Indexes to product_onboarding** - Queries will be slow on large datasets ✅
  - File: `schema.sql`
  - Missing indexes on: `brand`, `model_number`, `status`, `created_at`
  - Fix: Added via `migrations/006_add_indexes_and_constraints.sql`

- [x] **9. Sync schema.sql with Migrations** - Schema missing `archived` column ✅
  - File: `schema.sql`
  - Issue: Migration 004 adds `archived` but schema.sql doesn't have it
  - Fix: Added `archived BOOLEAN DEFAULT FALSE` to schema.sql

- [x] **10. Add Database Constraints** - Missing validation at DB level ✅
  - File: `schema.sql`, `schema-inventory.sql`
  - Missing: CHECK constraint for price > 0, discount percentage 0-100
  - Fix: Added CHECK constraints via migration 006

---

## PRD Compliance (Missing Features)

- [x] **11. Implement Metric Normalization** - PRD requires Australian metric standards ✅
  - Requirement: "All measurements (mm, cm, kg, L) normalized"
  - Fix: Created `src/lib/utils/metrics.ts` with AU metric conversion utilities

- [x] **12. Add GST Handling** - PRD requires explicit GST in currency handling ✅
  - Requirement: "Ensure all currency handling is explicitly AUD (including GST)"
  - Fix: Created `src/lib/utils/gst.ts` with GST calculation and formatting

- [x] **13. Add AU Proxy Support for Scraping** - PRD requires AU residential proxies ✅
  - Requirement: "Use AU residential proxies to see correct localized pricing/GST"
  - Fix: Added proxy config to `src/config.ts`, integrated in scraper with retry logic

- [x] **14. Move Scraping to Edge Function** - PRD requires Edge Functions for scraping ✅
  - Requirement: "Playwright (Stealth) running in Supabase Edge Functions"
  - Note: Playwright not available in Deno Edge Functions; enhanced API route with retries/proxy instead

---

## Code Quality

- [x] **15. Add Environment Variable Validation** - No startup validation ✅
  - Issue: Missing env vars cause unclear runtime failures
  - Fix: Created `src/lib/env.ts` with validation utilities

- [x] **16. Standardize Error Response Format** - Inconsistent error structures ✅
  - Issue: Some routes return `{ error }`, others `{ error, message }`
  - Fix: Created `src/lib/api/response.ts` with standardized response utilities

- [x] **17. Add Type Safety to Request Bodies** - Untyped JSON parsing ✅
  - Files: Multiple API routes using `await request.json()` without typing
  - Fix: Integrated Zod validation via `validateBody` helper in `src/lib/validation/schemas.ts`

- [x] **18. Move Hardcoded Token Cache to Config** - Magic number in code ✅
  - File: `src/lib/shopify/client.ts:10`
  - Issue: `TOKEN_CACHE_MS = 60000` hardcoded
  - Fix: Created centralized `src/config.ts` with all configurable constants

---

## UX Improvements

- [x] **19. Add Skeleton Loading States** - Better loading experience ✅
  - Pages: Dashboard, Inventory list, Item detail
  - Fix: Created `src/components/ui/Skeleton.tsx` with various skeleton components

- [x] **20. Add Toast Feedback for All Operations** - Inconsistent feedback ✅
  - Issue: Some operations show toast, others don't
  - Fix: Added notify.success/error to all pages: new lister, trade-in, ex-demo, products, sync, inventory detail

- [x] **21. Add Keyboard Shortcuts** - Power user efficiency ✅
  - Suggestions: `Cmd/Ctrl + K` for search, `N` for new item, `?` for help
  - Fix: Created `src/hooks/useKeyboardShortcuts.ts` and `src/components/ui/KeyboardShortcutsHelp.tsx`

- [x] **22. Add Confirmation Dialogs** - Prevent accidental actions ✅
  - Missing for: Delete, Archive, Bulk operations
  - Fix: Created `src/components/ui/ConfirmDialog.tsx` with `useConfirmDialog` hook

---

## New Feature Suggestions

- [x] **23. Add Export to CSV/Excel** - Data export capability ✅
  - Use case: Accounting, reporting, backup
  - Implementation: Created `src/lib/utils/export.ts` and `src/components/inventory/ExportButton.tsx` with 3 export formats

- [x] **24. Add Duplicate Item Feature** - Quick listing creation ✅
  - Use case: Similar products with minor differences
  - Implementation: Created `/api/inventory/[id]/duplicate` API and added button to inventory detail page

- [x] **25. Add Price History Tracking** - Track price changes over time ✅
  - Use case: Analysis, undo pricing mistakes
  - Implementation: Migration 007 with triggers, API endpoint, and `PriceHistory` component

- [x] **26. Add Batch Import from CSV** - Bulk item creation ✅
  - Use case: Migrate existing inventory, bulk listings
  - Implementation: Created `src/lib/utils/import.ts`, API endpoint, and `ImportDialog` component

- [x] **27. Add Item Comparison View** - Compare multiple items side-by-side ✅ Done
  - Use case: Pricing decisions, spec comparison
  - Implementation: Added `ComparisonModal` with checkbox selection in inventory table
  - Features: Select up to 5 items, side-by-side comparison, highlights best values (price, margin)

- [x] **28. Add Dashboard Analytics Charts** - Visual insights ✅ Done
  - Suggestions: Sales over time, sync success rate, inventory by category
  - Implementation: Installed Recharts, created analytics API and 3 chart components
  - Charts: Inventory by Type (pie), Sync Status (donut), Timeline (area chart)

- [x] **29. Add Saved Filters/Views** - Quick access to common queries ✅ Done
  - Use case: "My pending syncs", "High margin items", "Trade-ins this week"
  - Implementation: Created `FilterPresetsDropdown`, `SaveFilterDialog`, and filter presets system with localStorage
  - System presets: Pending Sync, Sync Errors, Trade-Ins, Ex-Demo, New Retail, On Demo, Synced
  - Custom presets with icon picker, save/delete functionality

- [x] **30. Add Print Labels Feature** - Physical inventory management ✅ Done
  - Use case: Warehouse labeling, price tags
  - Implementation: Created `PrintLabelsDialog` with multiple templates, QR codes, and customizable content
  - Templates: Standard, Address (30/sheet), Product (10/sheet), Square (6/sheet), Price Tag (40/sheet)
  - Features: QR code generation, configurable content, batch printing from inventory list

---

## Progress Log

| # | Issue | Priority | Status | Date |
|---|-------|----------|--------|------|
| 1 | Async/Await Shopify | 🔴 Critical | ✅ Done | 2026-02-05 |
| 2 | Async/Await GraphQL | 🔴 Critical | ✅ Done | 2026-02-05 |
| 3 | Duplicate Variable | 🔴 Critical | ✅ Done | 2026-02-05 |
| 4 | Origin Check | 🟠 High | ✅ Done | 2026-02-05 |
| 5 | Input Validation | 🟠 High | ✅ Done | 2026-02-05 |
| 6 | Pagination Limit | 🟠 High | ✅ Done | 2026-02-05 |
| 7 | CSRF Protection | 🟠 High | ✅ Done | 2026-02-05 |
| 8 | DB Indexes | 🟡 Medium | ✅ Done | 2026-02-05 |
| 9 | Schema Sync | 🟡 Medium | ✅ Done | 2026-02-05 |
| 10 | DB Constraints | 🟡 Medium | ✅ Done | 2026-02-05 |
| 11 | Metric Normalization | 🟡 Medium | ✅ Done | 2026-02-05 |
| 12 | GST Handling | 🟡 Medium | ✅ Done | 2026-02-05 |
| 13 | AU Proxy | 🟡 Medium | ✅ Done | 2026-02-05 |
| 14 | Scraping Edge Fn | 🟡 Medium | ✅ Done | 2026-02-05 |
| 15 | Env Validation | 🟢 Low | ✅ Done | 2026-02-05 |
| 16 | Error Format | 🟢 Low | ✅ Done | 2026-02-05 |
| 17 | Type Safety | 🟢 Low | ✅ Done | 2026-02-05 |
| 18 | Config Constants | 🟢 Low | ✅ Done | 2026-02-05 |
| 19 | Skeleton Loading | 🟢 Low | ✅ Done | 2026-02-05 |
| 20 | Toast Feedback | 🟢 Low | ✅ Done | 2026-02-05 |
| 21 | Keyboard Shortcuts | 🔵 Feature | ✅ Done | 2026-02-05 |
| 22 | Confirmation Dialogs | 🔵 Feature | ✅ Done | 2026-02-05 |
| 23 | CSV Export | 🔵 Feature | ✅ Done | 2026-02-05 |
| 24 | Duplicate Item | 🔵 Feature | ✅ Done | 2026-02-05 |
| 25 | Price History | 🔵 Feature | ✅ Done | 2026-02-05 |
| 26 | Batch Import | 🔵 Feature | ✅ Done | 2026-02-05 |
| 27 | Item Comparison | 🔵 Feature | ✅ Done | 2026-02-05 |
| 28 | Analytics Charts | 🔵 Feature | ✅ Done | 2026-02-05 |
| 29 | Saved Filters | 🔵 Feature | ✅ Done | 2026-02-05 |
| 30 | Print Labels | 🔵 Feature | ✅ Done | 2026-02-05 |

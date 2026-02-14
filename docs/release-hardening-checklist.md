# Release Hardening Checklist

## 1) Baseline Health Gates

- [x] `npm run lint`
- [x] `npm run build`
- [ ] Integration tests: unskipped and green in target environment

> Note: RMA integration specs currently execute but are skipped under local gating conditions. Run in staging with required env and data fixtures.

## 2) Runtime Stability

- [x] Dev runtime stabilized with Turbopack (`npm run dev`)
- [x] Build artifacts ignored in git (`next-dist/` and `.next/`)
- [x] RMA page async loading hardened against stale/unmounted updates

## 3) RMA Functional Smoke Tests

- [x] `/rma` loads reliably
- [x] `/api/rma/orders?search=<name>&limit=5` returns successful response
- [ ] Manual UI checks in staging:
  - [ ] Create RMA case from order search
  - [ ] Transition case status across lifecycle
  - [ ] Assign owner/technician and verify queue filters
  - [ ] Add tracking and verify logistics exceptions/KPI cards
  - [ ] Open RMA detail page and verify all tabs

## 4) Migration Safety

Pending migration files:

- `migrations/012_harden_shopify_rls.sql`
- `migrations/013_api_idempotency_keys.sql`
- `migrations/016_rma_sources_and_dedupe.sql`
- `migrations/017_rma_ops_enrichment.sql`
- `migrations/018_rma_assignment_fields.sql`

Required before production rollout:

- [ ] Apply in staging, in order
- [ ] Validate API compatibility with latest schema
- [ ] Confirm rollback approach and DB backup point

## 5) Security and Integration Checks

- [ ] Shopify webhook signature validation active in deployed env
- [ ] Shopify token scopes include required read access (`read_orders`)
- [ ] CSRF policy verified for state-changing routes
- [ ] No secrets committed (`.env.local` remains untracked)

## 6) Release Command Sequence

```bash
npm ci
npm run lint
npm run build
npx playwright test --config=playwright.integration.config.ts
```

If all gates pass in CI/staging:

- [ ] Merge to release branch
- [ ] Apply migrations
- [ ] Deploy
- [ ] Run post-deploy RMA smoke checks


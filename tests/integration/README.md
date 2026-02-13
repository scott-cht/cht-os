# Integration Test Scaffold

These tests target live API routes and require a running app.

## Run

1. Start the app locally (for example `npm run dev`).
2. Set required environment variables:
   - `RUN_API_INTEGRATION_TESTS=true`
   - `RUN_KLAVIYO_INTEGRATION_TESTS=true` (only if you want to run Klaviyo idempotency tests)
   - `RUN_KLAVIYO_BEHAVIOR_TESTS=true` (only if you want to run Klaviyo success-path behavior tests)
   - `RUN_KLAVIYO_SENDER_VALIDATION_TESTS=true` (optional; use when sender defaults are intentionally unset to verify validation)
   - `INTEGRATION_BASE_URL` (optional, defaults to `http://localhost:3000`)
   - `INTERNAL_API_KEY` (optional, if middleware API key auth is enabled)
   - `TEST_SHOPIFY_PRODUCT_ID` (required for sync-route idempotency test)
   - `TEST_KLAVIYO_STYLE_GUIDE_ID` (required for Klaviyo generate success-path test)
3. Run:

```bash
npm run test:integration
```

## Notes

- Tests are intentionally skipped unless `RUN_API_INTEGRATION_TESTS=true`.
- Klaviyo idempotency tests are additionally skipped unless `RUN_KLAVIYO_INTEGRATION_TESTS=true`.
- Klaviyo success-path behavior tests are additionally skipped unless `RUN_KLAVIYO_BEHAVIOR_TESTS=true`.
- Sender-config validation test is additionally skipped unless `RUN_KLAVIYO_SENDER_VALIDATION_TESTS=true`.
- These are real integration tests (no mocks), so they depend on configured services.
- The suite includes idempotency coverage plus Klaviyo generate/push validation and success-path checks.

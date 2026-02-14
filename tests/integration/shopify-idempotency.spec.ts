import { test } from '@playwright/test';
import {
  makeIdempotencyKey,
  expectIdempotencyConflict,
  expectIdempotencyReplay,
} from './utils/idempotency';

const runIntegration = process.env.RUN_API_INTEGRATION_TESTS === 'true';

test.describe('Shopify API idempotency', () => {
  test.skip(!runIntegration, 'Set RUN_API_INTEGRATION_TESTS=true to run integration tests');

  test('import endpoint replays response on duplicate idempotency key', async ({ request }) => {
    const key = makeIdempotencyKey('import');
    const payload = { status: 'active', limit: 1 };

    const first = await request.post('/api/shopify/import', {
      headers: { 'idempotency-key': key },
      data: payload,
    });
    const second = await request.post('/api/shopify/import', {
      headers: { 'idempotency-key': key },
      data: payload,
    });
    await expectIdempotencyReplay(first, second);
  });

  test('sync endpoint rejects reused key with different payload', async ({ request }) => {
    const productId = process.env.TEST_SHOPIFY_PRODUCT_ID;
    test.skip(!productId, 'Set TEST_SHOPIFY_PRODUCT_ID to run sync idempotency test');

    const key = makeIdempotencyKey('sync');
    const firstPayload = { fields: { title: true }, createSnapshot: false };
    const secondPayload = { fields: { description: true }, createSnapshot: false };

    await request.post(`/api/shopify/products/${productId}/sync`, {
      headers: { 'idempotency-key': key },
      data: firstPayload,
    });

    const second = await request.post(`/api/shopify/products/${productId}/sync`, {
      headers: { 'idempotency-key': key },
      data: secondPayload,
    });
    await expectIdempotencyConflict(second, 'Idempotency key reused');
  });

  test('enrich endpoint replays response on duplicate idempotency key', async ({ request }) => {
    const productId = process.env.TEST_SHOPIFY_PRODUCT_ID;
    test.skip(!productId, 'Set TEST_SHOPIFY_PRODUCT_ID to run enrich idempotency test');

    const key = makeIdempotencyKey('enrich');

    const first = await request.post(`/api/shopify/products/${productId}/enrich`, {
      headers: { 'idempotency-key': key },
      data: {},
    });
    const second = await request.post(`/api/shopify/products/${productId}/enrich`, {
      headers: { 'idempotency-key': key },
      data: {},
    });
    await expectIdempotencyReplay(first, second);
  });
});

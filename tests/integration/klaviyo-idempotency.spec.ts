import { test } from '@playwright/test';
import {
  makeIdempotencyKey,
  makeUniqueText,
  expectIdempotencyConflict,
  expectIdempotencyReplay,
} from './utils/idempotency';

const runIntegration = process.env.RUN_API_INTEGRATION_TESTS === 'true';
const runKlaviyoIntegration = process.env.RUN_KLAVIYO_INTEGRATION_TESTS === 'true';

test.describe('Klaviyo API idempotency', () => {
  test.skip(!runIntegration, 'Set RUN_API_INTEGRATION_TESTS=true to run integration tests');
  test.skip(
    !runKlaviyoIntegration,
    'Set RUN_KLAVIYO_INTEGRATION_TESTS=true to run Klaviyo idempotency tests'
  );

  test('generate endpoint replays response on duplicate idempotency key', async ({ request }) => {
    const key = makeIdempotencyKey('klaviyo-generate');
    const payload = {
      styleGuideIds: ['00000000-0000-0000-0000-000000000001'],
      intent: makeUniqueText('Integration test intent'),
      filter: {
        listingTypes: ['new'],
        limit: 1,
      },
    };

    const first = await request.post('/api/klaviyo/generate', {
      headers: { 'idempotency-key': key },
      data: payload,
    });
    const second = await request.post('/api/klaviyo/generate', {
      headers: { 'idempotency-key': key },
      data: payload,
    });
    await expectIdempotencyReplay(first, second);
  });

  test('push endpoint rejects reused key with different payload', async ({ request }) => {
    const key = makeIdempotencyKey('klaviyo-push-conflict');
    const firstPayload = {
      subject: makeUniqueText('Idempotency test subject'),
      preheader: 'First preheader',
      htmlBody: '<div><p>First body</p></div>',
      createCampaign: false,
    };
    const secondPayload = {
      ...firstPayload,
      subject: `${firstPayload.subject} changed`,
      htmlBody: '<div><p>Second body</p></div>',
    };

    await request.post('/api/klaviyo/push', {
      headers: { 'idempotency-key': key },
      data: firstPayload,
    });

    const second = await request.post('/api/klaviyo/push', {
      headers: { 'idempotency-key': key },
      data: secondPayload,
    });
    await expectIdempotencyConflict(second, 'Idempotency key reused');
  });

  test('push endpoint replays response on duplicate idempotency key', async ({ request }) => {
    const key = makeIdempotencyKey('klaviyo-push-replay');
    const payload = {
      subject: makeUniqueText('Idempotency replay'),
      preheader: 'Replay preheader',
      htmlBody: '<div><p>Replay body</p></div>',
      createCampaign: false,
    };

    const first = await request.post('/api/klaviyo/push', {
      headers: { 'idempotency-key': key },
      data: payload,
    });
    const second = await request.post('/api/klaviyo/push', {
      headers: { 'idempotency-key': key },
      data: payload,
    });
    await expectIdempotencyReplay(first, second);
  });
});

import { expect, test } from '@playwright/test';
import { makeUniqueText } from './utils/idempotency';

const runIntegration = process.env.RUN_API_INTEGRATION_TESTS === 'true';
const runKlaviyoBehavior = process.env.RUN_KLAVIYO_BEHAVIOR_TESTS === 'true';
const runSenderValidation = process.env.RUN_KLAVIYO_SENDER_VALIDATION_TESTS === 'true';
const styleGuideId = process.env.TEST_KLAVIYO_STYLE_GUIDE_ID;

test.describe('Klaviyo API behavior', () => {
  test.skip(!runIntegration, 'Set RUN_API_INTEGRATION_TESTS=true to run integration tests');

  test('generate returns validation error for invalid payload', async ({ request }) => {
    const response = await request.post('/api/klaviyo/generate', {
      data: {
        styleGuideIds: [],
        intent: '',
      },
    });

    const body = await response.json();
    expect(response.status()).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  test('generate returns bad request for unknown style guide IDs', async ({ request }) => {
    const response = await request.post('/api/klaviyo/generate', {
      data: {
        styleGuideIds: ['11111111-1111-4111-8111-111111111111'],
        intent: makeUniqueText('Missing style guide test'),
        filter: {
          listingTypes: ['new'],
          limit: 1,
        },
      },
    });

    const body = await response.json();
    expect(response.status()).toBe(400);
    expect(body.error?.code).toBe('BAD_REQUEST');
    expect(body.error?.message).toContain('No style guides found');
  });

  test('push returns validation error for invalid payload', async ({ request }) => {
    const response = await request.post('/api/klaviyo/push', {
      data: {
        subject: '',
        htmlBody: '',
        createCampaign: false,
      },
    });

    const body = await response.json();
    expect(response.status()).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  test('push returns clear sender-config error when campaign creation enabled', async ({ request }) => {
    test.skip(
      !runSenderValidation,
      'Set RUN_KLAVIYO_SENDER_VALIDATION_TESTS=true when sender defaults are intentionally unset'
    );

    const response = await request.post('/api/klaviyo/push', {
      data: {
        subject: makeUniqueText('Sender config test'),
        htmlBody: '<div><p>Sender config integration test</p></div>',
        createCampaign: true,
      },
    });

    const body = await response.json();
    expect(response.status()).toBe(400);
    expect(body.error?.code).toBe('BAD_REQUEST');
    expect(body.error?.message).toContain('Campaign creation requires sender config');
  });
});

test.describe('Klaviyo API success paths', () => {
  test.skip(!runIntegration, 'Set RUN_API_INTEGRATION_TESTS=true to run integration tests');
  test.skip(!runKlaviyoBehavior, 'Set RUN_KLAVIYO_BEHAVIOR_TESTS=true to run success-path tests');
  test.skip(!styleGuideId, 'Set TEST_KLAVIYO_STYLE_GUIDE_ID to run generate success test');

  test('generate returns email payload for valid request', async ({ request }) => {
    const response = await request.post('/api/klaviyo/generate', {
      data: {
        styleGuideIds: [styleGuideId],
        intent: makeUniqueText('Integration success intent'),
        filter: {
          listingTypes: ['new', 'trade_in'],
          limit: 1,
        },
      },
    });

    const body = await response.json();
    expect(response.status()).toBe(200);
    expect(typeof body.subject).toBe('string');
    expect(typeof body.htmlBody).toBe('string');
    expect(body.subject.length).toBeGreaterThan(0);
    expect(body.htmlBody.length).toBeGreaterThan(0);
  });

  test('push creates a template for valid payload', async ({ request }) => {
    const response = await request.post('/api/klaviyo/push', {
      data: {
        subject: makeUniqueText('Klaviyo push success'),
        preheader: 'Integration preheader',
        htmlBody: '<div><p>Integration push body</p></div>',
        createCampaign: false,
      },
    });

    const body = await response.json();
    expect(response.status()).toBe(200);
    expect(typeof body.templateId).toBe('string');
    expect(body.templateId.length).toBeGreaterThan(0);
  });
});

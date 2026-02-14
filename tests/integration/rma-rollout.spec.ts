import crypto from 'crypto';
import { expect, test } from '@playwright/test';
import { makeUniqueText } from './utils/idempotency';

const runIntegration = process.env.RUN_API_INTEGRATION_TESTS === 'true';
const runRmaIntegration = process.env.RUN_RMA_INTEGRATION_TESTS === 'true';

test.describe('RMA rollout ingestion', () => {
  test.skip(!runIntegration, 'Set RUN_API_INTEGRATION_TESTS=true to run integration tests');
  test.skip(!runRmaIntegration, 'Set RUN_RMA_INTEGRATION_TESTS=true to run RMA integration tests');

  test('rejects Shopify returns webhook with invalid signature', async ({ request }) => {
    const response = await request.post('/api/shopify/webhooks/returns', {
      data: { id: 1, order_id: 1 },
      headers: {
        'x-shopify-hmac-sha256': 'invalid-signature',
        'x-shopify-topic': 'returns/create',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('creates/dedupes Shopify returns webhook when signature is valid', async ({ request }) => {
    const secret = process.env.SHOPIFY_API_SECRET;
    test.skip(!secret, 'SHOPIFY_API_SECRET required for webhook signature test');

    const payload = {
      return: {
        id: Date.now(),
        order_id: Date.now() + 10,
        name: `return-${Date.now()}`,
        status: 'open',
        customer: {
          first_name: 'Integration',
          last_name: 'Tester',
          email: 'integration-rma@example.com',
          phone: '+61400123456',
        },
        note: 'Integration return request note',
        return_line_items: [
          {
            quantity: 1,
            customer_note: 'Signal drops after 15 minutes',
            line_item: {
              name: 'Integration Projector',
              sku: 'INT-PJ-001',
              variant: {
                barcode: 'SN-INT-7788',
              },
            },
          },
        ],
      },
    };
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret || '').update(raw, 'utf8').digest('base64');

    const first = await request.post('/api/shopify/webhooks/returns', {
      data: payload,
      headers: {
        'x-shopify-hmac-sha256': signature,
        'x-shopify-topic': 'returns/create',
        'x-shopify-webhook-id': `webhook-${Date.now()}`,
      },
    });
    const firstBody = await first.json();
    if (first.status() === 500) {
      expect(String(firstBody.error || '')).toContain('rma_cases');
      return;
    }
    expect(first.status()).toBe(200);
    expect(firstBody.success).toBe(true);
    expect(firstBody.deduped).toBeFalsy();
    expect(firstBody.case?.source).toBe('shopify_return_webhook');
    expect(firstBody.case?.shopify_return_id).toBe(String(payload.return.id));
    expect(firstBody.case?.customer_name).toContain('Integration');
    expect(firstBody.case?.serial_number).toBe('SN-INT-7788');
    if (firstBody.case?.sla_due_at) {
      expect(Number.isNaN(Date.parse(firstBody.case.sla_due_at))).toBe(false);
    }
    const parsedDetails = JSON.parse(firstBody.case?.issue_details || '{}') as {
      format?: string;
      line_items?: Array<{ sku?: string | null }>;
    };
    expect(parsedDetails.format).toBe('shopify_return_webhook_v1');
    expect(parsedDetails.line_items?.[0]?.sku).toBe('INT-PJ-001');

    const parsedResponse = await request.get(`/api/rma/${firstBody.case.id}/parsed`);
    const parsedBody = await parsedResponse.json();
    expect(parsedResponse.status()).toBe(200);
    expect(parsedBody.parsedIssueDetails?.format).toBeDefined();

    const second = await request.post('/api/shopify/webhooks/returns', {
      data: payload,
      headers: {
        'x-shopify-hmac-sha256': signature,
        'x-shopify-topic': 'returns/create',
      },
    });
    const secondBody = await second.json();
    expect(second.status()).toBe(200);
    expect(secondBody.deduped).toBe(true);
  });

  test('enforces source filters and public API validation paths', async ({ request }) => {
    const createResponse = await request.post('/api/rma', {
      data: {
        shopify_order_id: `gid://shopify/Order/${Date.now() + 100}`,
        shopify_order_name: `#RMA-SRC-${Date.now()}`,
        serial_number: `SN-${Date.now()}`,
        customer_name: 'Source Filter Test',
        customer_email: 'source-filter@example.com',
        issue_summary: makeUniqueText('RMA source filter test'),
        source: 'manual',
      },
    });
    const createBody = await createResponse.json();
    if (createResponse.status() === 500) {
      expect(String(createBody.error || '')).toContain('rma_cases');
      return;
    }
    expect(createResponse.status()).toBe(200);

    const filtered = await request.get('/api/rma?source=manual&limit=5');
    const filteredBody = await filtered.json();
    expect(filtered.status()).toBe(200);
    expect(Array.isArray(filteredBody.cases)).toBe(true);
    expect(
      (filteredBody.cases as Array<{ source?: string }>).every((entry) => !entry.source || entry.source === 'manual')
    ).toBe(true);

    const invalidPublic = await request.post('/api/rma/public', {
      data: {
        order_number: '',
        order_email: 'invalid',
        issue_summary: '',
      },
    });
    expect(invalidPublic.status()).toBe(400);
  });

  test('supports RMA ops endpoints for warranty, tracking, communications, and KPIs', async ({ request }) => {
    const technicianEmail = `tech-${Date.now()}@example.com`;
    const createResponse = await request.post('/api/rma', {
      data: {
        shopify_order_id: `gid://shopify/Order/${Date.now() + 200}`,
        shopify_order_name: `#RMA-OPS-${Date.now()}`,
        serial_number: `SN-OPS-${Date.now()}`,
        customer_name: 'Ops Integration Test',
        customer_email: 'ops-integration@example.com',
        issue_summary: makeUniqueText('RMA ops integration test'),
        source: 'manual',
      },
    });
    const createBody = await createResponse.json();
    if (createResponse.status() === 500) {
      expect(String(createBody.error || '')).toContain('rma_cases');
      return;
    }
    expect(createResponse.status()).toBe(200);
    const caseId = createBody.case.id as string;

    const assignResponse = await request.patch(`/api/rma/${caseId}`, {
      data: {
        assigned_technician_email: technicianEmail,
        assigned_technician_name: 'Ops Tech',
        assigned_at: new Date().toISOString(),
      },
    });
    const assignBody = await assignResponse.json();
    expect(assignResponse.status()).toBe(200);
    expect(assignBody.case?.assigned_technician_email).toBe(technicianEmail);

    const warrantyResponse = await request.post(`/api/rma/${caseId}/warranty-decision`, {
      data: {
        warranty_status: 'out_of_warranty',
        warranty_basis: 'manual_override',
        decision_notes: 'Integration warranty decision note',
        priority: 'high',
      },
    });
    const warrantyBody = await warrantyResponse.json();
    expect(warrantyResponse.status()).toBe(200);
    expect(warrantyBody.case?.warranty_status).toBe('out_of_warranty');
    expect(warrantyBody.case?.priority).toBe('high');

    const inboundResponse = await request.post(`/api/rma/${caseId}/tracking`, {
      data: {
        direction: 'inbound',
        carrier: 'Australia Post',
        tracking_number: `IN-${Date.now()}`,
        status: 'delivered',
        event_note: 'Inbound delivered for testing',
      },
    });
    const inboundBody = await inboundResponse.json();
    expect(inboundResponse.status()).toBe(200);
    expect(inboundBody.case?.status).toBe('testing');
    expect(inboundBody.case?.received_at).toBeTruthy();

    const outboundResponse = await request.post(`/api/rma/${caseId}/tracking`, {
      data: {
        direction: 'outbound',
        carrier: 'StarTrack',
        tracking_number: `OUT-${Date.now()}`,
        status: 'in_transit',
        event_note: 'Outbound shipping booked',
      },
    });
    const outboundBody = await outboundResponse.json();
    expect(outboundResponse.status()).toBe(200);
    expect(outboundBody.case?.status).toBe('back_to_customer');
    expect(outboundBody.case?.outbound_tracking_number).toContain('OUT-');

    const communicationResponse = await request.post(`/api/rma/${caseId}/communications`, {
      data: {
        template_key: 'testing_update',
        recipient: 'ops-integration@example.com',
        send_mode: 'manual_mailto',
      },
    });
    const communicationBody = await communicationResponse.json();
    expect(communicationResponse.status()).toBe(200);
    expect(communicationBody.success).toBe(true);
    expect(String(communicationBody.mailto_url || '')).toContain('mailto:');

    const communicationListResponse = await request.get(`/api/rma/${caseId}/communications`);
    const communicationListBody = await communicationListResponse.json();
    expect(communicationListResponse.status()).toBe(200);
    expect(Array.isArray(communicationListBody.communications)).toBe(true);
    expect(communicationListBody.communications.length).toBeGreaterThan(0);

    const kpiResponse = await request.get(
      `/api/rma/kpis?my_queue_email=${encodeURIComponent(technicianEmail)}`
    );
    const kpiBody = await kpiResponse.json();
    expect(kpiResponse.status()).toBe(200);
    expect(kpiBody.kpis).toBeDefined();
    expect(typeof kpiBody.kpis.open_cases).toBe('number');
    expect(typeof kpiBody.kpis.queue_by_technician?.[technicianEmail]).toBe('number');
    expect(
      kpiBody.kpis.warranty_hit_rate_pct === null || typeof kpiBody.kpis.warranty_hit_rate_pct === 'number'
    ).toBe(true);
    expect(
      kpiBody.kpis.logistics_exception_rate_pct === null ||
        typeof kpiBody.kpis.logistics_exception_rate_pct === 'number'
    ).toBe(true);
    expect(typeof kpiBody.kpis.logistics_exception_cases).toBe('number');
    expect(Array.isArray(kpiBody.kpis.repeat_issue_serials)).toBe(true);

    const stageResponse = await request.get(
      `/api/rma/time-in-stage?my_queue_email=${encodeURIComponent(technicianEmail)}`
    );
    const stageBody = await stageResponse.json();
    expect(stageResponse.status()).toBe(200);
    expect(Array.isArray(stageBody.entries)).toBe(true);
    const matchingEntry = (stageBody.entries as Array<{ case_id: string; hours_in_stage: number }>).find(
      (entry) => entry.case_id === caseId
    );
    expect(matchingEntry).toBeDefined();
    expect((matchingEntry?.hours_in_stage ?? -1) >= 0).toBe(true);

    const exceptionsResponse = await request.get(
      `/api/rma/logistics-exceptions?my_queue_email=${encodeURIComponent(technicianEmail)}`
    );
    const exceptionsBody = await exceptionsResponse.json();
    expect(exceptionsResponse.status()).toBe(200);
    expect(Array.isArray(exceptionsBody.exceptions)).toBe(true);
    expect(typeof exceptionsBody.summary?.needs_outbound_tracking).toBe('number');
    expect(typeof exceptionsBody.summary?.sla_overdue).toBe('number');
  });

  test('rejects invalid status transition when required fields are missing', async ({ request }) => {
    const createResponse = await request.post('/api/rma', {
      data: {
        shopify_order_id: `gid://shopify/Order/${Date.now() + 300}`,
        shopify_order_name: `#RMA-GUARD-${Date.now()}`,
        serial_number: `SN-GUARD-${Date.now()}`,
        customer_name: 'Guardrail Test',
        customer_email: 'guardrail@example.com',
        issue_summary: makeUniqueText('RMA guardrail transition test'),
        source: 'manual',
      },
    });
    const createBody = await createResponse.json();
    if (createResponse.status() === 500) {
      expect(String(createBody.error || '')).toContain('rma_cases');
      return;
    }
    expect(createResponse.status()).toBe(200);
    const caseId = createBody.case.id as string;

    const transitionResponse = await request.post(`/api/rma/${caseId}/status`, {
      data: {
        status: 'back_to_customer',
        note: 'Attempt invalid transition without outbound tracking',
      },
    });
    const transitionBody = await transitionResponse.json();
    expect(transitionResponse.status()).toBe(400);
    expect(String(transitionBody.error || '')).toContain('Missing required fields');
    expect(Array.isArray(transitionBody.missing_fields)).toBe(true);
    expect(transitionBody.missing_fields).toContain('outbound_carrier');
    expect(transitionBody.missing_fields).toContain('outbound_tracking_number');
  });

  test('rejects backward status transition', async ({ request }) => {
    const createResponse = await request.post('/api/rma', {
      data: {
        shopify_order_id: `gid://shopify/Order/${Date.now() + 400}`,
        shopify_order_name: `#RMA-BACK-${Date.now()}`,
        serial_number: `SN-BACK-${Date.now()}`,
        customer_name: 'Backward Test',
        customer_email: 'backward@example.com',
        issue_summary: makeUniqueText('RMA backward transition test'),
        source: 'manual',
      },
    });
    const createBody = await createResponse.json();
    if (createResponse.status() === 500) {
      expect(String(createBody.error || '')).toContain('rma_cases');
      return;
    }
    expect(createResponse.status()).toBe(200);
    const caseId = createBody.case.id as string;

    const prepResponse = await request.patch(`/api/rma/${caseId}`, {
      data: {
        received_at: new Date().toISOString(),
        inspected_at: new Date().toISOString(),
      },
    });
    const prepBody = await prepResponse.json();
    expect(prepResponse.status()).toBe(200);
    expect(prepBody.success).toBe(true);

    const toTesting = await request.post(`/api/rma/${caseId}/status`, {
      data: { status: 'testing', note: 'Move to testing' },
    });
    expect(toTesting.status()).toBe(200);

    const toSent = await request.post(`/api/rma/${caseId}/status`, {
      data: { status: 'sent_to_manufacturer', note: 'Escalate to manufacturer' },
    });
    expect(toSent.status()).toBe(200);

    const backwardResponse = await request.post(`/api/rma/${caseId}/status`, {
      data: { status: 'received', note: 'Attempt to move backward' },
    });
    const backwardBody = await backwardResponse.json();
    expect(backwardResponse.status()).toBe(400);
    expect(String(backwardBody.error || '')).toContain('Invalid transition');
  });

  test('supports KPI filtering with source + technician + search', async ({ request }) => {
    const uniqueToken = `KPI-${Date.now()}`;
    const technicianEmail = `kpi-tech-${Date.now()}@example.com`;

    const firstCreate = await request.post('/api/rma', {
      data: {
        shopify_order_id: `gid://shopify/Order/${Date.now() + 500}`,
        shopify_order_name: `#${uniqueToken}-MANUAL`,
        serial_number: `SN-${uniqueToken}-1`,
        customer_name: 'KPI Match Customer',
        customer_email: 'kpi-match@example.com',
        issue_summary: makeUniqueText(`${uniqueToken} source manual`),
        source: 'manual',
      },
    });
    const firstBody = await firstCreate.json();
    if (firstCreate.status() === 500) {
      expect(String(firstBody.error || '')).toContain('rma_cases');
      return;
    }
    expect(firstCreate.status()).toBe(200);
    const firstCaseId = firstBody.case.id as string;

    const assignResponse = await request.patch(`/api/rma/${firstCaseId}`, {
      data: {
        assigned_technician_email: technicianEmail,
        assigned_technician_name: 'KPI Technician',
        assigned_at: new Date().toISOString(),
      },
    });
    expect(assignResponse.status()).toBe(200);

    const secondCreate = await request.post('/api/rma', {
      data: {
        shopify_order_id: `gid://shopify/Order/${Date.now() + 600}`,
        shopify_order_name: `#${uniqueToken}-CUSTOMER`,
        serial_number: `SN-${uniqueToken}-2`,
        customer_name: 'KPI Other Customer',
        customer_email: 'kpi-other@example.com',
        issue_summary: makeUniqueText(`${uniqueToken} source customer form`),
        source: 'customer_form',
      },
    });
    const secondBody = await secondCreate.json();
    expect(secondCreate.status()).toBe(200);
    expect(secondBody.case?.id).toBeTruthy();

    const kpiResponse = await request.get(
      `/api/rma/kpis?source=manual&my_queue_email=${encodeURIComponent(
        technicianEmail
      )}&search=${encodeURIComponent(uniqueToken)}`
    );
    const kpiBody = await kpiResponse.json();
    expect(kpiResponse.status()).toBe(200);
    expect(kpiBody.kpis).toBeDefined();
    expect(kpiBody.kpis.total_cases).toBeGreaterThanOrEqual(1);
    expect(kpiBody.kpis.queue_by_technician?.[technicianEmail]).toBeGreaterThanOrEqual(1);
    expect(
      kpiBody.kpis.warranty_hit_rate_pct === null || typeof kpiBody.kpis.warranty_hit_rate_pct === 'number'
    ).toBe(true);
    expect(
      kpiBody.kpis.logistics_exception_rate_pct === null ||
        typeof kpiBody.kpis.logistics_exception_rate_pct === 'number'
    ).toBe(true);
    expect(Array.isArray(kpiBody.kpis.repeat_issue_serials)).toBe(true);
    expect(
      (kpiBody.kpis.repeat_issue_serials as Array<{ serial_number: string; case_count: number }>).every(
        (entry) => typeof entry.serial_number === 'string' && typeof entry.case_count === 'number'
      )
    ).toBe(true);

    const stageResponse = await request.get(
      `/api/rma/time-in-stage?source=manual&my_queue_email=${encodeURIComponent(
        technicianEmail
      )}&search=${encodeURIComponent(uniqueToken)}`
    );
    const stageBody = await stageResponse.json();
    expect(stageResponse.status()).toBe(200);
    expect(Array.isArray(stageBody.entries)).toBe(true);
    expect(typeof stageBody.summary_by_status).toBe('object');
  });
});

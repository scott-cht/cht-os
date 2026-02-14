import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/audit/logger';
import { createRmaCase, normalizeSerialNumber } from '@/lib/rma/service';
import type { CreateRmaCaseInput } from '@/lib/rma/service';
import { FETCH_ORDERS_QUERY, getGraphQLClient, isShopifyConfigured } from '@/lib/shopify/client';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import { ValidationError, rmaPublicCreateSchema, validateBody } from '@/lib/validation/schemas';

interface ShopifyOrderSearchNode {
  id: string;
  name: string;
  legacyResourceId: string | null;
  processedAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  email: string | null;
  phone: string | null;
  customer: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        sku: string | null;
        variant: {
          id: string;
          sku: string | null;
          barcode: string | null;
        } | null;
      };
    }>;
  };
}

function parseOrderNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeOrderQuery(orderNumber: string): string {
  const trimmed = orderNumber.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function computeWarranty(input: { orderProcessedAt: string | null }): {
  status: 'in_warranty' | 'out_of_warranty' | 'unknown';
  basis: 'manufacturer' | 'unknown';
  expiresAt: string | null;
  checkedAt: string;
} {
  const checkedAt = new Date().toISOString();
  if (!input.orderProcessedAt) {
    return { status: 'unknown', basis: 'unknown', expiresAt: null, checkedAt };
  }
  const purchasedAt = new Date(input.orderProcessedAt);
  if (Number.isNaN(purchasedAt.getTime())) {
    return { status: 'unknown', basis: 'unknown', expiresAt: null, checkedAt };
  }
  const expiresAtDate = new Date(purchasedAt);
  expiresAtDate.setFullYear(expiresAtDate.getFullYear() + 1);
  return {
    status: expiresAtDate.getTime() >= Date.now() ? 'in_warranty' : 'out_of_warranty',
    basis: 'manufacturer',
    expiresAt: expiresAtDate.toISOString(),
    checkedAt,
  };
}

async function verifyOrderOwnership(orderNumber: string, orderEmail: string): Promise<ShopifyOrderSearchNode | null> {
  if (!(await isShopifyConfigured())) {
    throw new Error('Shopify is not configured');
  }
  const graphqlClient = await getGraphQLClient();
  if (!graphqlClient) {
    throw new Error('Failed to create Shopify client');
  }

  const query = `name:${normalizeOrderQuery(orderNumber)} email:${orderEmail.trim().toLowerCase()}`;
  const result = await graphqlClient.request(FETCH_ORDERS_QUERY, {
    variables: { first: 10, query },
  });
  const data = result.data as {
    orders?: {
      edges?: Array<{ node: ShopifyOrderSearchNode }>;
    };
  };
  const matches = data.orders?.edges?.map((edge) => edge.node) || [];
  return matches[0] || null;
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.scraping, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const rawBody = await request.json();
    const body = validateBody(rmaPublicCreateSchema, rawBody);

    if (body.honeypot && body.honeypot.trim().length > 0) {
      return NextResponse.json({ success: true, accepted: true });
    }

    const matchedOrder = await verifyOrderOwnership(body.order_number, body.order_email);
    if (!matchedOrder) {
      return NextResponse.json(
        { error: 'Order and email combination could not be verified' },
        { status: 403 }
      );
    }

    const customerName = matchedOrder.customer
      ? [matchedOrder.customer.firstName, matchedOrder.customer.lastName].filter(Boolean).join(' ')
      : null;
    const warranty = computeWarranty({ orderProcessedAt: matchedOrder.processedAt || null });

    const supabase = createServerClient();
    const richPayload: CreateRmaCaseInput = {
      shopify_order_id: matchedOrder.id,
      shopify_order_name: matchedOrder.name,
      shopify_order_number: parseOrderNumber(matchedOrder.legacyResourceId),
      serial_number: normalizeSerialNumber(body.serial_number),
      customer_name: customerName || null,
      customer_email: body.order_email.trim().toLowerCase(),
      customer_phone: matchedOrder.customer?.phone || matchedOrder.phone || null,
      customer_first_name: matchedOrder.customer?.firstName || null,
      customer_last_name: matchedOrder.customer?.lastName || null,
      customer_contact_preference: matchedOrder.customer?.email ? 'email' : 'unknown',
      shopify_customer_id: matchedOrder.customer?.id || null,
      order_processed_at: matchedOrder.processedAt,
      order_financial_status: matchedOrder.displayFinancialStatus,
      order_fulfillment_status: matchedOrder.displayFulfillmentStatus,
      order_line_items_json: {
        source: 'customer_form',
        items: matchedOrder.lineItems.edges.map(({ node }) => ({
          id: node.id,
          name: node.name,
          sku: node.sku || node.variant?.sku || null,
          serial: node.variant?.barcode || null,
        })),
      },
      warranty_status: warranty.status,
      warranty_basis: warranty.basis,
      warranty_expires_at: warranty.expiresAt,
      warranty_checked_at: warranty.checkedAt,
      priority: 'normal',
      issue_summary: body.issue_summary,
      issue_details: body.issue_details || null,
      arrival_condition_report: body.arrival_condition_report || null,
      arrival_condition_images: body.arrival_condition_images || [],
      source: 'customer_form',
      submission_channel: 'customer_portal',
      external_reference: `${body.order_number.trim().toLowerCase()}:${body.order_email.trim().toLowerCase()}`,
      createHubSpotTicketOnCreate: true,
    };

    let createResult;
    try {
      createResult = await createRmaCase(supabase, richPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const missingColumn = message.includes('column') && message.includes('rma_cases');
      if (!missingColumn) throw error;

      const fallbackPayload: CreateRmaCaseInput = {
        shopify_order_id: richPayload.shopify_order_id,
        shopify_order_name: richPayload.shopify_order_name,
        shopify_order_number: richPayload.shopify_order_number,
        serial_number: richPayload.serial_number,
        customer_name: richPayload.customer_name,
        customer_email: richPayload.customer_email,
        customer_phone: richPayload.customer_phone,
        issue_summary: richPayload.issue_summary,
        issue_details: richPayload.issue_details,
        arrival_condition_report: richPayload.arrival_condition_report,
        arrival_condition_images: richPayload.arrival_condition_images,
        source: richPayload.source,
        submission_channel: richPayload.submission_channel,
        external_reference: richPayload.external_reference,
        createHubSpotTicketOnCreate: true,
      };
      createResult = await createRmaCase(supabase, fallbackPayload);
    }

    await logAuditEvent({
      entityType: 'rma_case',
      entityId: String(createResult.caseRow.id),
      action: 'create',
      metadata: {
        source: 'customer_form',
        submission_channel: 'customer_portal',
        deduped: createResult.deduped,
      },
      summary: createResult.deduped
        ? `Deduped customer RMA submission for ${matchedOrder.name}`
        : `Created customer RMA submission for ${matchedOrder.name}`,
    });

    return NextResponse.json({
      success: true,
      accepted: true,
      deduped: createResult.deduped,
      caseId: createResult.caseRow.id,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit RMA request' },
      { status: 500 }
    );
  }
}

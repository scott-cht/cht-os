import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/audit/logger';
import { createRmaCase } from '@/lib/rma/service';
import { createServerClient } from '@/lib/supabase/server';
import { rmaWebhookReturnSchema, validateBody } from '@/lib/validation/schemas';
import { FETCH_ORDER_BY_ID_QUERY, getGraphQLClient, isShopifyConfigured } from '@/lib/shopify/client';

type ReturnWebhookPayload = {
  id?: string | number;
  order_id?: string | number;
  name?: string;
  status?: string;
  customer?: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
  };
  email?: string;
  phone?: string;
  note?: string;
  reason?: string;
  return?: {
    id?: string | number;
    order_id?: string | number;
    name?: string;
    status?: string;
    customer?: {
      email?: string;
      phone?: string;
      first_name?: string;
      last_name?: string;
    };
    email?: string;
    phone?: string;
    note?: string;
    reason?: string;
    return_line_items?: Array<{
      reason?: string;
      customer_note?: string;
      sku?: string;
      quantity?: number;
      serial?: string;
      serial_number?: string;
      line_item?: {
        sku?: string;
        name?: string;
        title?: string;
        variant?: {
          sku?: string;
          barcode?: string;
        };
      };
      return_reason?: {
        name?: string;
      };
    }>;
  };
};

function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_API_SECRET || '';
  if (!secret || !hmacHeader) {
    return false;
  }

  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const digestBuffer = Buffer.from(digest);
  const hmacBuffer = Buffer.from(hmacHeader);
  if (digestBuffer.length !== hmacBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(digestBuffer, hmacBuffer);
}

function toOrderGid(orderId: string): string {
  if (orderId.startsWith('gid://shopify/Order/')) return orderId;
  if (/^\d+$/.test(orderId)) return `gid://shopify/Order/${orderId}`;
  return orderId;
}

function extractPayload(raw: ReturnWebhookPayload) {
  const base = raw.return || raw;
  const parsed = validateBody(rmaWebhookReturnSchema, {
    id: base.id,
    order_id: base.order_id,
    name: base.name,
    status: base.status,
  });
  return {
    returnId: String(parsed.id),
    orderId: String(parsed.order_id),
    name: parsed.name || null,
    status: parsed.status || null,
    note: base.note || raw.note || null,
    reason: base.reason || raw.reason || null,
    customer: {
      email: base.customer?.email || raw.customer?.email || base.email || raw.email || null,
      phone: base.customer?.phone || raw.customer?.phone || base.phone || raw.phone || null,
      name:
        [base.customer?.first_name || raw.customer?.first_name, base.customer?.last_name || raw.customer?.last_name]
          .filter(Boolean)
          .join(' ') || null,
    },
    lineItems: base.return_line_items || [],
  };
}

async function fetchOrderDetails(orderId: string) {
  try {
    if (!(await isShopifyConfigured())) return null;
    const graphqlClient = await getGraphQLClient();
    if (!graphqlClient) return null;
    const result = await graphqlClient.request(FETCH_ORDER_BY_ID_QUERY, {
      variables: { id: toOrderGid(orderId) },
    });
    const data = result.data as {
      order?: {
        id: string;
        name: string;
        legacyResourceId: string | null;
      processedAt: string | null;
      displayFinancialStatus: string | null;
      displayFulfillmentStatus: string | null;
      currentTotalPriceSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        } | null;
      } | null;
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
          edges: Array<{ node: { sku: string | null; variant: { barcode: string | null } | null } }>;
        };
      } | null;
    };
    return data.order || null;
  } catch (error) {
    console.warn('Returns webhook order enrichment skipped:', error);
    return null;
  }
}

function parseOrderNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function computeWarranty(input: {
  orderProcessedAt: string | null;
}): {
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
  // Baseline manufacturer window; operator can override in UI/API.
  expiresAtDate.setFullYear(expiresAtDate.getFullYear() + 1);
  const expiresAt = expiresAtDate.toISOString();
  const status = expiresAtDate.getTime() >= Date.now() ? 'in_warranty' : 'out_of_warranty';
  return { status, basis: 'manufacturer', expiresAt, checkedAt };
}

function extractLineItemSummary(
  lineItems: Array<{
    reason?: string;
    customer_note?: string;
    sku?: string;
    quantity?: number;
    serial?: string;
    serial_number?: string;
    line_item?: {
      sku?: string;
      name?: string;
      title?: string;
      variant?: {
        sku?: string;
        barcode?: string;
      };
    };
    return_reason?: {
      name?: string;
    };
  }>
): {
  reasonHint: string;
  skuHint: string | null;
  serialHint: string | null;
  detailLines: string[];
  items: Array<{
    index: number;
    item: string | null;
    sku: string | null;
    serial: string | null;
    qty: number | null;
    reason: string | null;
  }>;
} {
  const reasonParts: string[] = [];
  const detailLines: string[] = [];
  const items: Array<{
    index: number;
    item: string | null;
    sku: string | null;
    serial: string | null;
    qty: number | null;
    reason: string | null;
  }> = [];
  let skuHint: string | null = null;
  let serialHint: string | null = null;

  lineItems.forEach((item, index) => {
    const reason = item.customer_note || item.reason || item.return_reason?.name || null;
    const sku = item.sku || item.line_item?.sku || item.line_item?.variant?.sku || null;
    const serial = item.serial || item.serial_number || item.line_item?.variant?.barcode || null;
    const title = item.line_item?.name || item.line_item?.title || null;
    const qty = item.quantity ?? null;

    if (!skuHint && sku) skuHint = sku;
    if (!serialHint && serial) serialHint = serial;
    if (reason) reasonParts.push(reason);

    const bits = [
      title ? `item=${title}` : null,
      sku ? `sku=${sku}` : null,
      serial ? `serial=${serial}` : null,
      qty !== null ? `qty=${qty}` : null,
      reason ? `reason=${reason}` : null,
    ].filter(Boolean);
    if (bits.length > 0) {
      detailLines.push(`line_${index + 1}: ${bits.join(', ')}`);
    }

    items.push({
      index: index + 1,
      item: title,
      sku,
      serial,
      qty,
      reason,
    });
  });

  return {
    reasonHint: Array.from(new Set(reasonParts)).join(' | '),
    skuHint,
    serialHint,
    detailLines,
    items,
  };
}

function buildStructuredIssueDetails(input: {
  topic: string;
  status: string | null;
  returnId: string;
  orderId: string;
  note: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  primarySku: string | null;
  primarySerial: string | null;
  items: Array<{
    index: number;
    item: string | null;
    sku: string | null;
    serial: string | null;
    qty: number | null;
    reason: string | null;
  }>;
}): string {
  const structured = {
    format: 'shopify_return_webhook_v1',
    source: 'shopify_return_webhook',
    webhook_topic: input.topic,
    return_id: input.returnId,
    order_id: input.orderId,
    return_status: input.status || 'unknown',
    customer: {
      name: input.customerName || null,
      email: input.customerEmail || null,
      phone: input.customerPhone || null,
    },
    primary: {
      sku: input.primarySku || null,
      serial: input.primarySerial || null,
    },
    return_note: input.note || null,
    line_items: input.items,
  };

  return JSON.stringify(structured, null, 2);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const topic = request.headers.get('x-shopify-topic') || 'unknown';
  const webhookId = request.headers.get('x-shopify-webhook-id') || null;

  if (!verifyWebhookHmac(rawBody, hmacHeader)) {
    return NextResponse.json({ error: 'Invalid Shopify webhook signature' }, { status: 401 });
  }

  try {
    const payload = extractPayload(JSON.parse(rawBody) as ReturnWebhookPayload);
    const order = await fetchOrderDetails(payload.orderId);
    const lineSummary = extractLineItemSummary(payload.lineItems);

    const customerName =
      (order?.customer ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') : null) ||
      payload.customer.name;
    const customerEmail = order?.customer?.email || order?.email || payload.customer.email || null;
    const customerPhone = order?.customer?.phone || order?.phone || payload.customer.phone || null;
    const orderSerialHint =
      order?.lineItems.edges.find((edge) => edge.node.variant?.barcode)?.node.variant?.barcode || null;
    const serialHint = lineSummary.serialHint || orderSerialHint;
    const reasonHint = lineSummary.reasonHint || payload.reason || '';
    const warranty = computeWarranty({
      orderProcessedAt: order?.processedAt || null,
    });
    const issueSummary = reasonHint
      ? `Shopify return: ${reasonHint}`
      : `Shopify return received (${payload.status || 'open'})`;
    const issueDetails = buildStructuredIssueDetails({
      topic,
      status: payload.status,
      returnId: payload.returnId,
      orderId: payload.orderId,
      note: payload.note,
      customerName,
      customerEmail,
      customerPhone,
      primarySku: lineSummary.skuHint,
      primarySerial: serialHint,
      items: lineSummary.items,
    });

    const supabase = createServerClient();
    const richPayload = {
      shopify_order_id: toOrderGid(payload.orderId),
      shopify_order_name: order?.name || payload.name || null,
      shopify_order_number: parseOrderNumber(order?.legacyResourceId),
      serial_number: serialHint,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      customer_first_name: order?.customer?.firstName || null,
      customer_last_name: order?.customer?.lastName || null,
      customer_contact_preference: customerEmail ? 'email' : customerPhone ? 'phone' : 'unknown',
      shopify_customer_id: order?.customer?.id || null,
      order_processed_at: order?.processedAt || null,
      order_financial_status: order?.displayFinancialStatus || null,
      order_fulfillment_status: order?.displayFulfillmentStatus || null,
      order_currency: order?.currentTotalPriceSet?.shopMoney?.currencyCode || null,
      order_total_amount: order?.currentTotalPriceSet?.shopMoney?.amount
        ? Number.parseFloat(order.currentTotalPriceSet.shopMoney.amount)
        : null,
      order_line_items_json: {
        source: 'shopify_return_webhook',
        items: lineSummary.items,
      },
      warranty_status: warranty.status,
      warranty_basis: warranty.basis,
      warranty_expires_at: warranty.expiresAt,
      warranty_checked_at: warranty.checkedAt,
      priority: 'normal',
      issue_summary: issueSummary,
      issue_details: issueDetails,
      source: 'shopify_return_webhook',
      submission_channel: 'shopify_webhook',
      shopify_return_id: payload.returnId,
      external_reference: webhookId,
      createHubSpotTicketOnCreate: true,
    };

    let createResult;
    try {
      createResult = await createRmaCase(supabase, richPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const missingColumn = message.includes('column') && message.includes('rma_cases');
      if (!missingColumn) throw error;

      const fallbackPayload = {
        shopify_order_id: richPayload.shopify_order_id,
        shopify_order_name: richPayload.shopify_order_name,
        shopify_order_number: richPayload.shopify_order_number,
        serial_number: richPayload.serial_number,
        customer_name: richPayload.customer_name,
        customer_email: richPayload.customer_email,
        customer_phone: richPayload.customer_phone,
        issue_summary: richPayload.issue_summary,
        issue_details: richPayload.issue_details,
        source: richPayload.source,
        submission_channel: richPayload.submission_channel,
        shopify_return_id: richPayload.shopify_return_id,
        external_reference: richPayload.external_reference,
        createHubSpotTicketOnCreate: true,
      };
      createResult = await createRmaCase(supabase, fallbackPayload);
    }

    await logAuditEvent({
      entityType: 'rma_case',
      entityId: String(createResult.caseRow.id || payload.returnId),
      action: 'create',
      metadata: {
        source: 'shopify_return_webhook',
        topic,
        webhook_id: webhookId,
        deduped: createResult.deduped,
        shopify_return_id: payload.returnId,
      },
      summary: createResult.deduped
        ? `Deduped Shopify return webhook ${payload.returnId}`
        : `Created RMA from Shopify return webhook ${payload.returnId}`,
    });

    return NextResponse.json({
      success: true,
      deduped: createResult.deduped,
      case: createResult.caseRow,
    });
  } catch (error) {
    console.error('Shopify returns webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process returns webhook' },
      { status: 500 }
    );
  }
}

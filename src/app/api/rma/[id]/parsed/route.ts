import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';

function parseLegacyIssueDetails(value: string) {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const findValue = (label: string): string | null => {
    const prefix = `${label}:`;
    const line = lines.find((entry) => entry.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!line) return null;
    return line.slice(prefix.length).trim() || null;
  };

  const lineItems = lines
    .filter((line) => /^line_\d+:/i.test(line))
    .map((line, index) => {
      const [, rest = ''] = line.split(':');
      const fields = rest.split(',').map((entry) => entry.trim());
      const item = fields.find((entry) => entry.startsWith('item='))?.replace('item=', '') || null;
      const sku = fields.find((entry) => entry.startsWith('sku='))?.replace('sku=', '') || null;
      const serial = fields.find((entry) => entry.startsWith('serial='))?.replace('serial=', '') || null;
      const qtyRaw = fields.find((entry) => entry.startsWith('qty='))?.replace('qty=', '') || null;
      const reason = fields.find((entry) => entry.startsWith('reason='))?.replace('reason=', '') || null;
      const qty = qtyRaw ? Number.parseInt(qtyRaw, 10) : null;
      return {
        index: index + 1,
        item,
        sku,
        serial,
        qty: Number.isNaN(qty ?? Number.NaN) ? null : qty,
        reason,
      };
    });

  return {
    format: 'shopify_return_webhook_legacy',
    webhook_topic: findValue('Webhook topic') || 'unknown',
    return_note: findValue('Return note'),
    primary_sku: findValue('Primary SKU'),
    line_items: lineItems,
    raw: value,
  };
}

function parseIssueDetails(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && parsed.format === 'shopify_return_webhook_v1') {
      return parsed;
    }
  } catch {
    // fall through to legacy parser
  }
  return parseLegacyIssueDetails(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.inventory, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { data: rmaCase, error } = await supabase
      .from('rma_cases')
      .select('id, issue_details, source, shopify_return_id')
      .eq('id', id)
      .single();

    if (error || !rmaCase) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }

    return NextResponse.json({
      caseId: rmaCase.id,
      source: rmaCase.source,
      shopifyReturnId: rmaCase.shopify_return_id,
      parsedIssueDetails: parseIssueDetails(rmaCase.issue_details),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse RMA details' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  rmaTrackingUpdateSchema,
  validateBody,
  ValidationError,
} from '@/lib/validation/schemas';
import { appendSerialServiceEvent, normalizeSerialNumber, upsertSerialRegistry } from '@/lib/rma/service';

function includesDelivered(status: string | null | undefined): boolean {
  if (!status) return false;
  return status.toLowerCase().includes('delivered');
}

export async function POST(
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
    const body = validateBody(rmaTrackingUpdateSchema, await request.json());
    const supabase = createServerClient();

    const { data: currentCase, error: currentError } = await supabase
      .from('rma_cases')
      .select('*')
      .eq('id', id)
      .single();
    if (currentError || !currentCase) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const deliveredAt = body.delivered_at || nowIso;
    const updatePayload: Record<string, unknown> = {};

    if (body.direction === 'inbound') {
      updatePayload.inbound_carrier = body.carrier || null;
      updatePayload.inbound_tracking_number = body.tracking_number || null;
      updatePayload.inbound_tracking_url = body.tracking_url || null;
      updatePayload.inbound_status = body.status || null;

      const delivered = includesDelivered(body.status);
      if (delivered && !currentCase.received_at) {
        updatePayload.received_at = deliveredAt;
      }
      if (delivered && currentCase.status === 'received') {
        updatePayload.status = 'testing';
        updatePayload.inspected_at = currentCase.inspected_at || nowIso;
      }
    } else {
      updatePayload.outbound_carrier = body.carrier || null;
      updatePayload.outbound_tracking_number = body.tracking_number || null;
      updatePayload.outbound_tracking_url = body.tracking_url || null;
      updatePayload.outbound_status = body.status || null;

      if (body.tracking_number && !currentCase.shipped_back_at) {
        updatePayload.shipped_back_at = nowIso;
      }

      const delivered = includesDelivered(body.status);
      if (delivered) {
        updatePayload.delivered_back_at = deliveredAt;
        if (!currentCase.closed_at) {
          updatePayload.closed_at = deliveredAt;
        }
      }

      if (body.tracking_number && currentCase.status !== 'back_to_customer') {
        updatePayload.status = 'back_to_customer';
      }
    }

    const { data: updatedCase, error: updateError } = await supabase
      .from('rma_cases')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();
    if (updateError || !updatedCase) {
      if (updateError?.message?.includes('column') && updateError?.message?.includes('rma_cases')) {
        return NextResponse.json(
          { error: 'Tracking fields are unavailable. Apply migration 017_rma_ops_enrichment.sql.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: updateError?.message || 'Failed to update tracking' }, { status: 500 });
    }

    const serial = normalizeSerialNumber(updatedCase.serial_number);
    if (serial) {
      const registry = await upsertSerialRegistry(supabase, {
        serialNumber: serial,
        inventoryItemId: updatedCase.inventory_item_id || null,
      });
      await appendSerialServiceEvent(supabase, {
        serialRegistryId: registry.id,
        rmaCaseId: updatedCase.id,
        eventType: 'service_note',
        summary: `${body.direction === 'inbound' ? 'Inbound' : 'Outbound'} tracking updated`,
        notes: body.event_note || null,
        metadata: {
          direction: body.direction,
          carrier: body.carrier || null,
          tracking_number: body.tracking_number || null,
          status: body.status || null,
        },
      });
    }

    return NextResponse.json({ success: true, case: updatedCase });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA tracking update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update tracking' },
      { status: 500 }
    );
  }
}

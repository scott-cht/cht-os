import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  rmaCaseUpdateSchema,
  validateBody,
  ValidationError,
} from '@/lib/validation/schemas';
import {
  appendSerialServiceEvent,
  mapRmaStatusToEvent,
  normalizeSerialNumber,
  upsertSerialRegistry,
} from '@/lib/rma/service';
import type { RmaStatus } from '@/types';

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
      .select('*')
      .eq('id', id)
      .single();
    if (error || !rmaCase) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }

    let registry = null;
    let events: unknown[] = [];
    if (rmaCase.serial_number) {
      const { data: registryData } = await supabase
        .from('serial_registry')
        .select('*')
        .eq('serial_number', rmaCase.serial_number)
        .maybeSingle();
      registry = registryData || null;

      if (registryData) {
        const { data: eventData } = await supabase
          .from('serial_service_events')
          .select('*')
          .eq('serial_registry_id', registryData.id)
          .order('created_at', { ascending: false });
        events = eventData || [];
      }
    }

    return NextResponse.json({ case: rmaCase, registry, events });
  } catch (error) {
    console.error('RMA detail error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch RMA case' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const rawBody = await request.json();
    const body = validateBody(rmaCaseUpdateSchema, rawBody);

    const supabase = createServerClient();
    const updatePayload: Record<string, unknown> = { ...body };

    const { data: existing, error: existingError } = await supabase
      .from('rma_cases')
      .select('*')
      .eq('id', id)
      .single();
    if (existingError || !existing) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }

    if (existing.serial_number) {
      const serialNumber = normalizeSerialNumber(existing.serial_number);
      if (serialNumber) {
        await upsertSerialRegistry(supabase, {
          serialNumber,
          inventoryItemId: existing.inventory_item_id || null,
        });
      }
    }

    const nowIso = new Date().toISOString();
    const automationNotes: string[] = [];
    const existingInboundTracking = existing.inbound_tracking_number as string | null;
    const incomingInboundTracking = (body.inbound_tracking_number ?? existingInboundTracking) as string | null;
    if (!existingInboundTracking && incomingInboundTracking && !body.received_at && !existing.received_at) {
      updatePayload.received_at = nowIso;
      automationNotes.push('Auto-set received_at after inbound tracking was added.');
    }

    const existingOutboundTracking = existing.outbound_tracking_number as string | null;
    const incomingOutboundTracking = (body.outbound_tracking_number ?? existingOutboundTracking) as string | null;
    const existingStatus = existing.status as RmaStatus;
    if (!existingOutboundTracking && incomingOutboundTracking) {
      if (!body.shipped_back_at && !existing.shipped_back_at) {
        updatePayload.shipped_back_at = nowIso;
        automationNotes.push('Auto-set shipped_back_at after outbound tracking was added.');
      }
      if (!body.status && existingStatus !== 'back_to_customer') {
        updatePayload.status = 'back_to_customer';
        if (!existing.closed_at) {
          updatePayload.closed_at = nowIso;
        }
        automationNotes.push('Auto-moved status to back_to_customer after outbound tracking was added.');
      }
    }

    const { data: updatedCase, error } = await supabase
      .from('rma_cases')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !updatedCase) {
      const missingColumn = error?.message?.includes('column') && error?.message?.includes('rma_cases');
      if (missingColumn) {
        return NextResponse.json(
          {
            error:
              'RMA ops enrichment fields are not available yet. Apply migrations 017_rma_ops_enrichment.sql and 018_rma_assignment_fields.sql, then retry.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error?.message || 'Failed to update RMA case' },
        { status: 500 }
      );
    }

    if (updatedCase.serial_number && automationNotes.length > 0) {
      const serialNumber = normalizeSerialNumber(updatedCase.serial_number);
      if (serialNumber) {
        const registry = await upsertSerialRegistry(supabase, {
          serialNumber,
          inventoryItemId: updatedCase.inventory_item_id || null,
        });
        await appendSerialServiceEvent(supabase, {
          serialRegistryId: registry.id,
          rmaCaseId: updatedCase.id,
          eventType: updatePayload.status ? mapRmaStatusToEvent(updatePayload.status as RmaStatus) : 'service_note',
          summary: 'RMA logistics automation applied',
          notes: automationNotes.join(' '),
          metadata: {
            automation_notes: automationNotes,
          },
        });
      }
    }

    return NextResponse.json({ success: true, case: updatedCase, automationNotes });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update RMA case' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  rmaStatusUpdateSchema,
  validateBody,
  ValidationError,
} from '@/lib/validation/schemas';
import {
  appendSerialServiceEvent,
  mapRmaStatusToEvent,
  normalizeSerialNumber,
  touchRegistryFromRmaStatus,
  upsertSerialRegistry,
} from '@/lib/rma/service';
import { syncRmaStatusToHubSpotTicket } from '@/lib/hubspot/tickets';
import type { RmaStatus } from '@/types';

const STATUS_ORDER: RmaStatus[] = [
  'received',
  'testing',
  'sent_to_manufacturer',
  'repaired_replaced',
  'back_to_customer',
];

function validateTransition(currentStatus: RmaStatus, nextStatus: RmaStatus): string | null {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = STATUS_ORDER.indexOf(nextStatus);
  if (currentIndex === -1 || nextIndex === -1) return null;

  if (nextIndex + 1 < currentIndex) {
    return `Invalid transition from ${currentStatus} to ${nextStatus}. Move forward through workflow stages only.`;
  }

  if (nextStatus === 'repaired_replaced' && currentStatus === 'received') {
    return 'Cannot move directly from received to repaired/replaced. Move to testing first.';
  }

  return null;
}

function requiredFieldsForStatus(nextStatus: RmaStatus, currentCase: Record<string, unknown>): string[] {
  const required: string[] = [];
  const asString = (key: string) => {
    const value = currentCase[key];
    return typeof value === 'string' ? value : null;
  };

  if (nextStatus === 'testing' && !asString('received_at')) {
    required.push('received_at');
  }

  if ((nextStatus === 'sent_to_manufacturer' || nextStatus === 'repaired_replaced') && !asString('inspected_at')) {
    required.push('inspected_at');
  }

  if (nextStatus === 'back_to_customer') {
    if (!asString('outbound_carrier')) required.push('outbound_carrier');
    if (!asString('outbound_tracking_number')) required.push('outbound_tracking_number');
  }

  return required;
}

/**
 * POST /api/rma/[id]/status
 * Update RMA status and write service history event.
 */
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
    const body = validateBody(rmaStatusUpdateSchema, await request.json());
    const supabase = createServerClient();

    const { data: currentCase, error: fetchError } = await supabase
      .from('rma_cases')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError || !currentCase) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }

    const transitionError = validateTransition(currentCase.status as RmaStatus, body.status);
    if (transitionError) {
      return NextResponse.json({ error: transitionError }, { status: 400 });
    }

    const missingFields = requiredFieldsForStatus(body.status, currentCase as Record<string, unknown>);
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required fields before moving to ${body.status}.`,
          missing_fields: missingFields,
        },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      status: body.status,
      ...(body.status === 'received'
        ? { received_at: currentCase.received_at || new Date().toISOString() }
        : {}),
      ...(body.status === 'testing' ? { inspected_at: currentCase.inspected_at || new Date().toISOString() } : {}),
      ...(body.status === 'back_to_customer'
        ? {
            closed_at: new Date().toISOString(),
            shipped_back_at: currentCase.shipped_back_at || new Date().toISOString(),
          }
        : {}),
    };

    const updateResult = await supabase
      .from('rma_cases')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();
    let updatedCase = updateResult.data;
    let updateError = updateResult.error;
    if (updateError || !updatedCase) {
      const missingColumn = updateError?.message?.includes('column') && updateError?.message?.includes('rma_cases');
      if (missingColumn) {
        const fallbackPayload: Record<string, unknown> = {
          status: body.status,
          ...(body.status === 'back_to_customer' ? { closed_at: new Date().toISOString() } : {}),
        };
        const fallbackUpdate = await supabase
          .from('rma_cases')
          .update(fallbackPayload)
          .eq('id', id)
          .select('*')
          .single();
        updatedCase = fallbackUpdate.data;
        updateError = fallbackUpdate.error;
        if (updateError || !updatedCase) {
          return NextResponse.json(
            { error: updateError?.message || 'Failed to update status' },
            { status: 500 }
          );
        }
      }
    }
    if (!updatedCase) {
      return NextResponse.json(
        { error: updateError?.message || 'Failed to update status' },
        { status: 500 }
      );
    }

    const serialNumber = normalizeSerialNumber(updatedCase.serial_number);
    if (serialNumber) {
      const registry = await upsertSerialRegistry(supabase, {
        serialNumber,
        inventoryItemId: updatedCase.inventory_item_id || null,
      });
      await touchRegistryFromRmaStatus(supabase, {
        serialRegistryId: registry.id,
        status: body.status,
      });
      await appendSerialServiceEvent(supabase, {
        serialRegistryId: registry.id,
        rmaCaseId: updatedCase.id,
        eventType: mapRmaStatusToEvent(body.status),
        summary: `RMA status updated to ${body.status}`,
        notes: body.note,
        metadata: {
          previous_status: currentCase.status,
          next_status: body.status,
        },
      });
    }

    let hubspotSync = { attempted: false, success: false as boolean, error: null as string | null };
    try {
      hubspotSync = await syncRmaStatusToHubSpotTicket({
        rmaCaseId: updatedCase.id,
        hubspotTicketId: updatedCase.hubspot_ticket_id,
        status: body.status,
        summary: body.note || updatedCase.issue_summary,
      });
    } catch (syncError) {
      hubspotSync = {
        attempted: true,
        success: false,
        error: syncError instanceof Error ? syncError.message : 'HubSpot ticket sync failed',
      };
    }

    return NextResponse.json({
      success: true,
      case: updatedCase,
      hubspotTicketSync: hubspotSync,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA status update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update RMA status' },
      { status: 500 }
    );
  }
}

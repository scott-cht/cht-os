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

    const updatePayload: Record<string, unknown> = {
      status: body.status,
      ...(body.status === 'back_to_customer' ? { closed_at: new Date().toISOString() } : {}),
    };

    const { data: updatedCase, error: updateError } = await supabase
      .from('rma_cases')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();
    if (updateError || !updatedCase) {
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

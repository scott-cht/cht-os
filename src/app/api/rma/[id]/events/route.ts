import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  rmaServiceEventCreateSchema,
  validateBody,
  ValidationError,
} from '@/lib/validation/schemas';
import { appendSerialServiceEvent, normalizeSerialNumber, upsertSerialRegistry } from '@/lib/rma/service';

/**
 * POST /api/rma/[id]/events
 * Append a service event to the serial history for this RMA case.
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
    const body = validateBody(rmaServiceEventCreateSchema, await request.json());
    const supabase = createServerClient();

    const { data: rmaCase, error: caseError } = await supabase
      .from('rma_cases')
      .select('id, serial_number, inventory_item_id')
      .eq('id', id)
      .single();
    if (caseError || !rmaCase) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }

    const serialNumber = normalizeSerialNumber(rmaCase.serial_number);
    if (!serialNumber) {
      return NextResponse.json(
        { error: 'RMA case has no serial number to attach service history' },
        { status: 400 }
      );
    }

    const registry = await upsertSerialRegistry(supabase, {
      serialNumber,
      inventoryItemId: rmaCase.inventory_item_id || null,
    });

    await appendSerialServiceEvent(supabase, {
      serialRegistryId: registry.id,
      rmaCaseId: rmaCase.id,
      eventType: body.event_type,
      summary: body.summary,
      notes: body.notes,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA service event error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to append service event' },
      { status: 500 }
    );
  }
}

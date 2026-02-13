import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  rmaCaseUpdateSchema,
  validateBody,
  ValidationError,
} from '@/lib/validation/schemas';
import { normalizeSerialNumber, upsertSerialRegistry } from '@/lib/rma/service';

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

    const { data: updatedCase, error } = await supabase
      .from('rma_cases')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !updatedCase) {
      return NextResponse.json(
        { error: error?.message || 'Failed to update RMA case' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, case: updatedCase });
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

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  rmaWarrantyDecisionSchema,
  validateBody,
  ValidationError,
} from '@/lib/validation/schemas';
import { appendSerialServiceEvent, normalizeSerialNumber, upsertSerialRegistry } from '@/lib/rma/service';

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
    const body = validateBody(rmaWarrantyDecisionSchema, await request.json());
    const supabase = createServerClient();

    const { data: currentCase, error: currentError } = await supabase
      .from('rma_cases')
      .select('*')
      .eq('id', id)
      .single();
    if (currentError || !currentCase) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      warranty_status: body.warranty_status,
      warranty_basis: body.warranty_basis,
      warranty_decision_notes: body.decision_notes,
      warranty_checked_at: new Date().toISOString(),
      ...(body.priority ? { priority: body.priority } : {}),
    };

    const { data: updatedCase, error: updateError } = await supabase
      .from('rma_cases')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();
    if (updateError || !updatedCase) {
      if (updateError?.message?.includes('column') && updateError?.message?.includes('rma_cases')) {
        return NextResponse.json(
          { error: 'Warranty decision fields are unavailable. Apply migration 017_rma_ops_enrichment.sql.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: updateError?.message || 'Failed to save warranty decision' }, { status: 500 });
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
        summary: `Warranty decision: ${body.warranty_status.replaceAll('_', ' ')}`,
        notes: body.decision_notes,
        metadata: {
          warranty_status: body.warranty_status,
          warranty_basis: body.warranty_basis,
          priority: body.priority || updatedCase.priority,
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
    console.error('RMA warranty decision error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save warranty decision' },
      { status: 500 }
    );
  }
}

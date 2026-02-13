import type { SupabaseClient } from '@supabase/supabase-js';
import type { RmaStatus, ServiceEventType } from '@/types';

export function normalizeSerialNumber(serial: string | null | undefined): string | null {
  const normalized = serial?.trim();
  return normalized ? normalized.toUpperCase() : null;
}

export function mapRmaStatusToEvent(status: RmaStatus): ServiceEventType {
  switch (status) {
    case 'received':
      return 'rma_received';
    case 'testing':
      return 'rma_testing';
    case 'sent_to_manufacturer':
      return 'rma_sent_to_manufacturer';
    case 'repaired_replaced':
      return 'rma_repaired_replaced';
    case 'back_to_customer':
      return 'rma_back_to_customer';
    default:
      return 'service_note';
  }
}

export async function upsertSerialRegistry(
  supabase: SupabaseClient,
  input: {
    serialNumber: string;
    brand?: string | null;
    model?: string | null;
    inventoryItemId?: string | null;
    soldShopifyOrderId?: string | null;
  }
): Promise<{ id: string; serial_number: string }> {
  const serial = normalizeSerialNumber(input.serialNumber);
  if (!serial) {
    throw new Error('Serial number is required to upsert serial registry');
  }

  const { data: existing, error: existingError } = await supabase
    .from('serial_registry')
    .select('id, serial_number')
    .eq('serial_number', serial)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to read serial registry: ${existingError.message}`);
  }

  if (existing) {
    const updatePayload: Record<string, unknown> = {};
    if (input.brand) updatePayload.brand = input.brand;
    if (input.model) updatePayload.model = input.model;
    if (input.inventoryItemId) updatePayload.first_seen_inventory_id = input.inventoryItemId;
    if (input.soldShopifyOrderId) updatePayload.sold_shopify_order_id = input.soldShopifyOrderId;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('serial_registry')
        .update(updatePayload)
        .eq('id', existing.id);
      if (updateError) {
        throw new Error(`Failed to update serial registry: ${updateError.message}`);
      }
    }

    return existing;
  }

  const insertPayload: Record<string, unknown> = {
    serial_number: serial,
    brand: input.brand || null,
    model: input.model || null,
    first_seen_inventory_id: input.inventoryItemId || null,
    first_seen_at: new Date().toISOString(),
    sold_shopify_order_id: input.soldShopifyOrderId || null,
  };

  const { data: created, error: createError } = await supabase
    .from('serial_registry')
    .insert(insertPayload)
    .select('id, serial_number')
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create serial registry row: ${createError?.message || 'Unknown error'}`);
  }

  return created;
}

export async function appendSerialServiceEvent(
  supabase: SupabaseClient,
  input: {
    serialRegistryId: string;
    rmaCaseId?: string | null;
    eventType: ServiceEventType;
    summary?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const payload: Record<string, unknown> = {
    serial_registry_id: input.serialRegistryId,
    rma_case_id: input.rmaCaseId || null,
    event_type: input.eventType,
    summary: input.summary || null,
    notes: input.notes || null,
    metadata: input.metadata || {},
  };

  const { error } = await supabase.from('serial_service_events').insert(payload);
  if (error) {
    throw new Error(`Failed to append service event: ${error.message}`);
  }
}

export async function touchRegistryFromRmaStatus(
  supabase: SupabaseClient,
  input: {
    serialRegistryId: string;
    status: RmaStatus;
  }
) {
  if (input.status === 'received') {
    const { error } = await supabase.rpc('increment_serial_registry_rma', {
      p_serial_registry_id: input.serialRegistryId,
    });

    if (!error) return;

    // Fallback for environments where RPC hasn't been applied yet.
    const { data: current, error: readError } = await supabase
      .from('serial_registry')
      .select('rma_count')
      .eq('id', input.serialRegistryId)
      .single();
    if (readError) {
      throw new Error(`Failed to read registry count: ${readError.message}`);
    }
    const { error: updateError } = await supabase
      .from('serial_registry')
      .update({
        rma_count: (current?.rma_count || 0) + 1,
        last_rma_at: new Date().toISOString(),
      })
      .eq('id', input.serialRegistryId);
    if (updateError) {
      throw new Error(`Failed to update registry count: ${updateError.message}`);
    }
  }
}

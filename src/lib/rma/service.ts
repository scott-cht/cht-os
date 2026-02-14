import type { SupabaseClient } from '@supabase/supabase-js';
import { createHubSpotTicket, isHubSpotTicketConfigured } from '@/lib/hubspot/tickets';
import type {
  RmaCaseInsert,
  RmaSource,
  RmaStatus,
  ServiceEventType,
} from '@/types';

export function normalizeSerialNumber(serial: string | null | undefined): string | null {
  const normalized = serial?.trim();
  return normalized ? normalized.toUpperCase() : null;
}

export function buildRmaDedupeKey(input: {
  orderId: string;
  serialNumber?: string | null;
  source: RmaSource;
  externalReference?: string | null;
}): string {
  const normalizedSerial = normalizeSerialNumber(input.serialNumber) || 'none';
  const external = input.externalReference?.trim() || 'none';
  return `${input.source}:${input.orderId}:${normalizedSerial}:${external}`.toLowerCase();
}

export function computeDefaultSlaDueAt(priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): string {
  const dueAt = new Date();
  const dayOffsetByPriority: Record<'low' | 'normal' | 'high' | 'urgent', number> = {
    low: 10,
    normal: 7,
    high: 3,
    urgent: 1,
  };
  dueAt.setDate(dueAt.getDate() + dayOffsetByPriority[priority]);
  return dueAt.toISOString();
}

function isMissingRmaColumnError(message: string): boolean {
  return message.includes('column') && message.includes('rma_cases');
}

function stripOpsEnrichmentFields(payload: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...payload };
  const keysToStrip = [
    'customer_first_name',
    'customer_last_name',
    'customer_company',
    'customer_contact_preference',
    'customer_address_json',
    'shopify_customer_id',
    'order_processed_at',
    'order_financial_status',
    'order_fulfillment_status',
    'order_currency',
    'order_total_amount',
    'order_line_items_json',
    'warranty_status',
    'warranty_basis',
    'warranty_expires_at',
    'warranty_decision_notes',
    'warranty_checked_at',
    'inbound_carrier',
    'inbound_tracking_number',
    'inbound_tracking_url',
    'inbound_status',
    'outbound_carrier',
    'outbound_tracking_number',
    'outbound_tracking_url',
    'outbound_status',
    'received_at',
    'inspected_at',
    'shipped_back_at',
    'delivered_back_at',
    'return_label_url',
    'proof_of_delivery_url',
    'disposition',
    'disposition_reason',
    'priority',
    'sla_due_at',
  ];
  keysToStrip.forEach((key) => {
    delete clone[key];
  });
  return clone;
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

export interface CreateRmaCaseInput extends RmaCaseInsert {
  source?: RmaSource;
  createHubSpotTicketOnCreate?: boolean;
}

export async function createRmaCase(
  supabase: SupabaseClient,
  input: CreateRmaCaseInput
): Promise<{
  caseRow: Record<string, unknown>;
  deduped: boolean;
  hubspotTicketSync: { attempted: boolean; success: boolean; error: string | null };
}> {
  const source = input.source || 'manual';
  const serialNumber = normalizeSerialNumber(input.serial_number);
  const dedupeKey =
    input.dedupe_key ||
    buildRmaDedupeKey({
      orderId: input.shopify_order_id,
      serialNumber,
      source,
      externalReference: input.external_reference || input.shopify_return_id || null,
    });

  if (input.shopify_return_id) {
    const { data: existingByReturn } = await supabase
      .from('rma_cases')
      .select('*')
      .eq('shopify_return_id', input.shopify_return_id)
      .maybeSingle();
    if (existingByReturn) {
      return {
        caseRow: existingByReturn,
        deduped: true,
        hubspotTicketSync: { attempted: false, success: false, error: null },
      };
    }
  }

  const { data: existingByKey } = await supabase
    .from('rma_cases')
    .select('*')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  if (existingByKey) {
    return {
      caseRow: existingByKey,
      deduped: true,
      hubspotTicketSync: { attempted: false, success: false, error: null },
    };
  }

  let inventoryMeta: { brand: string | null; model: string | null } = { brand: null, model: null };
  if (input.inventory_item_id) {
    const { data: inventoryItem } = await supabase
      .from('inventory_items')
      .select('brand, model')
      .eq('id', input.inventory_item_id)
      .maybeSingle();
    if (inventoryItem) {
      inventoryMeta = {
        brand: inventoryItem.brand || null,
        model: inventoryItem.model || null,
      };
    }
  }

  const { createHubSpotTicketOnCreate, ...rawInsert } = input;
  const effectivePriority = input.priority || 'normal';
  const slaDueAt = input.sla_due_at || computeDefaultSlaDueAt(effectivePriority);
  const insertPayload: RmaCaseInsert = {
    ...rawInsert,
    serial_number: serialNumber,
    priority: effectivePriority,
    sla_due_at: slaDueAt,
    ...(input.status === 'received' ? { received_at: new Date().toISOString() } : {}),
    source,
    submission_channel:
      input.submission_channel ||
      (source === 'customer_form'
        ? 'customer_portal'
        : source === 'shopify_return_webhook'
          ? 'shopify_webhook'
          : 'internal_dashboard'),
    dedupe_key: dedupeKey,
  };

  let createdCase: Record<string, unknown> | null = null;
  let insertError: { message: string } | null = null;
  const primaryInsert = await supabase
    .from('rma_cases')
    .insert(insertPayload as unknown as Record<string, unknown>)
    .select('*')
    .single();
  createdCase = primaryInsert.data as Record<string, unknown> | null;
  insertError = primaryInsert.error;

  if (insertError && isMissingRmaColumnError(insertError.message)) {
    const fallbackInsertPayload = stripOpsEnrichmentFields(
      insertPayload as unknown as Record<string, unknown>
    );
    const fallbackInsert = await supabase
      .from('rma_cases')
      .insert(fallbackInsertPayload)
      .select('*')
      .single();
    createdCase = fallbackInsert.data as Record<string, unknown> | null;
    insertError = fallbackInsert.error;
  }
  if (insertError || !createdCase) {
    throw new Error(insertError?.message || 'Failed to create RMA case');
  }

  if (serialNumber) {
    const registry = await upsertSerialRegistry(supabase, {
      serialNumber,
      brand: inventoryMeta.brand,
      model: inventoryMeta.model,
      inventoryItemId: input.inventory_item_id || null,
    });
    await touchRegistryFromRmaStatus(supabase, {
      serialRegistryId: registry.id,
      status: (createdCase.status as RmaStatus) || 'received',
    });
    await appendSerialServiceEvent(supabase, {
      serialRegistryId: registry.id,
      rmaCaseId: createdCase.id as string,
      eventType: mapRmaStatusToEvent((createdCase.status as RmaStatus) || 'received'),
      summary: `RMA case created (${createdCase.status})`,
      notes: (createdCase.issue_summary as string) || null,
      metadata: {
        shopify_order_id: createdCase.shopify_order_id,
        source,
      },
    });
  }

  let ticketSync = { attempted: false, success: false, error: null as string | null };
  if (createHubSpotTicketOnCreate && isHubSpotTicketConfigured()) {
    try {
      const ticket = await createHubSpotTicket({
        rmaCaseId: createdCase.id as string,
        subject: `RMA ${(createdCase.shopify_order_name as string) || (createdCase.shopify_order_id as string)}`,
        content: (createdCase.issue_summary as string) || 'RMA case created',
        serialNumber: createdCase.serial_number as string | null,
        customerEmail: createdCase.customer_email as string | null,
        customerPhone: createdCase.customer_phone as string | null,
        status: (createdCase.status as RmaStatus) || 'received',
      });
      await supabase
        .from('rma_cases')
        .update({ hubspot_ticket_id: ticket.ticketId })
        .eq('id', createdCase.id as string);
      ticketSync = { attempted: true, success: true, error: null };
    } catch (error) {
      ticketSync = {
        attempted: true,
        success: false,
        error: error instanceof Error ? error.message : 'HubSpot ticket creation failed',
      };
    }
  }

  return {
    caseRow: createdCase,
    deduped: false,
    hubspotTicketSync: ticketSync,
  };
}

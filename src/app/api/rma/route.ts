import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  rmaCaseCreateSchema,
  rmaListFiltersSchema,
  validateBody,
  validateParams,
  ValidationError,
} from '@/lib/validation/schemas';
import {
  appendSerialServiceEvent,
  mapRmaStatusToEvent,
  normalizeSerialNumber,
  touchRegistryFromRmaStatus,
  upsertSerialRegistry,
} from '@/lib/rma/service';
import { createHubSpotTicket, isHubSpotTicketConfigured } from '@/lib/hubspot/tickets';
import type { RmaCaseInsert } from '@/types';

/**
 * GET /api/rma
 * List RMA cases.
 */
export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.inventory, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const filters = validateParams(rmaListFiltersSchema, searchParams);
    const supabase = createServerClient();

    let query = supabase
      .from('rma_cases')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.serial_number) {
      query = query.eq('serial_number', filters.serial_number.trim().toUpperCase());
    }
    if (filters.customer_email) {
      query = query.eq('customer_email', filters.customer_email);
    }
    if (filters.search) {
      const term = filters.search.trim();
      query = query.or(
        `shopify_order_id.ilike.%${term}%,shopify_order_name.ilike.%${term}%,serial_number.ilike.%${term}%,issue_summary.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%`
      );
    }

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      cases: data || [],
      total: count || 0,
      pagination: {
        offset: filters.offset,
        limit: filters.limit,
        hasMore: (count || 0) > filters.offset + filters.limit,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list RMA cases' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rma
 * Create a new RMA case.
 */
export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.inventory, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const rawBody = await request.json();
    const body = validateBody(rmaCaseCreateSchema, rawBody);
    const supabase = createServerClient();

    const serialNumber = normalizeSerialNumber(body.serial_number);
    let inventoryMeta: { brand: string | null; model: string | null } = {
      brand: null,
      model: null,
    };
    if (body.inventory_item_id) {
      const { data: inventoryItem } = await supabase
        .from('inventory_items')
        .select('brand, model')
        .eq('id', body.inventory_item_id)
        .maybeSingle();
      if (inventoryItem) {
        inventoryMeta = {
          brand: inventoryItem.brand || null,
          model: inventoryItem.model || null,
        };
      }
    }

    const insertPayload: RmaCaseInsert = {
      shopify_order_id: body.shopify_order_id,
      shopify_order_name: body.shopify_order_name || null,
      shopify_order_number: body.shopify_order_number || null,
      inventory_item_id: body.inventory_item_id || null,
      serial_number: serialNumber,
      customer_name: body.customer_name || null,
      customer_email: body.customer_email || null,
      customer_phone: body.customer_phone || null,
      issue_summary: body.issue_summary,
      issue_details: body.issue_details || null,
      arrival_condition_report: body.arrival_condition_report || null,
      arrival_condition_grade: body.arrival_condition_grade || null,
      arrival_condition_images: body.arrival_condition_images || [],
      status: body.status,
    };

    const { data: createdCase, error: insertError } = await supabase
      .from('rma_cases')
      .insert(insertPayload as unknown as Record<string, unknown>)
      .select('*')
      .single();
    if (insertError || !createdCase) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create RMA case' },
        { status: 500 }
      );
    }

    if (serialNumber) {
      const registry = await upsertSerialRegistry(supabase, {
        serialNumber,
        brand: inventoryMeta.brand,
        model: inventoryMeta.model,
        inventoryItemId: body.inventory_item_id || null,
      });
      await touchRegistryFromRmaStatus(supabase, {
        serialRegistryId: registry.id,
        status: createdCase.status,
      });
      await appendSerialServiceEvent(supabase, {
        serialRegistryId: registry.id,
        rmaCaseId: createdCase.id,
        eventType: mapRmaStatusToEvent(createdCase.status),
        summary: `RMA case created (${createdCase.status})`,
        notes: createdCase.issue_summary,
        metadata: { shopify_order_id: createdCase.shopify_order_id },
      });
    }

    let ticketSync = { attempted: false, success: false, error: null as string | null };
    if (isHubSpotTicketConfigured()) {
      try {
        const ticket = await createHubSpotTicket({
          rmaCaseId: createdCase.id,
          subject: `RMA ${createdCase.shopify_order_name || createdCase.shopify_order_id}`,
          content: createdCase.issue_summary,
          serialNumber: createdCase.serial_number,
          customerEmail: createdCase.customer_email,
          customerPhone: createdCase.customer_phone,
          status: createdCase.status,
        });

        await supabase
          .from('rma_cases')
          .update({ hubspot_ticket_id: ticket.ticketId })
          .eq('id', createdCase.id);

        ticketSync = { attempted: true, success: true, error: null };
      } catch (ticketError) {
        ticketSync = {
          attempted: true,
          success: false,
          error: ticketError instanceof Error ? ticketError.message : 'HubSpot ticket creation failed',
        };
      }
    }

    return NextResponse.json({ success: true, case: createdCase, hubspotTicketSync: ticketSync });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create RMA case' },
      { status: 500 }
    );
  }
}

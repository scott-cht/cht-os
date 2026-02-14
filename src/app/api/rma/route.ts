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
  createRmaCase,
} from '@/lib/rma/service';

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
    if (filters.source) {
      query = query.eq('source', filters.source);
    }
    if (filters.warranty_status) {
      query = query.eq('warranty_status', filters.warranty_status);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.technician_email) {
      query = query.eq('assigned_technician_email', filters.technician_email);
    }
    if (filters.my_queue_email) {
      query = query.eq('assigned_technician_email', filters.my_queue_email);
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
    const result = await createRmaCase(supabase, {
      ...body,
      createHubSpotTicketOnCreate: true,
    });

    return NextResponse.json({
      success: true,
      deduped: result.deduped,
      case: result.caseRow,
      hubspotTicketSync: result.hubspotTicketSync,
    });
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

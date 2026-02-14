import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import { rmaListFiltersSchema, validateParams, ValidationError } from '@/lib/validation/schemas';

type LogisticsExceptionType =
  | 'needs_inbound_tracking'
  | 'needs_outbound_tracking'
  | 'outbound_in_transit'
  | 'sla_overdue';

interface ExceptionRow {
  id: string;
  status: string;
  issue_summary: string;
  shopify_order_name: string | null;
  serial_number: string | null;
  assigned_technician_email: string | null;
  inbound_tracking_number: string | null;
  outbound_tracking_number: string | null;
  delivered_back_at: string | null;
  sla_due_at: string | null;
  created_at: string;
}

function classifyExceptions(row: ExceptionRow): LogisticsExceptionType[] {
  const now = Date.now();
  const exceptions: LogisticsExceptionType[] = [];
  if (row.status === 'received' && !row.inbound_tracking_number) {
    exceptions.push('needs_inbound_tracking');
  }
  if (row.status === 'repaired_replaced' && !row.outbound_tracking_number) {
    exceptions.push('needs_outbound_tracking');
  }
  if (row.status === 'back_to_customer' && !!row.outbound_tracking_number && !row.delivered_back_at) {
    exceptions.push('outbound_in_transit');
  }
  if (row.status !== 'back_to_customer' && row.sla_due_at && new Date(row.sla_due_at).getTime() < now) {
    exceptions.push('sla_overdue');
  }
  return exceptions;
}

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
      .select(
        'id,status,issue_summary,shopify_order_name,serial_number,assigned_technician_email,inbound_tracking_number,outbound_tracking_number,delivered_back_at,sla_due_at,created_at'
      )
      .order('created_at', { ascending: false })
      .range(0, 99);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.source) query = query.eq('source', filters.source);
    if (filters.warranty_status) query = query.eq('warranty_status', filters.warranty_status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.technician_email) query = query.eq('assigned_technician_email', filters.technician_email);
    if (filters.my_queue_email) query = query.eq('assigned_technician_email', filters.my_queue_email);
    if (filters.customer_email) query = query.eq('customer_email', filters.customer_email);
    if (filters.serial_number) query = query.eq('serial_number', filters.serial_number.trim().toUpperCase());
    if (filters.search) {
      const term = filters.search.trim();
      query = query.or(
        `shopify_order_id.ilike.%${term}%,shopify_order_name.ilike.%${term}%,serial_number.ilike.%${term}%,issue_summary.ilike.%${term}%,customer_name.ilike.%${term}%,customer_email.ilike.%${term}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as ExceptionRow[];
    const exceptions = rows
      .map((row) => {
        const types = classifyExceptions(row);
        return {
          ...row,
          exception_types: types,
        };
      })
      .filter((row) => row.exception_types.length > 0);

    const summary = exceptions.reduce<Record<LogisticsExceptionType, number>>(
      (acc, row) => {
        row.exception_types.forEach((type) => {
          acc[type] = (acc[type] || 0) + 1;
        });
        return acc;
      },
      {
        needs_inbound_tracking: 0,
        needs_outbound_tracking: 0,
        outbound_in_transit: 0,
        sla_overdue: 0,
      }
    );

    return NextResponse.json({
      exceptions,
      summary,
      total_exceptions: exceptions.length,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA logistics exceptions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch logistics exceptions' },
      { status: 500 }
    );
  }
}

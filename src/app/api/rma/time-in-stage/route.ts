import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import { rmaListFiltersSchema, validateParams, ValidationError } from '@/lib/validation/schemas';
import type { RmaStatus, ServiceEventType } from '@/types';

const STATUS_TO_EVENT_TYPE: Record<RmaStatus, ServiceEventType> = {
  received: 'rma_received',
  testing: 'rma_testing',
  sent_to_manufacturer: 'rma_sent_to_manufacturer',
  repaired_replaced: 'rma_repaired_replaced',
  back_to_customer: 'rma_back_to_customer',
};

function toHours(fromIso: string, toMs: number): number {
  const fromMs = new Date(fromIso).getTime();
  if (Number.isNaN(fromMs) || fromMs > toMs) return 0;
  return (toMs - fromMs) / (1000 * 60 * 60);
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
      .select('id,status,created_at,sla_due_at,assigned_technician_email');

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

    const { data: cases, error: casesError } = await query;
    if (casesError) {
      return NextResponse.json({ error: casesError.message }, { status: 500 });
    }
    const caseRows = cases || [];
    const caseIds = caseRows.map((row) => row.id);
    if (caseIds.length === 0) {
      return NextResponse.json({
        entries: [],
        summary_by_status: {},
      });
    }

    const { data: events, error: eventsError } = await supabase
      .from('serial_service_events')
      .select('rma_case_id,event_type,created_at')
      .in('rma_case_id', caseIds)
      .in('event_type', Object.values(STATUS_TO_EVENT_TYPE));

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    const latestByCaseAndEvent = new Map<string, string>();
    (events || []).forEach((event) => {
      const caseId = event.rma_case_id as string | null;
      const eventType = event.event_type as string | null;
      const createdAt = event.created_at as string | null;
      if (!caseId || !eventType || !createdAt) return;
      const key = `${caseId}::${eventType}`;
      const current = latestByCaseAndEvent.get(key);
      if (!current || new Date(createdAt).getTime() > new Date(current).getTime()) {
        latestByCaseAndEvent.set(key, createdAt);
      }
    });

    const nowMs = Date.now();
    const entries = caseRows.map((row) => {
      const expectedEventType = STATUS_TO_EVENT_TYPE[row.status as RmaStatus];
      const eventKey = `${row.id}::${expectedEventType}`;
      const enteredAt = latestByCaseAndEvent.get(eventKey) || row.created_at;
      const hoursInStage = toHours(enteredAt, nowMs);
      const isSlaOverdue = row.status !== 'back_to_customer' &&
        !!row.sla_due_at &&
        new Date(row.sla_due_at).getTime() < nowMs;
      return {
        case_id: row.id,
        status: row.status,
        entered_at: enteredAt,
        hours_in_stage: hoursInStage,
        is_sla_overdue: isSlaOverdue,
      };
    });

    const summaryByStatus = entries.reduce<Record<string, { count: number; avg_hours_in_stage: number }>>((acc, entry) => {
      const key = entry.status;
      if (!acc[key]) {
        acc[key] = { count: 0, avg_hours_in_stage: 0 };
      }
      const current = acc[key];
      const nextCount = current.count + 1;
      current.avg_hours_in_stage =
        (current.avg_hours_in_stage * current.count + entry.hours_in_stage) / nextCount;
      current.count = nextCount;
      return acc;
    }, {});

    return NextResponse.json({
      entries,
      summary_by_status: summaryByStatus,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA time-in-stage error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate time-in-stage metrics' },
      { status: 500 }
    );
  }
}

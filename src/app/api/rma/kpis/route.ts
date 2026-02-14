import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import { rmaListFiltersSchema, validateParams, ValidationError } from '@/lib/validation/schemas';

function toDays(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / (1000 * 60 * 60 * 24);
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
        'status,priority,warranty_status,sla_due_at,created_at,closed_at,assigned_technician_email,inbound_tracking_number,outbound_tracking_number,delivered_back_at,serial_number'
      );

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

    const rows = data || [];
    const now = Date.now();
    const openCases = rows.filter((row) => row.status !== 'back_to_customer');
    const overdue = openCases.filter((row) => row.sla_due_at && new Date(row.sla_due_at).getTime() < now).length;
    const inWarranty = rows.filter((row) => row.warranty_status === 'in_warranty').length;
    const urgentOrHigh = rows.filter((row) => row.priority === 'urgent' || row.priority === 'high').length;
    const knownWarrantyCases = rows.filter((row) => row.warranty_status && row.warranty_status !== 'unknown').length;
    const warrantyHitRatePct = knownWarrantyCases > 0 ? (inWarranty / knownWarrantyCases) * 100 : null;

    const logisticsExceptionCases = rows.filter((row) => {
      const needsInbound = row.status === 'received' && !row.inbound_tracking_number;
      const needsOutbound = row.status === 'repaired_replaced' && !row.outbound_tracking_number;
      const outboundInTransit =
        row.status === 'back_to_customer' &&
        !!row.outbound_tracking_number &&
        !row.delivered_back_at;
      return needsInbound || needsOutbound || outboundInTransit;
    }).length;
    const logisticsExceptionRatePct = openCases.length > 0 ? (logisticsExceptionCases / openCases.length) * 100 : null;

    const closedDurations = rows
      .map((row) => toDays(row.created_at, row.closed_at))
      .filter((days): days is number => typeof days === 'number');
    const avgTurnaroundDays = closedDurations.length
      ? closedDurations.reduce((sum, days) => sum + days, 0) / closedDurations.length
      : null;

    const queueByTechnician = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.assigned_technician_email || 'unassigned';
      if (row.status !== 'back_to_customer') {
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});

    const serialCounts = rows.reduce<Record<string, number>>((acc, row) => {
      const serial = typeof row.serial_number === 'string' ? row.serial_number.trim().toUpperCase() : '';
      if (!serial) return acc;
      acc[serial] = (acc[serial] || 0) + 1;
      return acc;
    }, {});
    const repeatIssueSerials = Object.entries(serialCounts)
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([serial_number, case_count]) => ({ serial_number, case_count }));

    return NextResponse.json({
      kpis: {
        total_cases: rows.length,
        open_cases: openCases.length,
        overdue_cases: overdue,
        in_warranty_cases: inWarranty,
        warranty_hit_rate_pct: warrantyHitRatePct,
        high_priority_cases: urgentOrHigh,
        logistics_exception_cases: logisticsExceptionCases,
        logistics_exception_rate_pct: logisticsExceptionRatePct,
        avg_turnaround_days: avgTurnaroundDays,
        queue_by_technician: queueByTechnician,
        repeat_issue_serials: repeatIssueSerials,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA KPI error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate RMA KPIs' },
      { status: 500 }
    );
  }
}

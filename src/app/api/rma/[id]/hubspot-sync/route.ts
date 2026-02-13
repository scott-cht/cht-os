import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import { syncRmaStatusToHubSpotTicket } from '@/lib/hubspot/tickets';

/**
 * POST /api/rma/[id]/hubspot-sync
 * Manually sync current RMA status to HubSpot ticket.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.hubspot, clientIp);
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
      .select('id, hubspot_ticket_id, status, issue_summary')
      .eq('id', id)
      .single();
    if (error || !rmaCase) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }

    const syncResult = await syncRmaStatusToHubSpotTicket({
      rmaCaseId: rmaCase.id,
      hubspotTicketId: rmaCase.hubspot_ticket_id,
      status: rmaCase.status,
      summary: rmaCase.issue_summary,
    });

    return NextResponse.json({
      success: syncResult.success,
      hubspotTicketSync: syncResult,
    });
  } catch (error) {
    console.error('RMA HubSpot sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync HubSpot ticket' },
      { status: 500 }
    );
  }
}

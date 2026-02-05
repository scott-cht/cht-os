import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Audit Log API
 * 
 * GET /api/audit - List audit log entries
 * 
 * Query params:
 * - entity_type: Filter by entity type
 * - entity_id: Filter by specific entity
 * - action: Filter by action type
 * - from: Start date (ISO string)
 * - to: End date (ISO string)
 * - limit: Number of entries (default 50)
 * - offset: Pagination offset
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const action = searchParams.get('action');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createServerClient();

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    if (action) {
      query = query.eq('action', action);
    }

    if (from) {
      query = query.gte('created_at', from);
    }

    if (to) {
      query = query.lte('created_at', to);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: entries, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch audit log: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      entries,
      total: count || 0,
      pagination: {
        offset,
        limit,
        hasMore: (count || 0) > offset + limit,
      },
    });

  } catch (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit log' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/inventory/stats
 * Returns aggregated stats for the inventory dashboard
 */
export async function GET() {
  try {
    const supabase = createServerClient();
    
    // Get all counts in parallel for efficiency
    const [
      totalResult,
      newRetailResult,
      tradeInResult,
      exDemoResult,
      pendingSyncResult,
      syncedTodayResult,
      onDemoResult,
    ] = await Promise.all([
      // Total non-archived items
      supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false),
      
      // New retail items
      supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('listing_type', 'new')
        .eq('is_archived', false),
      
      // Trade-in items
      supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('listing_type', 'trade_in')
        .eq('is_archived', false),
      
      // Ex-demo items
      supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('listing_type', 'ex_demo')
        .eq('is_archived', false),
      
      // Pending sync
      supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('sync_status', 'pending')
        .eq('is_archived', false),
      
      // Synced today
      supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .gte('last_synced_at', new Date().toISOString().split('T')[0])
        .eq('is_archived', false),
      
      // Currently on demo
      supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('listing_status', 'on_demo')
        .eq('is_archived', false),
    ]);

    return NextResponse.json({
      totalItems: totalResult.count ?? 0,
      newRetail: newRetailResult.count ?? 0,
      tradeIn: tradeInResult.count ?? 0,
      exDemo: exDemoResult.count ?? 0,
      preOwned: (tradeInResult.count ?? 0) + (exDemoResult.count ?? 0),
      pendingSync: pendingSyncResult.count ?? 0,
      syncedToday: syncedTodayResult.count ?? 0,
      onDemo: onDemoResult.count ?? 0,
    });
  } catch (error) {
    console.error('Failed to fetch inventory stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

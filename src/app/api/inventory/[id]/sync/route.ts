import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { publishProduct } from '@/lib/sync/publish';
import type { InventoryItem } from '@/types';

/**
 * Sync Inventory Item API
 * 
 * POST /api/inventory/[id]/sync
 * 
 * Publishes the inventory item to:
 * - Shopify (as DRAFT)
 * - HubSpot (Deal for trade-ins)
 * - Notion (Global Inventory)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = createServerClient();

    // Fetch the inventory item
    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Update status to syncing
    await supabase
      .from('inventory_items')
      .update({ sync_status: 'syncing' })
      .eq('id', id);

    // Perform the sync
    const result = await publishProduct(item as InventoryItem);

    // Update the item with sync results
    const updateData: Record<string, unknown> = {
      sync_status: result.success ? 'synced' : 'error',
      last_synced_at: new Date().toISOString(),
    };

    if (result.shopify) {
      updateData.shopify_product_id = result.shopify.product_id;
      updateData.shopify_variant_id = result.shopify.variant_id;
    }

    if (result.hubspot) {
      updateData.hubspot_deal_id = result.hubspot.deal_id;
    }

    if (result.notion) {
      updateData.notion_page_id = result.notion.page_id;
    }

    if (result.errors && result.errors.length > 0) {
      updateData.sync_error = result.errors.join('; ');
    }

    await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', id);

    return NextResponse.json({
      success: result.success,
      result,
    });

  } catch (error) {
    console.error('Sync error:', error);
    
    // Try to update status to error
    try {
      const { id } = await params;
      const supabase = createServerClient();
      await supabase
        .from('inventory_items')
        .update({ 
          sync_status: 'error',
          sync_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', id);
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Sync failed',
        success: false,
      },
      { status: 500 }
    );
  }
}

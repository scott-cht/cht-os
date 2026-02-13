import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { publishProduct } from '@/lib/sync/publish';
import { createSyncChannel, SyncBroadcaster } from '@/lib/realtime/sync-channel';
import { logSync } from '@/lib/audit/logger';
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
 * 
 * Broadcasts real-time progress via Supabase Realtime
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Create realtime channel for progress updates
  const channel = createSyncChannel(id);
  await channel.subscribe();

  try {
    const supabase = createServerClient();

    // Broadcast: sync started
    await SyncBroadcaster.started(channel, id);

    // Fetch the inventory item
    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !item) {
      await SyncBroadcaster.error(channel, id, 'Inventory item not found');
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

    // Perform the sync with progress callbacks
    const result = await publishProduct(item as InventoryItem, {
      onPlatformStart: async (platform) => {
        await SyncBroadcaster.platformStarted(channel, id, platform);
      },
      onPlatformComplete: async (platform, platformResult) => {
        await SyncBroadcaster.platformComplete(channel, id, platform, platformResult);
      },
    });

    // Update the item with sync results
    const updateData: Record<string, unknown> = {
      sync_status: result.success ? 'synced' : 'error',
      last_synced_at: new Date().toISOString(),
    };

    if (result.shopify) {
      if (result.shopify.product_id) {
        updateData.shopify_product_id = result.shopify.product_id;
      }
      if (result.shopify.variant_id) {
        updateData.shopify_variant_id = result.shopify.variant_id;
      }
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

    // Log sync result
    await logSync(
      id,
      result.success,
      {
        shopify: result.shopify ? { success: true, productId: result.shopify.product_id } : undefined,
        hubspot: result.hubspot ? { success: true, dealId: result.hubspot.deal_id } : undefined,
        notion: result.notion ? { success: true, pageId: result.notion.page_id } : undefined,
      },
      { errors: result.errors }
    );

    // Broadcast: sync complete
    await SyncBroadcaster.complete(channel, id, result.success);
    await channel.unsubscribe();

    return NextResponse.json({
      success: result.success,
      result,
    });

  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    
    // Log failed sync
    await logSync(
      id,
      false,
      {},
      { errors: [errorMessage] }
    );
    
    // Broadcast error
    await SyncBroadcaster.error(channel, id, errorMessage);
    await channel.unsubscribe();
    
    // Try to update status to error
    try {
      const supabase = createServerClient();
      await supabase
        .from('inventory_items')
        .update({ 
          sync_status: 'error',
          sync_error: errorMessage,
        })
        .eq('id', id);
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}

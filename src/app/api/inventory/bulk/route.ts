import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { publishProduct } from '@/lib/sync/publish';
import { createSyncChannel, SyncBroadcaster } from '@/lib/realtime/sync-channel';
import { logBulkOperation, logSync } from '@/lib/audit/logger';
import { bulkOperationSchema, ValidationError, validateBody } from '@/lib/validation/schemas';
import type { InventoryItem } from '@/types';

/**
 * Bulk Operations API
 * 
 * POST /api/inventory/bulk
 * 
 * Supports:
 * - Bulk sync to platforms
 * - Bulk price updates
 * - Bulk archive
 * - Bulk status changes
 */

interface BulkSyncRequest {
  action: 'sync';
  itemIds: string[];
}

interface BulkPriceUpdateRequest {
  action: 'update_prices';
  itemIds: string[];
  /** Discount percentage to apply (e.g., 20 for 20% off RRP) */
  discountPercent?: number;
  /** Fixed price to set (overrides discount) */
  fixedPrice?: number;
}

interface BulkArchiveRequest {
  action: 'archive' | 'unarchive';
  itemIds: string[];
}

interface BulkStatusRequest {
  action: 'update_status';
  itemIds: string[];
  listingStatus: 'on_demo' | 'ready_to_sell' | 'sold';
}

type BulkRequest = BulkSyncRequest | BulkPriceUpdateRequest | BulkArchiveRequest | BulkStatusRequest;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();

    // Validate with Zod schema
    let body: BulkRequest;
    try {
      body = validateBody(bulkOperationSchema, rawBody) as BulkRequest;
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { error: error.message, validationErrors: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    const { action, itemIds } = body;

    const supabase = createServerClient();

    switch (action) {
      case 'sync':
        return await handleBulkSync(supabase, itemIds);

      case 'update_prices':
        return await handleBulkPriceUpdate(supabase, body as BulkPriceUpdateRequest);

      case 'archive':
      case 'unarchive':
        return await handleBulkArchive(supabase, itemIds, action === 'archive');

      case 'update_status':
        return await handleBulkStatusUpdate(supabase, body as BulkStatusRequest);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk operation failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle bulk sync to platforms
 */
async function handleBulkSync(
  supabase: ReturnType<typeof createServerClient>,
  itemIds: string[]
) {
  // Fetch all items
  const { data: items, error: fetchError } = await supabase
    .from('inventory_items')
    .select('*')
    .in('id', itemIds);

  if (fetchError || !items) {
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }

  // Update all to syncing status
  await supabase
    .from('inventory_items')
    .update({ sync_status: 'syncing' })
    .in('id', itemIds);

  // Process each item (in sequence to avoid rate limits)
  const results: Record<string, { success: boolean; error?: string }> = {};

  for (const item of items) {
    const channel = createSyncChannel(item.id);
    await channel.subscribe();

    try {
      await SyncBroadcaster.started(channel, item.id);
      
      const result = await publishProduct(item as InventoryItem, {
        onPlatformStart: async (platform) => {
          await SyncBroadcaster.platformStarted(channel, item.id, platform);
        },
        onPlatformComplete: async (platform, platformResult) => {
          await SyncBroadcaster.platformComplete(channel, item.id, platform, platformResult);
        },
      });

      // Update item with results
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
      if (result.errors?.length) {
        updateData.sync_error = result.errors.join('; ');
      }

      await supabase
        .from('inventory_items')
        .update(updateData)
        .eq('id', item.id);

      await SyncBroadcaster.complete(channel, item.id, result.success);
      results[item.id] = { success: result.success };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Sync failed';
      await SyncBroadcaster.error(channel, item.id, errorMsg);
      
      await supabase
        .from('inventory_items')
        .update({ sync_status: 'error', sync_error: errorMsg })
        .eq('id', item.id);

      results[item.id] = { success: false, error: errorMsg };
    }

    await channel.unsubscribe();
  }

  const successCount = Object.values(results).filter(r => r.success).length;
  const errorCount = Object.values(results).filter(r => !r.success).length;

  // Log bulk sync operation
  await logBulkOperation({
    action: 'sync',
    itemIds,
    successCount,
    errorCount,
    metadata: { results },
  });

  return NextResponse.json({
    success: errorCount === 0,
    total: itemIds.length,
    successCount,
    errorCount,
    results,
  });
}

/**
 * Handle bulk price updates
 */
async function handleBulkPriceUpdate(
  supabase: ReturnType<typeof createServerClient>,
  request: BulkPriceUpdateRequest
) {
  const { itemIds, discountPercent, fixedPrice } = request;

  if (!discountPercent && !fixedPrice) {
    return NextResponse.json(
      { error: 'Either discountPercent or fixedPrice is required' },
      { status: 400 }
    );
  }

  // If using discount, fetch items to calculate new prices
  if (discountPercent !== undefined) {
    const { data: items, error: fetchError } = await supabase
      .from('inventory_items')
      .select('id, rrp_aud')
      .in('id', itemIds);

    if (fetchError || !items) {
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: 500 }
      );
    }

    // Update each item's price based on RRP
    const updates = items.map(item => ({
      id: item.id,
      sale_price: item.rrp_aud 
        ? Math.round(item.rrp_aud * (1 - discountPercent / 100))
        : null,
    }));

    // Batch update
    for (const update of updates) {
      if (update.sale_price !== null) {
        await supabase
          .from('inventory_items')
          .update({ sale_price: update.sale_price })
          .eq('id', update.id);
      }
    }

    const updatedCount = updates.filter(u => u.sale_price !== null).length;
    
    // Log bulk price update
    await logBulkOperation({
      action: 'price_update',
      itemIds: updates.filter(u => u.sale_price !== null).map(u => u.id),
      successCount: updatedCount,
      errorCount: 0,
      metadata: { discountPercent },
    });

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      skipped: updates.filter(u => u.sale_price === null).length,
    });
  }

  // Fixed price update
  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ sale_price: fixedPrice })
    .in('id', itemIds);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update prices' },
      { status: 500 }
    );
  }

  // Log bulk price update
  await logBulkOperation({
    action: 'price_update',
    itemIds,
    successCount: itemIds.length,
    errorCount: 0,
    metadata: { fixedPrice },
  });

  return NextResponse.json({
    success: true,
    updated: itemIds.length,
  });
}

/**
 * Handle bulk archive/unarchive
 */
async function handleBulkArchive(
  supabase: ReturnType<typeof createServerClient>,
  itemIds: string[],
  archive: boolean
) {
  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ archived: archive })
    .in('id', itemIds);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to ${archive ? 'archive' : 'unarchive'} items` },
      { status: 500 }
    );
  }

  // Log bulk archive operation
  await logBulkOperation({
    action: archive ? 'archive' : 'unarchive',
    itemIds,
    successCount: itemIds.length,
    errorCount: 0,
  });

  return NextResponse.json({
    success: true,
    action: archive ? 'archived' : 'unarchived',
    count: itemIds.length,
  });
}

/**
 * Handle bulk status update
 */
async function handleBulkStatusUpdate(
  supabase: ReturnType<typeof createServerClient>,
  request: BulkStatusRequest
) {
  const { itemIds, listingStatus } = request;

  const updateData: Record<string, unknown> = {
    listing_status: listingStatus,
  };

  // If marking as sold, set the sold timestamp
  if (listingStatus === 'sold') {
    updateData.converted_to_sale_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('inventory_items')
    .update(updateData)
    .in('id', itemIds);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }

  // Log bulk status update
  await logBulkOperation({
    action: 'status_update',
    itemIds,
    successCount: itemIds.length,
    errorCount: 0,
    metadata: { listingStatus },
  });

  return NextResponse.json({
    success: true,
    status: listingStatus,
    count: itemIds.length,
  });
}

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { InventoryItem } from '@/types';

/**
 * POST /api/inventory/[id]/duplicate
 * 
 * Duplicates an inventory item with optional modifications.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    
    // Get overrides from request body
    const overrides = body.overrides || {};
    
    // Fetch the original item
    const supabase = createServerClient();
    const { data: originalItem, error: fetchError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !originalItem) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }
    
    // Prepare duplicated item data
    // Remove fields that shouldn't be duplicated
    const {
      id: _id,
      created_at: _created_at,
      updated_at: _updated_at,
      shopify_product_id: _shopify_id,
      shopify_variant_id: _shopify_variant_id,
      sync_status: _sync_status,
      sync_error: _sync_error,
      last_synced_at: _last_synced_at,
      serial_number: _serial_number,
      ...itemData
    } = originalItem as InventoryItem & { 
      shopify_variant_id?: string;
      sync_error?: string;
      last_synced_at?: string;
    };
    
    // Create the duplicate with modified title
    const duplicateData = {
      ...itemData,
      // Reset sync-related fields
      sync_status: 'pending',
      // Clear Shopify-specific data
      shopify_product_id: null,
      // Add "(Copy)" to model name
      model: `${itemData.model || ''} (Copy)`.trim(),
      // Reset serial number (should be unique per item)
      serial_number: null,
      // Apply any overrides from request
      ...overrides,
    };
    
    // Insert the duplicate
    const { data: newItem, error: insertError } = await supabase
      .from('inventory_items')
      .insert(duplicateData)
      .select()
      .single();
    
    if (insertError) {
      console.error('Duplicate insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to duplicate item' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      item: newItem,
      message: 'Item duplicated successfully',
    });
    
  } catch (error) {
    console.error('Duplicate error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

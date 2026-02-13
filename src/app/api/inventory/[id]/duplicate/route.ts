import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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
    
    // Prepare duplicated item data by omitting fields that should not be copied.
    const itemData = { ...(originalItem as Record<string, unknown>) };
    delete itemData.id;
    delete itemData.created_at;
    delete itemData.updated_at;
    delete itemData.shopify_product_id;
    delete itemData.shopify_variant_id;
    delete itemData.sync_status;
    delete itemData.sync_error;
    delete itemData.last_synced_at;
    delete itemData.serial_number;
    
    // Create the duplicate with modified title
    const duplicateData = {
      ...itemData,
      // Reset sync-related fields
      sync_status: 'pending',
      // Clear Shopify-specific data
      shopify_product_id: null,
      // Add "(Copy)" to model name
      model: `${originalItem.model || ''} (Copy)`.trim(),
      // Reset serial number (should be unique per item)
      serial_number: null,
      serial_capture_status: 'skipped',
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

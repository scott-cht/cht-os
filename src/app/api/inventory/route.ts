import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { InventoryItemInsert, InventoryItem } from '@/types';

/**
 * Inventory Items API
 * 
 * POST /api/inventory - Create new inventory item
 * GET /api/inventory - List inventory items
 */

export async function POST(request: NextRequest) {
  try {
    const body: InventoryItemInsert = await request.json();

    // Validate required fields
    if (!body.listing_type || !body.brand || !body.model || body.sale_price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: listing_type, brand, model, sale_price' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Insert the inventory item
    const { data: item, error: insertError } = await supabase
      .from('inventory_items')
      .insert({
        listing_type: body.listing_type,
        listing_status: body.listing_status || 'ready_to_sell', // Default for new/trade-in
        brand: body.brand,
        model: body.model,
        serial_number: body.serial_number || null,
        sku: body.sku || null,
        rrp_aud: body.rrp_aud || null,
        cost_price: body.cost_price || null,
        sale_price: body.sale_price,
        condition_grade: body.condition_grade || null,
        condition_report: body.condition_report || null,
        // Demo-specific fields
        demo_start_date: body.demo_start_date || null,
        demo_location: body.demo_location || null,
        // Media
        image_urls: body.image_urls || [],
        registration_images: body.registration_images || [],
        selling_images: body.selling_images || [],
        vision_ai_response: body.vision_ai_response || null,
        // Content
        title: body.title || `${body.brand} ${body.model}`,
        description_html: body.description_html || null,
        meta_description: body.meta_description || null,
        specifications: body.specifications || {},
        source_url: body.source_url || null,
        rrp_source: body.rrp_source || null,
        sync_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: `Failed to create inventory item: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item,
    });

  } catch (error) {
    console.error('Inventory create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create inventory item' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listing_type = searchParams.get('listing_type');
    const listing_status = searchParams.get('listing_status');
    const sync_status = searchParams.get('sync_status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createServerClient();

    let query = supabase
      .from('inventory_items')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (listing_type) {
      query = query.eq('listing_type', listing_type);
    }

    if (listing_status) {
      query = query.eq('listing_status', listing_status);
    }

    if (sync_status) {
      query = query.eq('sync_status', sync_status);
    }

    const { data: items, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch inventory: ${fetchError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      items,
      count: items?.length || 0,
    });

  } catch (error) {
    console.error('Inventory fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

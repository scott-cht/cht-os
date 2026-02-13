import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createInventoryItemSchema, ValidationError, validateBody } from '@/lib/validation/schemas';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import type { InventoryItemInsert } from '@/types';

/**
 * Inventory Items API
 * 
 * POST /api/inventory - Create new inventory item
 * GET /api/inventory - List inventory items
 */

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = checkRateLimit(rateLimiters.inventory, clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
        { status: 429 }
      );
    }

    const rawBody = await request.json();

    // Validate with Zod schema
    let body: InventoryItemInsert;
    try {
      body = validateBody(createInventoryItemSchema, rawBody) as InventoryItemInsert;
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { error: error.message, validationErrors: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    const supabase = createServerClient();
    const serialCaptureStatus =
      body.serial_capture_status ??
      (body.serial_number && body.serial_number.trim().length > 0 ? 'captured' : 'skipped');

    // Insert the inventory item
    const { data: item, error: insertError } = await supabase
      .from('inventory_items')
      .insert({
        listing_type: body.listing_type,
        listing_status: body.listing_status || 'ready_to_sell', // Default for new/trade-in
        brand: body.brand,
        model: body.model,
        serial_number: body.serial_number || null,
        serial_capture_status: serialCaptureStatus,
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
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = checkRateLimit(rateLimiters.inventory, clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Basic filters (support multiple listing_type for picker quick-fill)
    const listingTypes = searchParams.getAll('listing_type').filter((t) => t && t !== 'all');
    const listing_type = searchParams.get('listing_type'); // single for backward compat
    const listing_status = searchParams.get('listing_status');
    const sync_status = searchParams.get('sync_status');
    const condition_grade = searchParams.get('condition_grade');
    
    // Text search
    const search = searchParams.get('search');
    const brand = searchParams.get('brand');
    
    // Price range
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    
    // Date range
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    
    // Sorting
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrderParam = searchParams.get('sort_order') || 'desc';
    const sortOrder = sortOrderParam === 'asc' ? 'asc' : 'desc';
    
    // Pagination with enforced limits (prevent DoS)
    const requestedLimitRaw = Number.parseInt(searchParams.get('limit') || '50', 10);
    if (Number.isNaN(requestedLimitRaw)) {
      return NextResponse.json(
        { error: 'Invalid limit parameter' },
        { status: 400 }
      );
    }
    const requestedLimit = requestedLimitRaw;
    const limit = Math.min(Math.max(requestedLimit, 1), 100); // Cap between 1-100
    const offsetRaw = Number.parseInt(searchParams.get('offset') || '0', 10);
    if (Number.isNaN(offsetRaw)) {
      return NextResponse.json(
        { error: 'Invalid offset parameter' },
        { status: 400 }
      );
    }
    const offset = Math.max(offsetRaw, 0);
    
    // Include archived
    const includeArchived = searchParams.get('include_archived') === 'true';

    const supabase = createServerClient();

    // Start building query
    let query = supabase
      .from('inventory_items')
      .select('*', { count: 'exact' });

    // Archived filter (default: exclude archived)
    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    // Basic filters
    if (listingTypes.length > 0) {
      query = query.in('listing_type', listingTypes);
    } else if (listing_type && listing_type !== 'all') {
      query = query.eq('listing_type', listing_type);
    }

    if (listing_status && listing_status !== 'all') {
      query = query.eq('listing_status', listing_status);
    }

    if (sync_status && sync_status !== 'all') {
      query = query.eq('sync_status', sync_status);
    }

    if (condition_grade && condition_grade !== 'all') {
      query = query.eq('condition_grade', condition_grade);
    }

    // Brand filter
    if (brand) {
      query = query.ilike('brand', brand);
    }

    // Text search (brand, model, title, serial number)
    if (search) {
      query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%,title.ilike.%${search}%,serial_number.ilike.%${search}%`);
    }

    // Price range filters
    if (minPrice) {
      const parsedMin = Number.parseInt(minPrice, 10);
      if (Number.isNaN(parsedMin)) {
        return NextResponse.json(
          { error: 'Invalid min_price parameter' },
          { status: 400 }
        );
      }
      query = query.gte('sale_price', parsedMin);
    }
    if (maxPrice) {
      const parsedMax = Number.parseInt(maxPrice, 10);
      if (Number.isNaN(parsedMax)) {
        return NextResponse.json(
          { error: 'Invalid max_price parameter' },
          { status: 400 }
        );
      }
      query = query.lte('sale_price', parsedMax);
    }

    // Date range filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      // Add a day to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('created_at', endDate.toISOString());
    }

    // Sorting
    const validSortFields = ['created_at', 'brand', 'model', 'sale_price', 'rrp_aud', 'last_synced_at'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    query = query.order(safeSortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: items, count, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch inventory: ${fetchError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      items,
      count: items?.length || 0,
      total: count || 0,
      pagination: {
        offset,
        limit,
        hasMore: (count || 0) > offset + limit,
      },
    });

  } catch (error) {
    console.error('Inventory fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

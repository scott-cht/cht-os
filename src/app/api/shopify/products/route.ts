import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import type { 
  ShopifyProduct, 
  ShopifyProductFilters,
  ShopifyProductListResponse 
} from '@/types/shopify-products';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/shopify/products
 * List imported Shopify products with filtering and pagination
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.products, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const enrichmentStatus = searchParams.get('enrichmentStatus');
    const linked = searchParams.get('linked');

    const validStatuses = new Set(['active', 'draft', 'archived']);
    const validEnrichmentStatuses = new Set(['pending', 'enriched', 'synced']);
    const validLinked = new Set(['linked', 'unlinked', 'all']);

    if (status && !validStatuses.has(status)) {
      return NextResponse.json(
        { error: 'Invalid status filter' },
        { status: 400 }
      );
    }
    if (enrichmentStatus && !validEnrichmentStatuses.has(enrichmentStatus)) {
      return NextResponse.json(
        { error: 'Invalid enrichmentStatus filter' },
        { status: 400 }
      );
    }
    if (linked && !validLinked.has(linked)) {
      return NextResponse.json(
        { error: 'Invalid linked filter' },
        { status: 400 }
      );
    }

    // Parse filters
    const filters: ShopifyProductFilters = {
      status: status as ShopifyProductFilters['status'] || undefined,
      enrichmentStatus: enrichmentStatus as ShopifyProductFilters['enrichmentStatus'] || undefined,
      linked: linked as ShopifyProductFilters['linked'] || 'all',
      search: searchParams.get('search') || undefined,
      vendor: searchParams.get('vendor') || undefined,
    };

    // Pagination
    const pageParam = Number.parseInt(searchParams.get('page') || '1', 10);
    const limitParam = Number.parseInt(searchParams.get('limit') || '50', 10);
    if (Number.isNaN(pageParam) || Number.isNaN(limitParam)) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }
    const page = Math.max(1, pageParam);
    const limit = Math.min(100, Math.max(1, limitParam));
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('shopify_products')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.enrichmentStatus) {
      query = query.eq('enrichment_status', filters.enrichmentStatus);
    }

    if (filters.linked === 'linked') {
      query = query.not('linked_inventory_id', 'is', null);
    } else if (filters.linked === 'unlinked') {
      query = query.is('linked_inventory_id', null);
    }

    if (filters.vendor) {
      query = query.eq('vendor', filters.vendor);
    }

    if (filters.search) {
      // Full-text search on title and vendor
      query = query.or(`title.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%,handle.ilike.%${filters.search}%`);
    }

    // Apply pagination and ordering
    query = query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    const response: ShopifyProductListResponse = {
      products: products as ShopifyProduct[],
      total: count || 0,
      page,
      limit,
      filters,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in products list:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}


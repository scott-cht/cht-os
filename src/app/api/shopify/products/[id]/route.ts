import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import { uuidSchema } from '@/lib/validation/schemas';
import type { 
  ShopifyProduct, 
  ShopifyProductSnapshot,
  ShopifyProductUpdate,
  ProductDiff,
  ProductDiffSummary 
} from '@/types/shopify-products';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validate UUID parameter
function validateUUID(id: string): boolean {
  const result = uuidSchema.safeParse(id);
  return result.success;
}

// Calculate diffs between original and enriched content
function calculateDiffs(product: ShopifyProduct): ProductDiff[] {
  const diffs: ProductDiff[] = [];

  // Title diff
  diffs.push({
    field: 'title',
    original: product.title,
    enriched: product.enriched_title,
    hasChanges: product.enriched_title !== null && product.enriched_title !== product.title,
  });

  // Description diff
  diffs.push({
    field: 'description_html',
    original: product.description_html,
    enriched: product.enriched_description_html,
    hasChanges: product.enriched_description_html !== null && product.enriched_description_html !== product.description_html,
  });

  // Meta description diff (original doesn't exist in Shopify, so just check if enriched exists)
  diffs.push({
    field: 'meta_description',
    original: null, // Shopify doesn't have meta descriptions at product level
    enriched: product.enriched_meta_description,
    hasChanges: product.enriched_meta_description !== null,
  });

  return diffs;
}

/**
 * GET /api/shopify/products/[id]
 * Get single product with snapshots and diff summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate UUID
  if (!validateUUID(id)) {
    return NextResponse.json(
      { error: 'Invalid product ID format' },
      { status: 400 }
    );
  }

  try {
    // Fetch product
    const { data: product, error: productError } = await supabase
      .from('shopify_products')
      .select('*')
      .eq('id', id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Fetch snapshots
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('shopify_product_snapshots')
      .select('*')
      .eq('shopify_product_id', id)
      .order('created_at', { ascending: false });

    if (snapshotsError) {
      console.error('Error fetching snapshots:', snapshotsError);
    }

    // Fetch linked inventory item if exists
    let linkedItem = null;
    if (product.linked_inventory_id) {
      const { data: item } = await supabase
        .from('inventory_items')
        .select('id, brand, model, sku, rrp_aud, sale_price, cost_price')
        .eq('id', product.linked_inventory_id)
        .single();
      linkedItem = item;
    }

    // Calculate diffs
    const diffs = calculateDiffs(product as ShopifyProduct);
    const hasAnyChanges = diffs.some(d => d.hasChanges);

    const response: ProductDiffSummary & { linkedItem: typeof linkedItem } = {
      product: product as ShopifyProduct,
      diffs,
      hasAnyChanges,
      snapshots: (snapshots || []) as ShopifyProductSnapshot[],
      linkedItem,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/shopify/products/[id]
 * Update product fields (local only, not synced to Shopify)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.products, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  // Validate UUID
  if (!validateUUID(id)) {
    return NextResponse.json(
      { error: 'Invalid product ID format' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json() as ShopifyProductUpdate;

    // Only allow certain fields to be updated
    const updateData: Partial<ShopifyProductUpdate> = {};
    
    if ('enriched_title' in body) {
      updateData.enriched_title = body.enriched_title;
    }
    if ('enriched_description_html' in body) {
      updateData.enriched_description_html = body.enriched_description_html;
    }
    if ('enriched_meta_description' in body) {
      updateData.enriched_meta_description = body.enriched_meta_description;
    }
    if ('linked_inventory_id' in body) {
      updateData.linked_inventory_id = body.linked_inventory_id;
    }
    if ('enrichment_status' in body) {
      updateData.enrichment_status = body.enrichment_status;
    }

    const { data: product, error } = await supabase
      .from('shopify_products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return NextResponse.json(
        { error: 'Failed to update product' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shopify/products/[id]
 * Remove product from local database (does not affect Shopify)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.products, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  // Validate UUID
  if (!validateUUID(id)) {
    return NextResponse.json(
      { error: 'Invalid product ID format' },
      { status: 400 }
    );
  }

  try {
    // Snapshots will be cascade deleted due to foreign key
    const { error } = await supabase
      .from('shopify_products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      return NextResponse.json(
        { error: 'Failed to delete product' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Product removed from local database' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}

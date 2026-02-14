import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findMatches, linkProduct, unlinkProduct } from '@/lib/matching';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import { uuidSchema } from '@/lib/validation/schemas';
import type { 
  ShopifyProduct,
  MatchSuggestionsResponse, 
  LinkRequest 
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

/**
 * GET /api/shopify/products/[id]/match
 * Get match suggestions for a Shopify product
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
    const { data: product, error: fetchError } = await supabase
      .from('shopify_products')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Get current link if exists
    let currentLink = null;
    if (product.linked_inventory_id) {
      const { data: linkedItem } = await supabase
        .from('inventory_items')
        .select('id, brand, model')
        .eq('id', product.linked_inventory_id)
        .single();
      currentLink = linkedItem;
    }

    // Find match suggestions
    const suggestions = await findMatches(product as ShopifyProduct, 10);

    const response: MatchSuggestionsResponse = {
      suggestions,
      currentLink,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error finding matches:', error);
    return NextResponse.json(
      { error: 'Failed to find matches' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shopify/products/[id]/match
 * Link a Shopify product to an inventory item
 */
export async function POST(
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
    const body = await request.json() as LinkRequest;
    
    if (!body.inventoryItemId || !validateUUID(body.inventoryItemId)) {
      return NextResponse.json(
        { error: 'Invalid inventory item ID' },
        { status: 400 }
      );
    }

    // Verify inventory item exists
    const { data: inventoryItem, error: itemError } = await supabase
      .from('inventory_items')
      .select('id, brand, model')
      .eq('id', body.inventoryItemId)
      .single();

    if (itemError || !inventoryItem) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Link the product
    const result = await linkProduct(id, body.inventoryItemId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to link product' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      linkedTo: inventoryItem,
    });
  } catch (error) {
    console.error('Error linking product:', error);
    return NextResponse.json(
      { error: 'Failed to link product' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shopify/products/[id]/match
 * Unlink a Shopify product from its inventory item
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
    const result = await unlinkProduct(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to unlink product' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlinking product:', error);
    return NextResponse.json(
      { error: 'Failed to unlink product' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getGraphQLClient, 
  isShopifyConfigured,
  UPDATE_PRODUCT_MUTATION 
} from '@/lib/shopify/client';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import { uuidSchema } from '@/lib/validation/schemas';
import type { 
  ShopifyProduct, 
  ShopifyProductSnapshot,
  ShopifyProductSnapshotData,
  RollbackRequest, 
  RollbackResponse 
} from '@/types/shopify-products';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GraphQL response type for product update
interface ProductUpdateResponse {
  data: {
    productUpdate: {
      product: { id: string } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  };
}

// Validate UUID parameter
function validateUUID(id: string): boolean {
  const result = uuidSchema.safeParse(id);
  return result.success;
}

/**
 * POST /api/shopify/products/[id]/rollback
 * Restore product to a previous snapshot state
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
    // Parse request body
    const body = await request.json() as RollbackRequest;
    const { snapshotId, syncToShopify = false } = body;

    // Validate snapshot ID
    if (!snapshotId || !validateUUID(snapshotId)) {
      return NextResponse.json(
        { error: 'Invalid snapshot ID' },
        { status: 400 }
      );
    }

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

    // Fetch snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('shopify_product_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .eq('shopify_product_id', id) // Ensure snapshot belongs to this product
      .single();

    if (snapshotError || !snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    const snapshotData = snapshot.data as ShopifyProductSnapshotData;

    // Update product with snapshot data
    const updateData = {
      title: snapshotData.title,
      description_html: snapshotData.description_html,
      vendor: snapshotData.vendor,
      product_type: snapshotData.product_type,
      tags: snapshotData.tags,
      status: snapshotData.status,
      images: snapshotData.images,
      variants: snapshotData.variants,
      metafields: snapshotData.metafields,
      enriched_title: snapshotData.enriched_title,
      enriched_description_html: snapshotData.enriched_description_html,
      enriched_meta_description: snapshotData.enriched_meta_description,
      // Reset enrichment status based on whether there's enriched content
      enrichment_status: snapshotData.enriched_title || snapshotData.enriched_description_html 
        ? 'enriched' 
        : 'pending',
    };

    const { data: updatedProduct, error: updateError } = await supabase
      .from('shopify_products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating product:', updateError);
      return NextResponse.json(
        { error: 'Failed to restore product' },
        { status: 500 }
      );
    }

    // Optionally sync to Shopify
    let shopifySynced = false;
    if (syncToShopify) {
      if (!(await isShopifyConfigured())) {
        console.warn('Shopify not configured, skipping sync');
      } else {
        const graphqlClient = await getGraphQLClient();
        if (graphqlClient) {
          try {
            const shopifyProduct = product as ShopifyProduct;
            const result = await graphqlClient.request(UPDATE_PRODUCT_MUTATION, {
              variables: {
                input: {
                  id: shopifyProduct.shopify_id,
                  title: snapshotData.title,
                  descriptionHtml: snapshotData.description_html,
                },
              },
            });
            const response = result as unknown as ProductUpdateResponse;

            if (response.data.productUpdate.userErrors.length === 0) {
              shopifySynced = true;
              
              // Update last synced timestamp
              await supabase
                .from('shopify_products')
                .update({ 
                  last_synced_at: new Date().toISOString(),
                  enrichment_status: 'synced',
                })
                .eq('id', id);
            } else {
              console.error('Shopify sync errors:', response.data.productUpdate.userErrors);
            }
          } catch (shopifyError) {
            console.error('Error syncing to Shopify:', shopifyError);
          }
        }
      }
    }

    const response: RollbackResponse = {
      success: true,
      product: updatedProduct as ShopifyProduct,
      restoredFrom: snapshot as ShopifyProductSnapshot,
      shopifySynced,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error rolling back product:', error);
    return NextResponse.json(
      { 
        error: 'Failed to rollback product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shopify/products/[id]/rollback
 * List available snapshots for rollback
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
    // Fetch snapshots for this product
    const { data: snapshots, error } = await supabase
      .from('shopify_product_snapshots')
      .select('id, snapshot_type, note, created_at')
      .eq('shopify_product_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching snapshots:', error);
      return NextResponse.json(
        { error: 'Failed to fetch snapshots' },
        { status: 500 }
      );
    }

    return NextResponse.json({ snapshots: snapshots || [] });
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

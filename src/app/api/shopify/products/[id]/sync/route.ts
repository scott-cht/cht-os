import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getGraphQLClient, 
  isShopifyConfigured,
  UPDATE_PRODUCT_MUTATION 
} from '@/lib/shopify/client';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import {
  acquireIdempotency,
  buildRequestHash,
  finalizeIdempotency,
  idempotencyReplayResponse,
} from '@/lib/api/idempotency';
import { uuidSchema } from '@/lib/validation/schemas';
import type { 
  ShopifyProduct, 
  ShopifyProductSnapshotInsert,
  SyncRequest, 
  SyncResponse 
} from '@/types/shopify-products';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GraphQL response type for product update
interface ProductUpdateResponse {
  data: {
    productUpdate: {
      product: { id: string; title: string; updatedAt: string } | null;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  };
}

// Validate UUID parameter
function validateUUID(id: string): boolean {
  const result = uuidSchema.safeParse(id);
  return result.success;
}

// Create snapshot data from current product state
function createSnapshotData(product: ShopifyProduct) {
  return {
    title: product.title,
    description_html: product.description_html,
    vendor: product.vendor,
    product_type: product.product_type,
    tags: product.tags || [],
    status: product.status,
    images: product.images || [],
    variants: product.variants || [],
    metafields: product.metafields || {},
    enriched_title: product.enriched_title,
    enriched_description_html: product.enriched_description_html,
    enriched_meta_description: product.enriched_meta_description,
  };
}

/**
 * POST /api/shopify/products/[id]/sync
 * Push enriched content to Shopify
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let idempotencyRecordId: string | null = null;

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
    // Check Shopify configuration
    if (!(await isShopifyConfigured())) {
      return NextResponse.json(
        { error: 'Shopify is not configured' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json() as SyncRequest;
    const { fields, createSnapshot = true } = body;

    // At least one field must be selected
    if (!fields.title && !fields.description && !fields.metaDescription) {
      return NextResponse.json(
        { error: 'At least one field must be selected to sync' },
        { status: 400 }
      );
    }

    const idempotencyKey =
      request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const idempotencyResult = await acquireIdempotency(supabase, {
        endpoint: `/api/shopify/products/${id}/sync`,
        idempotencyKey,
        requestHash: buildRequestHash(body),
      });

      if (idempotencyResult.type === 'conflict') {
        return NextResponse.json(
          { error: 'Idempotency key reused with different request body' },
          { status: 409 }
        );
      }
      if (idempotencyResult.type === 'in_progress') {
        return NextResponse.json(
          { error: 'A request with this idempotency key is already in progress' },
          { status: 409 }
        );
      }
      if (idempotencyResult.type === 'replay') {
        return idempotencyReplayResponse(
          idempotencyResult.statusCode,
          idempotencyResult.responseBody
        );
      }
      idempotencyRecordId = idempotencyResult.recordId;
    }

    const respond = async (payload: unknown, status: number, failed: boolean = false) => {
      if (idempotencyRecordId) {
        await finalizeIdempotency(supabase, {
          recordId: idempotencyRecordId,
          statusCode: status,
          responseBody: payload,
          failed,
        });
      }
      return NextResponse.json(payload, { status });
    };

    // Fetch product
    const { data: product, error: fetchError } = await supabase
      .from('shopify_products')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !product) {
      return respond(
        { error: 'Product not found' },
        404
      );
    }

    const shopifyProduct = product as ShopifyProduct;

    // Verify product has enriched content
    if (shopifyProduct.enrichment_status !== 'enriched') {
      return respond(
        { error: 'Product has not been enriched yet' },
        400
      );
    }

    // Build Shopify update input
    const shopifyInput: Record<string, unknown> = {
      id: shopifyProduct.shopify_id,
    };
    const pushedFields: string[] = [];

    // Only include fields that were selected for sync
    if (fields.title && shopifyProduct.enriched_title) {
      shopifyInput.title = shopifyProduct.enriched_title;
      pushedFields.push('title');
    }
    if (fields.description && shopifyProduct.enriched_description_html) {
      shopifyInput.descriptionHtml = shopifyProduct.enriched_description_html;
      pushedFields.push('description');
    }
    if (fields.metaDescription) {
      return respond(
        {
          error: 'Meta description sync is not supported by this endpoint yet',
          message: 'Sync title and/or description for now, or extend sync to write Shopify SEO metafields.',
        },
        400
      );
    }
    if (pushedFields.length === 0) {
      return respond(
        {
          error: 'No syncable enriched content found for selected fields',
          message: 'Generate enriched title/description first, then retry sync.',
        },
        400
      );
    }

    // Create snapshot before sync if requested
    let snapshotId: string | undefined;
    if (createSnapshot) {
      const snapshotData: ShopifyProductSnapshotInsert = {
        shopify_product_id: id,
        snapshot_type: 'before_sync',
        note: `Before sync: ${pushedFields.join(', ')}`,
        data: createSnapshotData(shopifyProduct),
      };

      const { data: snapshot, error: snapshotError } = await supabase
        .from('shopify_product_snapshots')
        .insert(snapshotData)
        .select('id')
        .single();

      if (snapshotError) {
        console.error('Error creating snapshot:', snapshotError);
        // Continue anyway - snapshot is optional
      } else if (snapshot) {
        snapshotId = snapshot.id;
      }
    }

    // Get GraphQL client
    const graphqlClient = await getGraphQLClient();
    if (!graphqlClient) {
      return respond(
        { error: 'Failed to create Shopify client' },
        500,
        true
      );
    }

    // Update product in Shopify
    const result = await graphqlClient.request(UPDATE_PRODUCT_MUTATION, {
      variables: {
        input: shopifyInput,
      },
    });
    const response = result as unknown as ProductUpdateResponse;

    const { productUpdate } = response.data;

    if (productUpdate.userErrors.length > 0) {
      const errorMessages = productUpdate.userErrors.map(e => e.message).join(', ');
      return respond(
        { error: `Shopify error: ${errorMessages}` },
        400
      );
    }

    // Update local product to reflect synced state
    const updateData: Record<string, unknown> = {
      enrichment_status: 'synced',
      last_synced_at: new Date().toISOString(),
    };

    // Copy enriched values to original fields (they're now in Shopify)
    if (fields.title && shopifyProduct.enriched_title) {
      updateData.title = shopifyProduct.enriched_title;
    }
    if (fields.description && shopifyProduct.enriched_description_html) {
      updateData.description_html = shopifyProduct.enriched_description_html;
    }

    // Update Shopify's updatedAt if returned
    if (productUpdate.product?.updatedAt) {
      updateData.shopify_updated_at = productUpdate.product.updatedAt;
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from('shopify_products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating local product:', updateError);
      // Don't fail - Shopify was updated successfully
    }

    const syncResponse: SyncResponse = {
      success: true,
      product: (updatedProduct || shopifyProduct) as ShopifyProduct,
      snapshotId,
      shopifyUpdated: true,
    };

    return respond({
      ...syncResponse,
      pushedFields,
    }, 200);
  } catch (error) {
    console.error('Error syncing product:', error);
    const errorPayload = {
      error: 'Failed to sync product',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    if (idempotencyRecordId) {
      await finalizeIdempotency(supabase, {
        recordId: idempotencyRecordId,
        statusCode: 500,
        responseBody: errorPayload,
        failed: true,
      });
    }
    return NextResponse.json(errorPayload, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getGraphQLClient, 
  isShopifyConfigured,
  FETCH_PRODUCTS_QUERY 
} from '@/lib/shopify/client';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import {
  acquireIdempotency,
  buildRequestHash,
  finalizeIdempotency,
  idempotencyReplayResponse,
} from '@/lib/api/idempotency';
import type { 
  ShopifyProductFromAPI, 
  ShopifyProductInsert,
  ShopifyProductSnapshotInsert,
  ShopifyProductSnapshotData,
  ShopifyImage,
  ShopifyVariant,
  ShopifyMetafield,
  ImportResponse 
} from '@/types/shopify-products';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GraphQL response type for product fetch
interface ProductsQueryResponse {
  data: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string };
      edges: Array<{ node: ShopifyProductFromAPI }>;
    };
  };
}

// Transform Shopify API response to our database format
function transformShopifyProduct(product: ShopifyProductFromAPI): ShopifyProductInsert {
  const images: ShopifyImage[] = product.images.edges.map(edge => edge.node);
  const variants: ShopifyVariant[] = product.variants.edges.map(edge => edge.node);
  const metafields: Record<string, ShopifyMetafield> = {};
  
  product.metafields.edges.forEach(edge => {
    const mf = edge.node;
    metafields[`${mf.namespace}.${mf.key}`] = mf;
  });

  return {
    shopify_id: product.id,
    shopify_variant_id: variants[0]?.id || null,
    handle: product.handle,
    title: product.title,
    description_html: product.descriptionHtml || null,
    vendor: product.vendor || null,
    product_type: product.productType || null,
    tags: product.tags || [],
    status: product.status.toLowerCase() as 'active' | 'draft' | 'archived',
    images,
    variants,
    metafields,
    shopify_created_at: product.createdAt,
    shopify_updated_at: product.updatedAt,
  };
}

// Create snapshot data from product
function createSnapshotData(product: ShopifyProductInsert): ShopifyProductSnapshotData {
  return {
    title: product.title,
    description_html: product.description_html ?? null,
    vendor: product.vendor ?? null,
    product_type: product.product_type ?? null,
    tags: product.tags || [],
    status: product.status || 'active',
    images: product.images || [],
    variants: product.variants || [],
    metafields: product.metafields || {},
    enriched_title: null,
    enriched_description_html: null,
    enriched_meta_description: null,
  };
}

/**
 * POST /api/shopify/import
 * Import all active products from Shopify
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.products, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  let idempotencyRecordId: string | null = null;

  try {
    const idempotencyKey =
      request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');

    let rawBody: unknown = {};
    try {
      rawBody = await request.json();
    } catch {
      rawBody = {};
    }

    // Check Shopify configuration
    if (!(await isShopifyConfigured())) {
      return NextResponse.json(
        { error: 'Shopify is not configured' },
        { status: 400 }
      );
    }

    const graphqlClient = await getGraphQLClient();
    if (!graphqlClient) {
      return NextResponse.json(
        { error: 'Failed to create Shopify client' },
        { status: 500 }
      );
    }

    const options: { status: string; limit?: number } = { status: 'active' };
    if (rawBody && typeof rawBody === 'object') {
      const body = rawBody as { status?: unknown; limit?: unknown };
      if (typeof body.status === 'string' && body.status.trim().length > 0) {
        options.status = body.status;
      }
      if (typeof body.limit === 'number' && body.limit > 0) {
        options.limit = body.limit;
      }
    }

    if (idempotencyKey) {
      const idempotencyResult = await acquireIdempotency(supabase, {
        endpoint: '/api/shopify/import',
        idempotencyKey,
        requestHash: buildRequestHash(options),
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

    // Build query filter for active products only (by default)
    const query = options.status === 'all' ? null : `status:${options.status}`;
    
    // Determine batch size (smaller if we have a limit)
    const batchSize = options.limit ? Math.min(options.limit, 50) : 50;

    const stats = {
      total: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    let hasNextPage = true;
    let cursor: string | null = null;
    let totalProcessed = 0;

    // Paginate through products (respecting limit if set)
    while (hasNextPage && (!options.limit || totalProcessed < options.limit)) {
      // Calculate how many more we need if there's a limit
      const remaining = options.limit ? options.limit - totalProcessed : batchSize;
      const fetchCount = Math.min(batchSize, remaining);
      
      const result = await graphqlClient.request(FETCH_PRODUCTS_QUERY, {
        variables: {
          first: fetchCount,
          after: cursor,
          query,
        },
      });
      const response = result as unknown as ProductsQueryResponse;

      const productsData = response.data.products;
      hasNextPage = productsData.pageInfo.hasNextPage;
      cursor = productsData.pageInfo.endCursor;

      // Process each product
      for (const edge of productsData.edges) {
        // Check limit before processing
        if (options.limit && totalProcessed >= options.limit) {
          break;
        }
        
        totalProcessed++;
        stats.total++;
        const shopifyProduct = edge.node;
        
        try {
          const productData = transformShopifyProduct(shopifyProduct);
          
          // Check if product already exists
          const { data: existing } = await supabase
            .from('shopify_products')
            .select('id, shopify_updated_at')
            .eq('shopify_id', productData.shopify_id)
            .single();

          if (existing) {
            // Check if Shopify product was updated since last import
            const existingUpdated = existing.shopify_updated_at ? new Date(existing.shopify_updated_at) : null;
            const newUpdated = productData.shopify_updated_at ? new Date(productData.shopify_updated_at) : null;
            
            if (existingUpdated && newUpdated && newUpdated <= existingUpdated) {
              // Product hasn't changed, skip
              stats.skipped++;
              continue;
            }

            // Update existing product
            const { error: updateError } = await supabase
              .from('shopify_products')
              .update({
                ...productData,
                last_imported_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            if (updateError) {
              console.error('Error updating product:', updateError);
              stats.errors++;
            } else {
              stats.updated++;
            }
          } else {
            // Insert new product
            const { data: inserted, error: insertError } = await supabase
              .from('shopify_products')
              .insert(productData)
              .select('id')
              .single();

            if (insertError) {
              console.error('Error inserting product:', insertError);
              stats.errors++;
            } else if (inserted) {
              stats.imported++;

              // Create original snapshot
              const snapshotData: ShopifyProductSnapshotInsert = {
                shopify_product_id: inserted.id,
                snapshot_type: 'original',
                note: 'Initial import from Shopify',
                data: createSnapshotData(productData),
              };

              const { error: snapshotError } = await supabase
                .from('shopify_product_snapshots')
                .insert(snapshotData);

              if (snapshotError) {
                console.error('Error creating snapshot:', snapshotError);
              }
            }
          }
        } catch (productError) {
          console.error('Error processing product:', productError);
          stats.errors++;
        }
      }
    }

    const response: ImportResponse = {
      success: true,
      message: `Import complete. ${stats.imported} new, ${stats.updated} updated, ${stats.skipped} unchanged.`,
      stats,
    };

    if (idempotencyRecordId) {
      await finalizeIdempotency(supabase, {
        recordId: idempotencyRecordId,
        statusCode: 200,
        responseBody: response,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Import error:', error);
    const errorResponse = {
      error: 'Failed to import products',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
    if (idempotencyRecordId) {
      await finalizeIdempotency(supabase, {
        recordId: idempotencyRecordId,
        statusCode: 500,
        responseBody: errorResponse,
        failed: true,
      });
    }
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * GET /api/shopify/import
 * Get import status/stats
 */
export async function GET() {
  try {
    // Check Shopify configuration
    const isConfigured = await isShopifyConfigured();
    
    // Get local product counts
    const { count: totalLocal } = await supabase
      .from('shopify_products')
      .select('*', { count: 'exact', head: true });

    const { count: pendingEnrichment } = await supabase
      .from('shopify_products')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'pending');

    const { count: enriched } = await supabase
      .from('shopify_products')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'enriched');

    const { count: synced } = await supabase
      .from('shopify_products')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'synced');

    const { count: linked } = await supabase
      .from('shopify_products')
      .select('*', { count: 'exact', head: true })
      .not('linked_inventory_id', 'is', null);

    return NextResponse.json({
      shopifyConfigured: isConfigured,
      stats: {
        totalLocal: totalLocal || 0,
        pendingEnrichment: pendingEnrichment || 0,
        enriched: enriched || 0,
        synced: synced || 0,
        linked: linked || 0,
        unlinked: (totalLocal || 0) - (linked || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching import status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import status' },
      { status: 500 }
    );
  }
}

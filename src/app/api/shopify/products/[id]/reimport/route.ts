import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getGraphQLClient, 
  isShopifyConfigured,
  FETCH_PRODUCT_BY_ID_QUERY 
} from '@/lib/shopify/client';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import { uuidSchema } from '@/lib/validation/schemas';
import type { 
  ShopifyProduct,
  ShopifyProductFromAPI,
  ShopifyImage,
  ShopifyVariant,
  ShopifyMetafield,
} from '@/types/shopify-products';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GraphQL response type
interface ProductQueryResponse {
  data: {
    product: ShopifyProductFromAPI | null;
  };
}

// Validate UUID parameter
function validateUUID(id: string): boolean {
  const result = uuidSchema.safeParse(id);
  return result.success;
}

// Transform Shopify API response to our database format
function transformShopifyProduct(product: ShopifyProductFromAPI) {
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

/**
 * POST /api/shopify/products/[id]/reimport
 * Re-import a single product from Shopify
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
    // Check Shopify configuration
    if (!(await isShopifyConfigured())) {
      return NextResponse.json(
        { error: 'Shopify is not configured' },
        { status: 400 }
      );
    }

    // Fetch local product to get Shopify ID
    const { data: localProduct, error: fetchError } = await supabase
      .from('shopify_products')
      .select('shopify_id')
      .eq('id', id)
      .single();

    if (fetchError || !localProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Get GraphQL client
    const graphqlClient = await getGraphQLClient();
    if (!graphqlClient) {
      return NextResponse.json(
        { error: 'Failed to create Shopify client' },
        { status: 500 }
      );
    }

    // Fetch product from Shopify
    const result = await graphqlClient.request(FETCH_PRODUCT_BY_ID_QUERY, {
      variables: {
        id: localProduct.shopify_id,
      },
    });
    const response = result as unknown as ProductQueryResponse;

    if (!response.data.product) {
      return NextResponse.json(
        { error: 'Product not found in Shopify (may have been deleted)' },
        { status: 404 }
      );
    }

    // Transform the data
    const productData = transformShopifyProduct(response.data.product);

    // Update local product with fresh Shopify data
    // Note: We preserve enriched content - only update original fields
    const { data: updatedProduct, error: updateError } = await supabase
      .from('shopify_products')
      .update({
        title: productData.title,
        description_html: productData.description_html,
        vendor: productData.vendor,
        product_type: productData.product_type,
        tags: productData.tags,
        status: productData.status,
        images: productData.images,
        variants: productData.variants,
        metafields: productData.metafields,
        shopify_updated_at: productData.shopify_updated_at,
        last_imported_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating product:', updateError);
      return NextResponse.json(
        { error: 'Failed to update product' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Product re-imported from Shopify',
      product: updatedProduct as ShopifyProduct,
    });
  } catch (error) {
    console.error('Error re-importing product:', error);
    return NextResponse.json(
      { 
        error: 'Failed to re-import product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

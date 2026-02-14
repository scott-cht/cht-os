import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { 
  isShopifyConfigured, 
  getGraphQLClient,
  CREATE_PRODUCT_MUTATION,
} from '@/lib/shopify/client';
import type { RawScrapedData } from '@/types';

/**
 * Shopify Push endpoint
 * Creates a DRAFT product in Shopify with all data
 * 
 * POST /api/shopify
 * Body: { productId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Check if Shopify is configured
    if (!(await isShopifyConfigured())) {
      return NextResponse.json(
        { 
          error: 'Shopify is not configured. Please add SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN to .env.local',
          configRequired: true,
        },
        { status: 500 }
      );
    }

    const supabase = createServerClient();

    // Get the product entry
    const { data: product, error: fetchError } = await supabase
      .from('product_onboarding')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Validate required data
    if (!product.title) {
      return NextResponse.json(
        { error: 'Product title is required. Please generate AI content first.' },
        { status: 400 }
      );
    }

    if (!product.sales_price) {
      return NextResponse.json(
        { error: 'Sales price is required. Please set pricing first.' },
        { status: 400 }
      );
    }

    const rawData = product.raw_scraped_json as RawScrapedData | null;
    const graphqlClient = await getGraphQLClient();

    if (!graphqlClient) {
      return NextResponse.json(
        { error: 'Failed to create Shopify client' },
        { status: 500 }
      );
    }

    // Prepare product input for Shopify
    // IMPORTANT: Status is always DRAFT per PRD requirements
    const productInput = {
      title: product.title,
      descriptionHtml: product.description_html || rawData?.htmlParsed?.description || '',
      vendor: product.brand,
      status: 'DRAFT', // ALWAYS DRAFT - per PRD requirements
      metafields: [
        {
          namespace: 'product_scout',
          key: 'source_url',
          value: product.source_url || '',
          type: 'single_line_text_field',
        },
        {
          namespace: 'product_scout',
          key: 'model_number',
          value: product.model_number,
          type: 'single_line_text_field',
        },
        {
          namespace: 'product_scout',
          key: 'rrp_aud',
          value: product.rrp_aud?.toString() || '',
          type: 'single_line_text_field',
        },
      ],
    };

    // Create the product
    const createResponse = await graphqlClient.request(CREATE_PRODUCT_MUTATION, {
      variables: {
        input: productInput,
      },
    });

    const createData = createResponse.data as {
      productCreate: {
        product: {
          id: string;
          title: string;
          handle: string;
          status: string;
        } | null;
        userErrors: { field: string[]; message: string }[];
      };
    };

    if (createData.productCreate.userErrors.length > 0) {
      const errors = createData.productCreate.userErrors
        .map(e => e.message)
        .join(', ');
      throw new Error(`Shopify error: ${errors}`);
    }

    const shopifyProduct = createData.productCreate.product;
    
    if (!shopifyProduct) {
      throw new Error('Failed to create product in Shopify');
    }

    // Update variant with price and SKU
    await updateProductVariant(
      graphqlClient,
      shopifyProduct.id,
      product.sales_price.toString(),
      product.model_number
    );

    // Add images if available
    const processedImages = rawData?.processedImages || [];
    if (processedImages.length > 0) {
      await addProductImages(graphqlClient, shopifyProduct.id, processedImages);
    }

    // Update the product in Supabase
    const { error: updateError } = await supabase
      .from('product_onboarding')
      .update({
        shopify_product_id: shopifyProduct.id,
        status: 'synced',
      })
      .eq('id', productId);

    if (updateError) {
      console.error('Failed to update product status:', updateError);
    }

    // Get the store domain for the admin URL
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || '';
    const adminUrl = `https://${storeDomain}/admin/products/${shopifyProduct.id.replace('gid://shopify/Product/', '')}`;

    return NextResponse.json({
      success: true,
      shopifyProduct: {
        id: shopifyProduct.id,
        title: shopifyProduct.title,
        handle: shopifyProduct.handle,
        status: shopifyProduct.status,
        adminUrl,
      },
      message: 'Product created as DRAFT in Shopify',
    });

  } catch (error) {
    console.error('Shopify push error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to push to Shopify' },
      { status: 500 }
    );
  }
}

/**
 * Update product variant with price and SKU
 */
async function updateProductVariant(
  client: NonNullable<Awaited<ReturnType<typeof getGraphQLClient>>>,
  productId: string,
  price: string,
  sku: string
) {
  const GET_VARIANTS_QUERY = `
    query getProductVariants($productId: ID!) {
      product(id: $productId) {
        variants(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  `;

  const UPDATE_VARIANT_MUTATION = `
    mutation productVariantUpdate($input: ProductVariantInput!) {
      productVariantUpdate(input: $input) {
        productVariant {
          id
          price
          sku
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    // Get the variant ID
    const variantsResponse = await client.request(GET_VARIANTS_QUERY, {
      variables: { productId },
    });

    const variantsData = variantsResponse.data as {
      product: {
        variants: {
          edges: { node: { id: string } }[];
        };
      };
    };

    const variantId = variantsData.product?.variants?.edges?.[0]?.node?.id;
    
    if (!variantId) {
      console.warn('No variant found to update');
      return;
    }

    // Update the variant
    await client.request(UPDATE_VARIANT_MUTATION, {
      variables: {
        input: {
          id: variantId,
          price,
          sku,
        },
      },
    });
  } catch (error) {
    console.error('Failed to update variant:', error);
  }
}

/**
 * Add images to the product
 */
async function addProductImages(
  client: NonNullable<Awaited<ReturnType<typeof getGraphQLClient>>>,
  productId: string,
  images: NonNullable<RawScrapedData['processedImages']>
) {
  const ADD_IMAGES_MUTATION = `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          ... on MediaImage {
            id
            alt
          }
        }
        mediaUserErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const mediaInput = images.slice(0, 10).map(img => ({
      originalSource: img.publicUrl,
      alt: img.altText,
      mediaContentType: 'IMAGE',
    }));

    await client.request(ADD_IMAGES_MUTATION, {
      variables: {
        productId,
        media: mediaInput,
      },
    });
  } catch (error) {
    console.error('Failed to add images:', error);
    // Don't throw - product was created successfully, images are secondary
  }
}

/**
 * Check Shopify configuration status
 * 
 * GET /api/shopify
 */
export async function GET() {
  return NextResponse.json({
    configured: isShopifyConfigured(),
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || null,
  });
}

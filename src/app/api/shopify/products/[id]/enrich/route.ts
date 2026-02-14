import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateProductContent } from '@/lib/ai/copywriter';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import {
  acquireIdempotency,
  buildRequestHash,
  finalizeIdempotency,
  idempotencyReplayResponse,
} from '@/lib/api/idempotency';
import { uuidSchema } from '@/lib/validation/schemas';
import type { ShopifyProduct, EnrichResponse } from '@/types/shopify-products';
import type { RawScrapedData } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validate UUID parameter
function validateUUID(id: string): boolean {
  const result = uuidSchema.safeParse(id);
  return result.success;
}

// Convert Shopify product data to RawScrapedData format for copywriter
function buildRawScrapedData(product: ShopifyProduct): RawScrapedData {
  // Ensure arrays are valid (handle JSONB parsing edge cases)
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const images = Array.isArray(product.images) ? product.images : [];
  
  // Extract price from first variant
  const price = variants[0]?.price 
    ? parseFloat(variants[0].price) 
    : undefined;

  // Build specifications from metafields if available
  const specifications: Record<string, string> = {};
  if (product.metafields && typeof product.metafields === 'object') {
    Object.entries(product.metafields).forEach(([key, mf]) => {
      if (mf && typeof mf === 'object' && 'value' in mf) {
        // Convert namespace.key to readable format
        const displayKey = key.split('.').pop() || key;
        specifications[displayKey] = String(mf.value);
      }
    });
  }

  const storeDomain = (process.env.SHOPIFY_STORE_DOMAIN || '').trim();
  const normalizedStoreDomain = storeDomain
    ? storeDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    : '';
  const productPath = product.handle ? `/products/${product.handle}` : '';
  const sourceUrl = normalizedStoreDomain
    ? `https://${normalizedStoreDomain}${productPath}`
    : `https://shopify.com${productPath}`;

  return {
    jsonLd: {
      name: product.title,
      description: product.description_html?.replace(/<[^>]*>/g, ' ').trim() || '',
      brand: product.vendor || undefined,
      sku: variants[0]?.sku || undefined,
      offers: price ? {
        price: price.toString(),
        priceCurrency: 'AUD',
      } : undefined,
    },
    htmlParsed: {
      title: product.title,
      description: product.description_html?.replace(/<[^>]*>/g, ' ').trim() || '',
      specifications,
      images: images.map(img => img.url),
    },
    scrapedAt: new Date().toISOString(),
    sourceUrl,
  };
}

/**
 * POST /api/shopify/products/[id]/enrich
 * Generate AI-optimized content for a Shopify product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let idempotencyRecordId: string | null = null;

  // Rate limiting - use a stricter limit for AI operations
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
    const idempotencyKey =
      request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const idempotencyResult = await acquireIdempotency(supabase, {
        endpoint: `/api/shopify/products/${id}/enrich`,
        idempotencyKey,
        requestHash: buildRequestHash({ id }),
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

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return respond(
        { error: 'AI service not configured' },
        500,
        true
      );
    }

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

    // Fetch linked inventory item for additional context (if exists)
    let linkedData: { rrp_aud?: number; specifications?: Record<string, unknown> } = {};
    if (shopifyProduct.linked_inventory_id) {
      const { data: linkedItem } = await supabase
        .from('inventory_items')
        .select('rrp_aud, specifications')
        .eq('id', shopifyProduct.linked_inventory_id)
        .single();
      
      if (linkedItem) {
        linkedData = linkedItem;
      }
    }

    // Extract brand from vendor or title
    const brand = shopifyProduct.vendor || shopifyProduct.title.split(' ')[0] || 'Unknown';
    
    // Extract model from product type or title
    const modelNumber = shopifyProduct.product_type || 
      shopifyProduct.title.replace(brand, '').trim() ||
      shopifyProduct.handle || 
      'Product';

    // Build raw scraped data for copywriter
    const rawData = buildRawScrapedData(shopifyProduct);
    
    // Add linked item specs if available
    if (linkedData.specifications && typeof linkedData.specifications === 'object') {
      rawData.htmlParsed = rawData.htmlParsed || {};
      rawData.htmlParsed.specifications = {
        ...rawData.htmlParsed.specifications,
        ...Object.fromEntries(
          Object.entries(linkedData.specifications).map(([k, v]) => [k, String(v)])
        ),
      };
    }

    // Get RRP from linked item or variant compareAtPrice
    const rrpAud = linkedData.rrp_aud || 
      (shopifyProduct.variants[0]?.compareAtPrice 
        ? parseFloat(shopifyProduct.variants[0].compareAtPrice) 
        : undefined);

    // Generate content using existing copywriter
    let generated;
    try {
      generated = await generateProductContent({
        brand,
        modelNumber,
        rawData,
        rrpAud,
      });
    } catch (aiError) {
      console.error('AI generation error:', aiError);
      return respond(
        {
          error: 'AI content generation failed',
          details: aiError instanceof Error ? aiError.message : 'Unknown AI error'
        },
        500,
        true
      );
    }

    // Update product with enriched content
    const { data: updatedProduct, error: updateError } = await supabase
      .from('shopify_products')
      .update({
        enriched_title: generated.title,
        enriched_description_html: generated.descriptionHtml,
        enriched_meta_description: generated.metaDescription,
        enrichment_status: 'enriched',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating product:', updateError);
      return respond(
        { error: 'Failed to save enriched content', details: updateError.message },
        500,
        true
      );
    }

    const response: EnrichResponse = {
      success: true,
      product: updatedProduct as ShopifyProduct,
      generated: {
        title: generated.title,
        titleLength: generated.title.length,
        metaDescription: generated.metaDescription,
        metaDescriptionLength: generated.metaDescription.length,
        descriptionHtml: generated.descriptionHtml,
      },
    };

    return respond(response, 200);
  } catch (error) {
    console.error('Error enriching product:', error);
    const errorPayload = {
      error: 'Failed to enrich product',
      details: error instanceof Error ? error.message : 'Unknown error'
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { validateBody, ValidationError } from '@/lib/validation/schemas';
import { klaviyoGenerateSchema } from '@/lib/validation/schemas';
import { errors } from '@/lib/api/response';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import {
  acquireIdempotency,
  buildRequestHash,
  finalizeIdempotency,
  idempotencyReplayResponse,
} from '@/lib/api/idempotency';
import { generateEmailFromInventory, type StyleGuideSample } from '@/lib/ai/email-copywriter';
import type { InventoryItemForEmail } from '@/types/klaviyo';
import { config } from '@/config';

const idempotencySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeProductBaseUrl(): string {
  const configured = config.klaviyo.productBaseUrl?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  if (!storeDomain) {
    return '';
  }
  const host = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${host}/products`;
}

function normalizeShopifyProductGid(productId: string | null | undefined): string | null {
  if (!productId) {
    return null;
  }
  if (productId.startsWith('gid://shopify/Product/')) {
    return productId;
  }
  if (/^\d+$/.test(productId)) {
    return `gid://shopify/Product/${productId}`;
  }
  return null;
}

/**
 * POST /api/klaviyo/generate
 * Generate email copy from inventory and style guides using AI
 */
export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const anthropicCheck = checkRateLimit(rateLimiters.anthropic, clientIp);
  const klaviyoCheck = checkRateLimit(rateLimiters.klaviyo, clientIp);
  if (!anthropicCheck.allowed) {
    return errors.rateLimited(anthropicCheck.retryAfter);
  }
  if (!klaviyoCheck.allowed) {
    return errors.rateLimited(klaviyoCheck.retryAfter);
  }

  let idempotencyRecordId: string | null = null;

  try {
    const raw = await request.json();
    const body = validateBody(klaviyoGenerateSchema, raw);

    const idempotencyKey =
      request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const idempotencyResult = await acquireIdempotency(idempotencySupabase, {
        endpoint: '/api/klaviyo/generate',
        idempotencyKey,
        requestHash: buildRequestHash(body),
      });

      if (idempotencyResult.type === 'conflict') {
        return errors.conflict('Idempotency key reused with different request body');
      }
      if (idempotencyResult.type === 'in_progress') {
        return errors.conflict('A request with this idempotency key is already in progress');
      }
      if (idempotencyResult.type === 'replay') {
        return idempotencyReplayResponse(
          idempotencyResult.statusCode,
          idempotencyResult.responseBody
        );
      }
      idempotencyRecordId = idempotencyResult.recordId;
    }

    const respond = async (response: NextResponse, failed: boolean = false) => {
      if (idempotencyRecordId) {
        let payload: unknown = null;
        try {
          payload = await response.clone().json();
        } catch {
          payload = null;
        }
        await finalizeIdempotency(idempotencySupabase, {
          recordId: idempotencyRecordId,
          statusCode: response.status,
          responseBody: payload,
          failed,
        });
      }
      return response;
    };

    const supabase = createServerClient();

    // Load style guides by ID
    const { data: guideRows, error: guideError } = await supabase
      .from('email_style_guides')
      .select('id, name, subject, html, plain_text, layout_notes, section_tags')
      .in('id', body.styleGuideIds);

    if (guideError) {
      console.error('Style guides fetch error:', guideError);
      return respond(errors.database(guideError.message), true);
    }
    if (!guideRows?.length) {
      return respond(errors.badRequest('No style guides found for the given IDs'));
    }

    // Extract style block from FULL first-guide HTML before truncating, so we never lose styles
    const firstRow = guideRows[0];
    const fullFirstHtml = typeof firstRow?.html === 'string' ? firstRow.html : '';
    const styleBlockMatch = fullFirstHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const injectedStyleBlock = styleBlockMatch ? styleBlockMatch[1].trim().slice(0, 16000) : null;

    // Truncate style guide HTML for the prompt to avoid token limit; copywriter will use injectedStyleBlock for injection
    const MAX_STYLE_GUIDE_HTML_CHARS = 20_000;
    const styleGuideSamples: StyleGuideSample[] = guideRows.map((r) => {
      const rawHtml = r.html ?? undefined;
      const html =
        typeof rawHtml === 'string' && rawHtml.length > MAX_STYLE_GUIDE_HTML_CHARS
          ? rawHtml.slice(0, MAX_STYLE_GUIDE_HTML_CHARS) + '...[truncated]'
          : rawHtml;
      return {
        subject: r.subject,
        html,
        plainText: r.plain_text ?? null,
        layoutNotes: r.layout_notes ?? null,
        sectionTags: Array.isArray(r.section_tags) ? r.section_tags as { type: string; description?: string }[] : [],
      };
    });

    // Load inventory: by IDs or by filter
    let inventoryRows: {
      id: string;
      brand: string;
      model: string;
      title: string | null;
      sale_price: number;
      listing_type: string;
      image_urls: string[];
      description_html: string | null;
      condition_grade: string | null;
      condition_report: string | null;
      shopify_product_id: string | null;
    }[];

    if (body.inventoryIds?.length) {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, brand, model, title, sale_price, listing_type, image_urls, description_html, condition_grade, condition_report, shopify_product_id')
        .in('id', body.inventoryIds);
      if (error) return respond(errors.database(error.message), true);
      inventoryRows = data ?? [];
    } else {
      const limit = Math.min(body.filter?.limit ?? 10, 50);
      let query = supabase
        .from('inventory_items')
        .select('id, brand, model, title, sale_price, listing_type, image_urls, description_html, condition_grade, condition_report, shopify_product_id')
        .eq('is_archived', false)
        .limit(limit)
        .order('created_at', { ascending: false });
      if (body.filter?.listingTypes?.length) {
        query = query.in('listing_type', body.filter.listingTypes);
      }
      const { data, error } = await query;
      if (error) return respond(errors.database(error.message), true);
      inventoryRows = data ?? [];
    }

    if (!inventoryRows.length) {
      return respond(errors.badRequest('No inventory items found for the given criteria'));
    }

    // Preserve selection order when inventoryIds was provided (first = hero etc.)
    const orderedRows =
      body.inventoryIds?.length ?
        body.inventoryIds
          .map((id) => inventoryRows.find((r) => r.id === id))
          .filter((r): r is NonNullable<typeof r> => r != null)
        : inventoryRows;

    const productBaseUrl = normalizeProductBaseUrl();
    const selectedInventoryIds = orderedRows.map((row) => row.id);
    const linkedShopifyGids = orderedRows
      .map((row) => normalizeShopifyProductGid(row.shopify_product_id))
      .filter((gid): gid is string => Boolean(gid));

    const productHandleByInventoryId = new Map<string, string>();
    if (selectedInventoryIds.length || linkedShopifyGids.length) {
      let handleQuery = supabase
        .from('shopify_products')
        .select('handle, linked_inventory_id, shopify_id')
        .not('handle', 'is', null);
      const orFilters: string[] = [];
      if (selectedInventoryIds.length) {
        orFilters.push(`linked_inventory_id.in.(${selectedInventoryIds.join(',')})`);
      }
      if (linkedShopifyGids.length) {
        const quotedGids = linkedShopifyGids.map((gid) => `"${gid}"`).join(',');
        orFilters.push(`shopify_id.in.(${quotedGids})`);
      }
      if (orFilters.length) {
        handleQuery = handleQuery.or(orFilters.join(','));
      }

      const { data: productLinkRows, error: productLinkError } = await handleQuery;
      if (!productLinkError && productLinkRows?.length) {
        const byShopifyId = new Map<string, string>();
        for (const row of productLinkRows) {
          if (row.shopify_id && row.handle) {
            byShopifyId.set(row.shopify_id, row.handle);
          }
          if (row.linked_inventory_id && row.handle) {
            productHandleByInventoryId.set(row.linked_inventory_id, row.handle);
          }
        }
        for (const row of orderedRows) {
          if (!productHandleByInventoryId.has(row.id)) {
            const gid = normalizeShopifyProductGid(row.shopify_product_id);
            if (gid && byShopifyId.has(gid)) {
              productHandleByInventoryId.set(row.id, byShopifyId.get(gid)!);
            }
          }
        }
      } else if (productLinkError) {
        console.warn('[Klaviyo generate] Failed to fetch Shopify handle mappings:', productLinkError.message);
      }
    }

    const missingUrlMappings: string[] = [];

    const inventoryItems: InventoryItemForEmail[] = orderedRows.map((r) => {
      const handle = productHandleByInventoryId.get(r.id);
      if (productBaseUrl && !handle) {
        missingUrlMappings.push(r.id);
      }
      return {
        id: r.id,
        brand: r.brand,
        model: r.model,
        title: r.title,
        sale_price: r.sale_price,
        listing_type: r.listing_type,
        image_urls: Array.isArray(r.image_urls) ? r.image_urls : [],
        product_url: productBaseUrl ? `${productBaseUrl}/${handle || r.id}` : null,
        description_html: r.description_html,
        condition_grade: r.condition_grade,
        condition_report: r.condition_report,
      };
    });

    if (missingUrlMappings.length > 0) {
      console.warn(
        `[Klaviyo generate] Missing Shopify handle for ${missingUrlMappings.length} inventory item(s), using ID fallback`,
        { inventoryIds: missingUrlMappings }
      );
    }

    const generated = await generateEmailFromInventory({
      inventoryItems,
      styleGuideSamples,
      injectedStyleBlock,
      intent: body.intent,
    });

    return respond(NextResponse.json({
      subject: generated.subject,
      preheader: generated.preheader,
      htmlBody: generated.htmlBody,
      plainText: generated.plainText,
    }));
  } catch (err) {
    let response: NextResponse;
    if (err instanceof ValidationError) {
      response = errors.validation(err.message, err.errors);
    } else {
      console.error('Klaviyo generate error:', err);
      response = errors.internal(err instanceof Error ? err.message : 'Email generation failed');
    }
    if (idempotencyRecordId) {
      let payload: unknown = null;
      try {
        payload = await response.clone().json();
      } catch {
        payload = null;
      }
      await finalizeIdempotency(idempotencySupabase, {
        recordId: idempotencyRecordId,
        statusCode: response.status,
        responseBody: payload,
        failed: true,
      });
    }
    return response;
  }
}

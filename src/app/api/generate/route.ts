import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateProductContent } from '@/lib/ai/copywriter';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import type { RawScrapedData } from '@/types';

/**
 * AI Content Generation endpoint
 * Generates SEO-optimized title, description, and meta content
 * 
 * POST /api/generate
 * Body: { productId: string }
 */
export async function POST(request: NextRequest) {
  // Rate limit check for Anthropic API
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.anthropic, clientIp);
  
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limited. Please try again later.', retryAfter: rateCheck.retryAfter },
      { 
        status: 429,
        headers: {
          'Retry-After': String(rateCheck.retryAfter),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
        },
      }
    );
  }

  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Please add ANTHROPIC_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    const supabase = createServerClient();

    // Get the inventory item
    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Build raw data from specifications or use empty object
    const rawData: RawScrapedData = {
      htmlParsed: {
        title: item.title || `${item.brand} ${item.model}`,
        description: item.description_html || '',
        specifications: (item.specifications as Record<string, string>) || {},
        images: item.image_urls || [],
      },
      scrapedAt: new Date().toISOString(),
      sourceUrl: item.source_url || '',
    };

    // Generate AI content
    const aiContent = await generateProductContent({
      brand: item.brand,
      modelNumber: item.model,
      rawData,
      rrpAud: item.rrp_aud,
    });

    // Update the inventory item with generated content
    const { data: updatedItem, error: updateError } = await supabase
      .from('inventory_items')
      .update({
        title: aiContent.title,
        description_html: aiContent.descriptionHtml,
        meta_description: aiContent.metaDescription,
        // Store additional AI data in specifications
        specifications: {
          ...(item.specifications || {}),
          _aiGenerated: {
            altTexts: aiContent.altTexts,
            generatedAt: new Date().toISOString(),
          },
        },
      })
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to save generated content: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
      generated: {
        title: aiContent.title,
        titleLength: aiContent.title.length,
        metaDescription: aiContent.metaDescription,
        metaDescriptionLength: aiContent.metaDescription.length,
        descriptionHtml: aiContent.descriptionHtml,
        altTextsCount: aiContent.altTexts.length,
      },
    });

  } catch (error) {
    console.error('AI generation error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI generation failed' },
      { status: 500 }
    );
  }
}

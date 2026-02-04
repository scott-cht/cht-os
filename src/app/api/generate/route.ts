import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateProductContent } from '@/lib/ai/copywriter';
import type { RawScrapedData } from '@/types';

/**
 * AI Content Generation endpoint
 * Generates SEO-optimized title, description, and meta content
 * 
 * POST /api/generate
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

    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Please add ANTHROPIC_API_KEY to .env.local' },
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

    if (!product.raw_scraped_json) {
      return NextResponse.json(
        { error: 'Product has no scraped data. Please extract data first.' },
        { status: 400 }
      );
    }

    const rawData = product.raw_scraped_json as RawScrapedData;

    // Generate AI content
    const aiContent = await generateProductContent({
      brand: product.brand,
      modelNumber: product.model_number,
      rawData,
      rrpAud: product.rrp_aud,
    });

    // Update the product with generated content
    const { data: updatedProduct, error: updateError } = await supabase
      .from('product_onboarding')
      .update({
        title: aiContent.title,
        description_html: aiContent.descriptionHtml,
        // Store alt texts in raw_scraped_json for now
        raw_scraped_json: {
          ...rawData,
          aiGenerated: {
            title: aiContent.title,
            metaDescription: aiContent.metaDescription,
            descriptionHtml: aiContent.descriptionHtml,
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
      product: updatedProduct,
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

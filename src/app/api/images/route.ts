import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { processProductImages } from '@/lib/images/processor';
import type { RawScrapedData, ProcessedImage } from '@/types';

/**
 * Image Processing endpoint
 * Downloads, converts to WebP, and uploads to Supabase Storage
 * 
 * POST /api/images
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

    const rawData = product.raw_scraped_json as RawScrapedData | null;

    if (!rawData?.htmlParsed?.images || rawData.htmlParsed.images.length === 0) {
      return NextResponse.json(
        { error: 'No images found to process. Please extract product data first.' },
        { status: 400 }
      );
    }

    // Get alt texts from AI generation if available
    const altTexts = rawData.aiGenerated?.altTexts || [];

    // Determine category from title or use default
    const category = detectCategory(product.title || product.model_number);

    // Process and upload images
    const { processed, failed } = await processProductImages(
      rawData.htmlParsed.images.slice(0, 10), // Limit to 10 images
      product.brand,
      product.model_number,
      category,
      productId,
      altTexts
    );

    // Update the product with processed images
    const updatedRawData: RawScrapedData = {
      ...rawData,
      processedImages: processed,
    };

    const { data: updatedProduct, error: updateError } = await supabase
      .from('product_onboarding')
      .update({
        raw_scraped_json: updatedRawData,
      })
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to save processed images: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      results: {
        total: rawData.htmlParsed.images.length,
        processed: processed.length,
        failed: failed.length,
        images: processed,
        failedUrls: failed,
      },
    });

  } catch (error) {
    console.error('Image processing error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Detect product category from title
 */
function detectCategory(title: string): string {
  const titleLower = title.toLowerCase();
  
  const categories: Record<string, string[]> = {
    'washing-machine': ['washer', 'washing machine', 'front load', 'top load'],
    'dryer': ['dryer', 'tumble dry'],
    'refrigerator': ['fridge', 'refrigerator', 'freezer'],
    'dishwasher': ['dishwasher'],
    'tv': ['tv', 'television', 'oled', 'qled', 'led tv'],
    'laptop': ['laptop', 'notebook', 'macbook'],
    'phone': ['phone', 'iphone', 'smartphone', 'galaxy'],
    'vacuum': ['vacuum', 'dyson', 'hoover'],
    'air-conditioner': ['air con', 'aircon', 'air conditioner', 'split system'],
    'oven': ['oven', 'cooktop', 'range'],
    'microwave': ['microwave'],
    'camera': ['camera', 'dslr', 'mirrorless'],
    'headphones': ['headphone', 'earbuds', 'airpods'],
    'speaker': ['speaker', 'soundbar', 'subwoofer'],
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => titleLower.includes(keyword))) {
      return category;
    }
  }
  
  return 'product';
}

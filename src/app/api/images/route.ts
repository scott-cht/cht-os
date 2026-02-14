import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { processProductImagesHybrid } from '@/lib/images/edge-processor';

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

    // Get image URLs from item (could be scraped URLs or uploaded base64)
    const imageUrls = item.image_urls || [];
    
    // Filter to only process URLs (not base64 data URIs which are already processed)
    const urlsToProcess = imageUrls.filter((url: string) => 
      url.startsWith('http://') || url.startsWith('https://')
    );

    if (urlsToProcess.length === 0) {
      return NextResponse.json(
        { error: 'No image URLs found to process. Images may already be processed or need to be scraped first.' },
        { status: 400 }
      );
    }

    // Get alt texts from specifications if AI generated them
    const specs = item.specifications as Record<string, unknown> || {};
    const aiGenerated = specs._aiGenerated as { altTexts?: string[] } | undefined;
    const altTexts = aiGenerated?.altTexts || [];

    // Determine category from title or use default
    const category = detectCategory(item.title || item.model);

    // Process images via Edge Function (or fallback to local)
    const result = await processProductImagesHybrid({
      productId,
      imageUrls: urlsToProcess.slice(0, 10), // Limit to 10 images
      brand: item.brand,
      model: item.model,
      category,
      altTexts,
    });

    // Fetch updated item
    const { data: updatedItem, error: refetchError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', productId)
      .single();

    if (refetchError) {
      console.error('Failed to fetch updated item:', refetchError);
    }

    return NextResponse.json({
      success: result.success,
      item: updatedItem,
      results: result.results,
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

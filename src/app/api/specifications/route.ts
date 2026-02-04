import { NextRequest, NextResponse } from 'next/server';
import { categorizeSpecifications, generateSpecificationsHtml } from '@/lib/ai/copywriter';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/specifications
 * Categorize raw specifications using AI
 */
export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { productId, specifications, brand, productType } = body;

    if (!specifications || typeof specifications !== 'object') {
      return NextResponse.json(
        { error: 'Specifications object is required' },
        { status: 400 }
      );
    }

    if (Object.keys(specifications).length === 0) {
      return NextResponse.json(
        { error: 'No specifications to categorize' },
        { status: 400 }
      );
    }

    // Categorize specifications using AI
    const categorizedSpecs = await categorizeSpecifications(
      specifications,
      brand || 'Unknown Brand',
      productType
    );

    // Generate HTML for display
    const specificationsHtml = generateSpecificationsHtml(categorizedSpecs);

    // If productId provided, save to database
    if (productId) {
      const supabase = createServerClient();
      
      // Get current product data
      const { data: product, error: fetchError } = await supabase
        .from('product_onboarding')
        .select('raw_scraped_json')
        .eq('id', productId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch product:', fetchError);
      } else {
        // Update with categorized specs
        const rawData = product?.raw_scraped_json || {};
        const updatedRawData = {
          ...rawData,
          categorizedSpecs,
        };

        const { error: updateError } = await supabase
          .from('product_onboarding')
          .update({ raw_scraped_json: updatedRawData })
          .eq('id', productId);

        if (updateError) {
          console.error('Failed to save categorized specs:', updateError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      categorizedSpecs,
      specificationsHtml,
      categoryCount: categorizedSpecs.categories.length,
      totalSpecs: categorizedSpecs.categories.reduce(
        (sum, cat) => sum + cat.items.length, 0
      ) + (categorizedSpecs.uncategorized?.length || 0),
    });

  } catch (error) {
    console.error('Specifications categorization error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to categorize specifications' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/specifications
 * Save edited specifications
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, categorizedSpecs } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    if (!categorizedSpecs) {
      return NextResponse.json(
        { error: 'Categorized specifications are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    
    // Get current product data
    const { data: product, error: fetchError } = await supabase
      .from('product_onboarding')
      .select('raw_scraped_json')
      .eq('id', productId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Update with edited specs
    const rawData = product?.raw_scraped_json || {};
    const updatedRawData = {
      ...rawData,
      categorizedSpecs,
    };

    const { error: updateError } = await supabase
      .from('product_onboarding')
      .update({ raw_scraped_json: updatedRawData })
      .eq('id', productId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to save specifications' },
        { status: 500 }
      );
    }

    // Generate updated HTML
    const { generateSpecificationsHtml } = await import('@/lib/ai/copywriter');
    const specificationsHtml = generateSpecificationsHtml(categorizedSpecs);

    return NextResponse.json({
      success: true,
      categorizedSpecs,
      specificationsHtml,
    });

  } catch (error) {
    console.error('Save specifications error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save specifications' },
      { status: 500 }
    );
  }
}

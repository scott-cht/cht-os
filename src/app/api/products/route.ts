import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';

/**
 * Create a new product onboarding entry
 * 
 * POST /api/products
 * Body: { brand: string, modelNumber: string, sourceUrl: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = checkRateLimit(rateLimiters.products, clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
        { status: 429 }
      );
    }

    const { brand, modelNumber, sourceUrl } = await request.json();

    if (!brand || !modelNumber || !sourceUrl) {
      return NextResponse.json(
        { error: 'Brand, model number, and source URL are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Create the product onboarding entry
    const { data, error } = await supabase
      .from('product_onboarding')
      .insert({
        brand,
        model_number: modelNumber,
        source_url: sourceUrl,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save product. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      product: data,
      message: 'Product saved! Ready for extraction.' 
    });

  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Failed to create product entry.' },
      { status: 500 }
    );
  }
}

/**
 * Get all product onboarding entries
 * 
 * GET /api/products
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = checkRateLimit(rateLimiters.products, clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
        { status: 429 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('product_onboarding')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ products: data });

  } catch (error) {
    console.error('Fetch products error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products.' },
      { status: 500 }
    );
  }
}

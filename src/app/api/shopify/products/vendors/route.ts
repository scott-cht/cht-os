import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/shopify/products/vendors
 * Get unique vendors for filtering
 */
export async function GET(request: Request) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.products, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const { data: vendors, error } = await supabase
      .from('shopify_products')
      .select('vendor')
      .not('vendor', 'is', null)
      .order('vendor');

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
    }

    const uniqueVendors = [...new Set(vendors?.map((v) => v.vendor).filter(Boolean))];
    return NextResponse.json({ vendors: uniqueVendors });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

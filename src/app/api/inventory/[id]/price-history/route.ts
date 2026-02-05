import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/inventory/[id]/price-history
 * 
 * Fetches price history for an inventory item.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Optional limit parameter
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    
    const supabase = createServerClient();
    
    // Fetch price history
    const { data: history, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('inventory_item_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Price history fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch price history' },
        { status: 500 }
      );
    }
    
    // Calculate price trends
    const trends = calculatePriceTrends(history || []);
    
    return NextResponse.json({
      history: history || [],
      trends,
      count: history?.length || 0,
    });
    
  } catch (error) {
    console.error('Price history error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

interface PriceHistoryEntry {
  id: string;
  inventory_item_id: string;
  cost_price: number | null;
  rrp_aud: number | null;
  sale_price: number | null;
  discount_percent: number | null;
  change_type: string;
  change_reason: string | null;
  changed_by: string | null;
  created_at: string;
}

interface PriceTrends {
  totalChanges: number;
  firstPrice: number | null;
  currentPrice: number | null;
  highestPrice: number | null;
  lowestPrice: number | null;
  averagePrice: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
}

function calculatePriceTrends(history: PriceHistoryEntry[]): PriceTrends {
  if (history.length === 0) {
    return {
      totalChanges: 0,
      firstPrice: null,
      currentPrice: null,
      highestPrice: null,
      lowestPrice: null,
      averagePrice: null,
      priceChange: null,
      priceChangePercent: null,
    };
  }
  
  // History is ordered by created_at DESC, so first item is most recent
  const salePrices = history
    .map(h => h.sale_price)
    .filter((p): p is number => p !== null);
  
  const currentPrice = salePrices[0] ?? null;
  const firstPrice = salePrices[salePrices.length - 1] ?? null;
  const highestPrice = salePrices.length > 0 ? Math.max(...salePrices) : null;
  const lowestPrice = salePrices.length > 0 ? Math.min(...salePrices) : null;
  const averagePrice = salePrices.length > 0 
    ? salePrices.reduce((a, b) => a + b, 0) / salePrices.length 
    : null;
  
  let priceChange: number | null = null;
  let priceChangePercent: number | null = null;
  
  if (currentPrice !== null && firstPrice !== null && firstPrice !== 0) {
    priceChange = currentPrice - firstPrice;
    priceChangePercent = ((currentPrice - firstPrice) / firstPrice) * 100;
  }
  
  return {
    totalChanges: history.length,
    firstPrice,
    currentPrice,
    highestPrice,
    lowestPrice,
    averagePrice: averagePrice !== null ? Math.round(averagePrice * 100) / 100 : null,
    priceChange: priceChange !== null ? Math.round(priceChange * 100) / 100 : null,
    priceChangePercent: priceChangePercent !== null ? Math.round(priceChangePercent * 100) / 100 : null,
  };
}

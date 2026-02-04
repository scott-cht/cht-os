import { NextRequest, NextResponse } from 'next/server';
import type { RRPSearchResult } from '@/types';

/**
 * Australian RRP Search API
 * 
 * POST /api/rrp
 * Body: { brand: string, model: string }
 * 
 * Searches Australian retailers for the RRP of a product.
 * Ignores international sites and marketplaces (eBay, Amazon, Gumtree).
 */

// Australian retailer domains to search
const AUSTRALIAN_RETAILERS = [
  'jbhifi.com.au',
  'harveynorman.com.au',
  'thegoodguys.com.au',
  'officeworks.com.au',
  'bing-lee.com.au',
  'appliance-online.com.au',
  'mwave.com.au',
  'scorptec.com.au',
  'pccasegear.com',
  'centrecom.com.au',
  'videopro.com.au',
  'av2day.com.au',
  'selby.com.au',
  'todds.com.au',
  'digitalcinema.com.au',
  'addictedtoaudio.com.au',
  'minidisc.com.au',
  'noosa-hifi.com.au',
  'clefhifi.com.au',
  'stereophile.com.au',
  // Brand official AU stores
  'marantz.com.au',
  'denon.com.au',
  'sony.com.au',
  'samsung.com.au',
  'lg.com.au',
  'apple.com.au',
];

// Sites to exclude (marketplaces, international)
const EXCLUDED_DOMAINS = [
  'ebay.com',
  'amazon.com',
  'amazon.com.au',
  'gumtree.com.au',
  'facebook.com',
  'marketplace',
  'alibaba',
  'aliexpress',
  'wish.com',
  'kogan.com', // Often grey market
];

interface SerpApiResult {
  organic_results?: Array<{
    title: string;
    link: string;
    snippet: string;
    displayed_link: string;
    price?: {
      value: string;
      extracted_value: number;
      currency: string;
    };
  }>;
  shopping_results?: Array<{
    title: string;
    link: string;
    source: string;
    price: string;
    extracted_price: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const { brand, model } = await request.json();

    if (!brand || !model) {
      return NextResponse.json(
        { error: 'Brand and model are required' },
        { status: 400 }
      );
    }

    // Build search query focused on Australian retailers
    const searchQuery = `${brand} ${model} price AUD site:.com.au`;
    
    // Check if SerpAPI is configured
    const serpApiKey = process.env.SERPAPI_API_KEY;
    
    if (serpApiKey) {
      // Use SerpAPI for real search
      const result = await searchWithSerpAPI(serpApiKey, brand, model);
      if (result) {
        return NextResponse.json(result);
      }
    }
    
    // Fallback: Try web scraping approach
    const scrapedResult = await scrapeAustralianRetailers(brand, model);
    if (scrapedResult) {
      return NextResponse.json(scrapedResult);
    }

    // No result found
    return NextResponse.json({
      rrp_aud: null,
      source: null,
      source_url: null,
      confidence: 'low',
      message: 'Could not find RRP from Australian retailers. Please enter manually.',
      retrieved_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('RRP search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search for RRP' },
      { status: 500 }
    );
  }
}

/**
 * Search using SerpAPI
 */
async function searchWithSerpAPI(
  apiKey: string, 
  brand: string, 
  model: string
): Promise<RRPSearchResult | null> {
  try {
    // Search Google Shopping AU
    const shoppingUrl = new URL('https://serpapi.com/search');
    shoppingUrl.searchParams.set('engine', 'google_shopping');
    shoppingUrl.searchParams.set('q', `${brand} ${model}`);
    shoppingUrl.searchParams.set('location', 'Australia');
    shoppingUrl.searchParams.set('google_domain', 'google.com.au');
    shoppingUrl.searchParams.set('gl', 'au');
    shoppingUrl.searchParams.set('hl', 'en');
    shoppingUrl.searchParams.set('api_key', apiKey);

    const shoppingResponse = await fetch(shoppingUrl.toString());
    const shoppingData = await shoppingResponse.json() as SerpApiResult;

    // Filter for Australian retailers only
    const validResults = shoppingData.shopping_results?.filter(result => {
      const source = result.source?.toLowerCase() || '';
      const link = result.link?.toLowerCase() || '';
      
      // Check if from Australian retailer
      const isAustralian = AUSTRALIAN_RETAILERS.some(domain => 
        source.includes(domain.replace('.com.au', '')) || link.includes(domain)
      );
      
      // Check if excluded
      const isExcluded = EXCLUDED_DOMAINS.some(domain => 
        source.includes(domain) || link.includes(domain)
      );
      
      return isAustralian && !isExcluded;
    }) || [];

    if (validResults.length > 0) {
      // Get the most common price (mode) or highest for RRP
      const prices = validResults
        .map(r => r.extracted_price)
        .filter(p => p && p > 0)
        .sort((a, b) => b - a);

      if (prices.length > 0) {
        const bestResult = validResults.find(r => r.extracted_price === prices[0]);
        
        return {
          rrp_aud: prices[0],
          source: bestResult?.source || 'Google Shopping AU',
          source_url: bestResult?.link || '',
          confidence: prices.length >= 3 ? 'high' : prices.length >= 2 ? 'medium' : 'low',
          retrieved_at: new Date().toISOString(),
        };
      }
    }

    // Try organic search as fallback
    const organicUrl = new URL('https://serpapi.com/search');
    organicUrl.searchParams.set('engine', 'google');
    organicUrl.searchParams.set('q', `${brand} ${model} price AUD`);
    organicUrl.searchParams.set('location', 'Australia');
    organicUrl.searchParams.set('google_domain', 'google.com.au');
    organicUrl.searchParams.set('gl', 'au');
    organicUrl.searchParams.set('hl', 'en');
    organicUrl.searchParams.set('api_key', apiKey);

    const organicResponse = await fetch(organicUrl.toString());
    const organicData = await organicResponse.json() as SerpApiResult;

    // Look for price in organic results
    const organicWithPrice = organicData.organic_results?.filter(result => {
      const link = result.link?.toLowerCase() || '';
      const isAustralian = AUSTRALIAN_RETAILERS.some(domain => link.includes(domain));
      const isExcluded = EXCLUDED_DOMAINS.some(domain => link.includes(domain));
      return isAustralian && !isExcluded && result.price;
    }) || [];

    if (organicWithPrice.length > 0 && organicWithPrice[0].price) {
      return {
        rrp_aud: organicWithPrice[0].price.extracted_value,
        source: new URL(organicWithPrice[0].link).hostname,
        source_url: organicWithPrice[0].link,
        confidence: 'medium',
        retrieved_at: new Date().toISOString(),
      };
    }

    return null;

  } catch (error) {
    console.error('SerpAPI search error:', error);
    return null;
  }
}

/**
 * Fallback: Scrape known Australian retailers
 */
async function scrapeAustralianRetailers(
  brand: string, 
  model: string
): Promise<RRPSearchResult | null> {
  // Priority retailers to check
  const retailersToCheck = [
    {
      name: 'JB Hi-Fi',
      searchUrl: (b: string, m: string) => 
        `https://www.jbhifi.com.au/search?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'jbhifi.com.au',
    },
    {
      name: 'Harvey Norman',
      searchUrl: (b: string, m: string) => 
        `https://www.harveynorman.com.au/search?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'harveynorman.com.au',
    },
    {
      name: 'The Good Guys',
      searchUrl: (b: string, m: string) => 
        `https://www.thegoodguys.com.au/SearchDisplay?searchTerm=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'thegoodguys.com.au',
    },
  ];

  for (const retailer of retailersToCheck) {
    try {
      const url = retailer.searchUrl(brand, model);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-AU,en;q=0.9',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      });

      if (!response.ok) continue;

      const html = await response.text();
      
      // Extract price using regex patterns
      const pricePatterns = [
        /\$([0-9,]+(?:\.[0-9]{2})?)\s*(?:AUD)?/g,
        /data-price="([0-9.]+)"/g,
        /"price":\s*"?\$?([0-9,]+(?:\.[0-9]{2})?)"/g,
        /class="price[^"]*"[^>]*>\s*\$([0-9,]+(?:\.[0-9]{2})?)/g,
      ];

      const prices: number[] = [];
      
      for (const pattern of pricePatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const price = parseFloat(match[1].replace(',', ''));
          // Filter reasonable prices (between $50 and $100,000)
          if (price >= 50 && price <= 100000) {
            prices.push(price);
          }
        }
      }

      if (prices.length > 0) {
        // Use the highest price as RRP (sales prices would be lower)
        const rrp = Math.max(...prices);
        
        return {
          rrp_aud: rrp,
          source: retailer.name,
          source_url: url,
          confidence: 'medium',
          retrieved_at: new Date().toISOString(),
        };
      }

    } catch (error) {
      console.error(`Error scraping ${retailer.name}:`, error);
      continue;
    }
  }

  return null;
}

/**
 * GET /api/rrp - Documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/rrp',
    method: 'POST',
    description: 'Search for Australian RRP of a product',
    body: {
      brand: 'string (required)',
      model: 'string (required)',
    },
    response: {
      rrp_aud: 'number | null',
      source: 'string - retailer name',
      source_url: 'string - URL where price was found',
      confidence: 'high | medium | low',
      retrieved_at: 'ISO timestamp',
    },
    notes: [
      'Searches Australian retailers only (.com.au domains)',
      'Excludes marketplaces (eBay, Amazon, Gumtree)',
      'Uses SerpAPI if SERPAPI_API_KEY is configured',
      'Falls back to direct retailer scraping',
    ],
  });
}

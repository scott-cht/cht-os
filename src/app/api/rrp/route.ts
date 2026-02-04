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

// Sites to exclude (marketplaces, international, grey market)
const EXCLUDED_DOMAINS = [
  'ebay.com',
  'ebay.com.au',
  'amazon.com',
  'amazon.com.au',
  'gumtree.com.au',
  'facebook.com',
  'marketplace',
  'alibaba',
  'aliexpress',
  'wish.com',
  'kogan.com', // Often grey market
  'catch.com.au', // Marketplace
  'mydeal.com.au', // Marketplace
  'ozbargain.com.au', // Deal site, not retailer
  'staticice.com.au', // Price comparison, not retailer
  'pricespy.com.au', // Price comparison
];

// Specialist hi-fi retailers - prioritize these for specialist brands
const SPECIALIST_RETAILERS = [
  'addictedtoaudio.com.au',
  'selby.com.au',
  'todds.com.au',
  'digitalcinema.com.au',
  'clefhifi.com.au',
  'audiojunction.com.au',
  'lenwallisaudio.com.au',
  'stereo.net.au',
  'noosa-hifi.com.au',
  'melbournehifi.com.au',
  'sydhifi.com.au',
  'lifestyle-store.com.au',
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
    const isSpecialist = isSpecialistBrand(brand);
    
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
      
      // For specialist brands, only trust specialist retailers
      const isSpecialistRetailer = SPECIALIST_RETAILERS.some(domain =>
        source.includes(domain.replace('.com.au', '')) || link.includes(domain)
      );
      
      // Reject mainstream retailers for specialist brands
      const isMainstreamRetailer = ['jb hi-fi', 'jbhifi', 'harvey norman', 'good guys', 'officeworks', 'bing lee'].some(
        name => source.toLowerCase().includes(name)
      );
      
      if (isSpecialist && isMainstreamRetailer && !isSpecialistRetailer) {
        return false; // Skip mainstream for specialist brands
      }
      
      return isAustralian && !isExcluded;
    }) || [];

    // Prioritize specialist retailers for specialist brands
    const sortedResults = isSpecialist
      ? validResults.sort((a, b) => {
          const aIsSpecialist = SPECIALIST_RETAILERS.some(d => a.link?.includes(d));
          const bIsSpecialist = SPECIALIST_RETAILERS.some(d => b.link?.includes(d));
          if (aIsSpecialist && !bIsSpecialist) return -1;
          if (!aIsSpecialist && bIsSpecialist) return 1;
          return 0;
        })
      : validResults;

    if (sortedResults.length > 0) {
      // Use the first result after sorting (prioritizes specialist for specialist brands)
      const prices = sortedResults
        .map(r => r.extracted_price)
        .filter(p => p && p > 0);

      if (prices.length > 0) {
        const bestResult = sortedResults[0];
        
        return {
          rrp_aud: bestResult.extracted_price,
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
    organicUrl.searchParams.set('q', `${brand} ${model} price AUD site:.com.au`);
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
      
      // For specialist brands, prefer specialist retailers
      if (isSpecialist) {
        const isSpecialistRetailer = SPECIALIST_RETAILERS.some(domain => link.includes(domain));
        const isMainstreamRetailer = ['jbhifi', 'harveynorman', 'thegoodguys'].some(name => link.includes(name));
        if (isMainstreamRetailer && !isSpecialistRetailer) return false;
      }
      
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

// Brand to specialist retailer mapping (specialist hi-fi brands need specialist retailers)
const SPECIALIST_BRANDS = [
  'exposure', 'naim', 'rega', 'linn', 'arcam', 'creek', 'cyrus', 'densen',
  'hegel', 'primare', 'rotel', 'cambridge audio', 'audiolab', 'musical fidelity',
  'mcintosh', 'mark levinson', 'krell', 'accuphase', 'luxman', 'pass labs',
  'focal', 'dynaudio', 'b&w', 'bowers', 'kef', 'dali', 'monitor audio',
  'spendor', 'harbeth', 'proac', 'atc', 'quad', 'wharfedale', 'tannoy',
  'chord', 'ps audio', 'bryston', 'parasound', 'anthem', 'classe',
  'moon', 'simaudio', 'ayre', 'boulder', 'gryphon', 'solution',
  'totem', 'sonus faber', 'vienna acoustics', 'wilson', 'magico',
];

function isSpecialistBrand(brand: string): boolean {
  const lower = brand.toLowerCase();
  return SPECIALIST_BRANDS.some(b => lower.includes(b));
}

/**
 * Fallback: Scrape known Australian retailers
 */
async function scrapeAustralianRetailers(
  brand: string, 
  model: string
): Promise<RRPSearchResult | null> {
  // Specialist hi-fi retailers (priority for specialist brands)
  const specialistRetailers = [
    {
      name: 'Addicted to Audio',
      searchUrl: (b: string, m: string) => 
        `https://addictedtoaudio.com.au/search?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'addictedtoaudio.com.au',
    },
    {
      name: 'Selby Acoustics',
      searchUrl: (b: string, m: string) => 
        `https://www.selby.com.au/catalogsearch/result/?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'selby.com.au',
    },
    {
      name: 'Todds Hi-Fi',
      searchUrl: (b: string, m: string) => 
        `https://www.todds.com.au/search?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'todds.com.au',
    },
    {
      name: 'Digital Cinema',
      searchUrl: (b: string, m: string) => 
        `https://www.digitalcinema.com.au/search?type=product&q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'digitalcinema.com.au',
    },
    {
      name: 'Clef Hi-Fi',
      searchUrl: (b: string, m: string) => 
        `https://www.clefhifi.com.au/search?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'clefhifi.com.au',
    },
    {
      name: 'Audio Junction',
      searchUrl: (b: string, m: string) => 
        `https://www.audiojunction.com.au/search?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'audiojunction.com.au',
    },
    {
      name: 'Len Wallis Audio',
      searchUrl: (b: string, m: string) =>
        `https://www.lenwallisaudio.com.au/search?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'lenwallisaudio.com.au',
    },
    {
      name: 'StereoNET',
      searchUrl: (b: string, m: string) =>
        `https://www.stereo.net.au/search?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'stereo.net.au',
    },
  ];

  // Mainstream retailers
  const mainstreamRetailers = [
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
    {
      name: 'Videopro',
      searchUrl: (b: string, m: string) => 
        `https://www.videopro.com.au/search?q=${encodeURIComponent(`${b} ${m}`)}`,
      domain: 'videopro.com.au',
    },
  ];

  // Choose retailer order based on brand
  const retailersToCheck = isSpecialistBrand(brand)
    ? [...specialistRetailers, ...mainstreamRetailers]
    : [...mainstreamRetailers, ...specialistRetailers];

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

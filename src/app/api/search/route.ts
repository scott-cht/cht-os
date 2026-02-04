import { NextRequest, NextResponse } from 'next/server';
import type { SearchResult } from '@/types';

/**
 * Search API endpoint
 * Searches for Australian product sources using SerpAPI or fallback
 * 
 * POST /api/search
 * Body: { brand: string, modelNumber: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both formats: { query } or { brand, modelNumber }
    let searchQuery: string;
    let brand: string | undefined;
    let modelNumber: string | undefined;
    
    if (body.query) {
      // Single query string format
      searchQuery = body.query;
      // Try to extract brand (first word) for retailer URLs
      const parts = body.query.trim().split(/\s+/);
      brand = parts[0];
      modelNumber = parts.slice(1).join(' ');
    } else if (body.brand && body.modelNumber) {
      // Separate brand/model format
      brand = body.brand;
      modelNumber = body.modelNumber;
      searchQuery = `${brand} ${modelNumber}`;
    } else {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    // Try SerpAPI if configured
    const serpApiKey = process.env.SERPAPI_API_KEY;
    
    if (serpApiKey && serpApiKey !== 'your-serpapi-key') {
      const results = await searchWithSerpApi(searchQuery, serpApiKey);
      return NextResponse.json({ results });
    }
    
    // Fallback: Return curated Australian retailer URLs for manual selection
    const results = generateAustralianRetailerUrls(brand || '', modelNumber || searchQuery);
    return NextResponse.json({ 
      results,
      notice: 'Using fallback search. Add SERPAPI_API_KEY for automated search results.'
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Search using SerpAPI with AU-specific filters
 */
async function searchWithSerpApi(query: string, apiKey: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: `${query} site:.com.au`,
    location: 'Australia',
    google_domain: 'google.com.au',
    gl: 'au',
    hl: 'en',
    num: '10',
    api_key: apiKey,
  });

  const response = await fetch(`https://serpapi.com/search?${params}`);
  
  if (!response.ok) {
    throw new Error(`SerpAPI error: ${response.status}`);
  }

  const data = await response.json();
  
  // Transform SerpAPI results to our format
  const results: SearchResult[] = (data.organic_results || [])
    .slice(0, 5)
    .map((result: { title: string; link: string; snippet: string }) => {
      const url = new URL(result.link);
      const domain = url.hostname;
      const isAustralian = domain.endsWith('.com.au') || domain.endsWith('.au');
      
      return {
        title: result.title,
        url: result.link,
        snippet: result.snippet || '',
        domain,
        isAustralian,
      };
    });

  return results;
}

/**
 * Fallback: Generate search URLs for specialist AV retailers and manufacturers
 */
function generateAustralianRetailerUrls(brand: string, modelNumber: string): SearchResult[] {
  const query = encodeURIComponent(`${brand} ${modelNumber}`);
  const brandLower = brand.toLowerCase();
  
  // Specialist AV retailers (prioritized)
  const specialists = [
    {
      name: 'Addicted to Audio',
      domain: 'addictedtoaudio.com.au',
      searchUrl: `https://addictedtoaudio.com.au/search?q=${query}`,
    },
    {
      name: 'Selby Acoustics',
      domain: 'selby.com.au',
      searchUrl: `https://www.selby.com.au/catalogsearch/result/?q=${query}`,
    },
    {
      name: 'Todds Hi Fi',
      domain: 'todds.com.au',
      searchUrl: `https://www.todds.com.au/search?q=${query}`,
    },
    {
      name: 'Digital Cinema',
      domain: 'digitalcinema.com.au',
      searchUrl: `https://www.digitalcinema.com.au/search?q=${query}`,
    },
    {
      name: 'Videopro',
      domain: 'videopro.com.au',
      searchUrl: `https://www.videopro.com.au/search/?q=${query}`,
    },
    {
      name: 'Minidisc',
      domain: 'minidisc.com.au',
      searchUrl: `https://www.minidisc.com.au/search?q=${query}`,
    },
    {
      name: 'Clef Hi-Fi',
      domain: 'clefhifi.com.au',
      searchUrl: `https://www.clefhifi.com.au/?s=${query}`,
    },
  ];

  // Brand-specific manufacturer sites
  const manufacturers: Record<string, { name: string; domain: string; searchUrl: string }> = {
    'marantz': {
      name: 'Marantz Australia',
      domain: 'marantz.com.au',
      searchUrl: `https://www.marantz.com/en-au/search?query=${query}`,
    },
    'denon': {
      name: 'Denon Australia',
      domain: 'denon.com.au',
      searchUrl: `https://www.denon.com/en-au/search?query=${query}`,
    },
    'yamaha': {
      name: 'Yamaha Australia',
      domain: 'au.yamaha.com',
      searchUrl: `https://au.yamaha.com/en/search.html?q=${query}`,
    },
    'sony': {
      name: 'Sony Australia',
      domain: 'sony.com.au',
      searchUrl: `https://www.sony.com.au/search?query=${query}`,
    },
    'bose': {
      name: 'Bose Australia',
      domain: 'bose.com.au',
      searchUrl: `https://www.bose.com.au/en_au/search.html?q=${query}`,
    },
    'sonos': {
      name: 'Sonos',
      domain: 'sonos.com',
      searchUrl: `https://www.sonos.com/en-au/search?q=${query}`,
    },
    'kef': {
      name: 'KEF',
      domain: 'kef.com',
      searchUrl: `https://au.kef.com/pages/search-results?q=${query}`,
    },
    'bowers': {
      name: 'Bowers & Wilkins',
      domain: 'bowerswilkins.com',
      searchUrl: `https://www.bowerswilkins.com/en-au/search?q=${query}`,
    },
  };

  const results: SearchResult[] = [];

  // Add manufacturer site first if brand matches
  const manufacturerKey = Object.keys(manufacturers).find(key => brandLower.includes(key));
  if (manufacturerKey) {
    const mfr = manufacturers[manufacturerKey];
    results.push({
      title: `Official: ${brand} ${modelNumber} on ${mfr.name}`,
      url: mfr.searchUrl,
      snippet: `View official product information, specifications, and pricing from the manufacturer.`,
      domain: mfr.domain,
      isAustralian: mfr.domain.endsWith('.com.au'),
    });
  }

  // Add specialist retailers
  specialists.forEach((retailer) => {
    results.push({
      title: `${brand} ${modelNumber} - ${retailer.name}`,
      url: retailer.searchUrl,
      snippet: `Specialist AV retailer. Search for ${brand} ${modelNumber} with expert support.`,
      domain: retailer.domain,
      isAustralian: true,
    });
  });

  return results;
}

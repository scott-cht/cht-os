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
    const { brand, modelNumber } = await request.json();

    if (!brand || !modelNumber) {
      return NextResponse.json(
        { error: 'Brand and model number are required' },
        { status: 400 }
      );
    }

    const searchQuery = `${brand} ${modelNumber}`;
    
    // Try SerpAPI if configured
    const serpApiKey = process.env.SERPAPI_API_KEY;
    
    if (serpApiKey && serpApiKey !== 'your-serpapi-key') {
      const results = await searchWithSerpApi(searchQuery, serpApiKey);
      return NextResponse.json({ results });
    }
    
    // Fallback: Return curated Australian retailer URLs for manual selection
    const results = generateAustralianRetailerUrls(brand, modelNumber);
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
 * Fallback: Generate search URLs for major Australian retailers
 */
function generateAustralianRetailerUrls(brand: string, modelNumber: string): SearchResult[] {
  const query = encodeURIComponent(`${brand} ${modelNumber}`);
  
  const retailers = [
    {
      name: 'Harvey Norman',
      domain: 'harveynorman.com.au',
      searchUrl: `https://www.harveynorman.com.au/search?q=${query}`,
    },
    {
      name: 'JB Hi-Fi',
      domain: 'jbhifi.com.au',
      searchUrl: `https://www.jbhifi.com.au/search?query=${query}`,
    },
    {
      name: 'The Good Guys',
      domain: 'thegoodguys.com.au',
      searchUrl: `https://www.thegoodguys.com.au/SearchDisplay?searchTerm=${query}`,
    },
    {
      name: 'Appliances Online',
      domain: 'appliancesonline.com.au',
      searchUrl: `https://www.appliancesonline.com.au/search/${query}`,
    },
    {
      name: 'Bing Lee',
      domain: 'binglee.com.au',
      searchUrl: `https://www.binglee.com.au/search?q=${query}`,
    },
  ];

  return retailers.map((retailer) => ({
    title: `Search "${brand} ${modelNumber}" on ${retailer.name}`,
    url: retailer.searchUrl,
    snippet: `Find ${brand} ${modelNumber} on ${retailer.name} - Australia's trusted retailer. Click to search and find the product page.`,
    domain: retailer.domain,
    isAustralian: true,
  }));
}

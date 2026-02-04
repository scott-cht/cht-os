import { chromium, type Browser, type Page } from 'playwright';
import type { RawScrapedData } from '@/types';

/**
 * Scraper configuration
 */
const SCRAPER_CONFIG = {
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/**
 * Extract JSON-LD structured data from page
 * This is the primary Source of Truth for RRP, SKU, and Name per PRD
 */
async function extractJsonLd(page: Page): Promise<RawScrapedData['jsonLd'] | null> {
  try {
    const jsonLdData = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          // Look for Product schema
          if (data['@type'] === 'Product' || 
              (Array.isArray(data['@graph']) && data['@graph'].find((item: { '@type': string }) => item['@type'] === 'Product'))) {
            const product = data['@type'] === 'Product' 
              ? data 
              : data['@graph'].find((item: { '@type': string }) => item['@type'] === 'Product');
            return product;
          }
        } catch {
          continue;
        }
      }
      return null;
    });
    
    return jsonLdData;
  } catch (error) {
    console.error('Error extracting JSON-LD:', error);
    return null;
  }
}

/**
 * Fallback HTML parsing for product data
 */
async function parseHtmlFallback(page: Page): Promise<RawScrapedData['htmlParsed']> {
  return page.evaluate(() => {
    const getMetaContent = (name: string): string | undefined => {
      const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return meta?.getAttribute('content') || undefined;
    };
    
    const title = document.querySelector('h1')?.textContent?.trim() 
      || getMetaContent('og:title') 
      || document.title;
    
    const description = getMetaContent('description') 
      || getMetaContent('og:description');
    
    // Extract images
    const images: string[] = [];
    const ogImage = getMetaContent('og:image');
    if (ogImage) images.push(ogImage);
    
    document.querySelectorAll('img[src*="product"], img[data-src*="product"], .product-image img')
      .forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && !images.includes(src)) images.push(src);
      });
    
    // Extract specifications table
    const specifications: Record<string, string> = {};
    document.querySelectorAll('table tr, .specifications tr, .specs tr').forEach(row => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        const key = cells[0].textContent?.trim();
        const value = cells[1].textContent?.trim();
        if (key && value) specifications[key] = value;
      }
    });
    
    return {
      title,
      description,
      specifications,
      images,
    };
  });
}

/**
 * Main scraping function
 * Prioritizes JSON-LD extraction per PRD, falls back to HTML parsing
 */
export async function scrapeProductPage(url: string): Promise<RawScrapedData> {
  let browser: Browser | null = null;
  
  try {
    browser = await chromium.launch({
      headless: true,
    });
    
    const context = await browser.newContext({
      userAgent: SCRAPER_CONFIG.userAgent,
      locale: 'en-AU',
      timezoneId: 'Australia/Sydney',
    });
    
    const page = await context.newPage();
    
    await page.goto(url, {
      timeout: SCRAPER_CONFIG.timeout,
      waitUntil: 'domcontentloaded',
    });
    
    // Wait for dynamic content
    await page.waitForTimeout(2000);
    
    // Priority 1: Extract JSON-LD (Source of Truth per PRD)
    const jsonLd = await extractJsonLd(page);
    
    // Priority 2: Fallback to HTML parsing
    const htmlParsed = await parseHtmlFallback(page);
    
    return {
      jsonLd: jsonLd || undefined,
      htmlParsed,
      scrapedAt: new Date().toISOString(),
      sourceUrl: url,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract price from scraped data
 * Prefers JSON-LD price, falls back to HTML
 */
export function extractPrice(data: RawScrapedData): number | null {
  // Try JSON-LD first
  if (data.jsonLd?.offers?.price) {
    return parseFloat(data.jsonLd.offers.price);
  }
  if (data.jsonLd?.price) {
    return parseFloat(data.jsonLd.price);
  }
  
  return null;
}

/**
 * Extract product name from scraped data
 */
export function extractProductName(data: RawScrapedData): string | null {
  return data.jsonLd?.name || data.htmlParsed?.title || null;
}

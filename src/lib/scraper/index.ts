import { chromium, type Browser, type Page, type BrowserContextOptions } from 'playwright';
import type { RawScrapedData } from '@/types';
import { scrapingConfig } from '@/config';

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
 * Build browser launch options with proxy if configured
 */
function getBrowserLaunchOptions() {
  const options: Parameters<typeof chromium.launch>[0] = {
    headless: true,
  };
  
  // Add proxy if enabled
  if (scrapingConfig.proxy.enabled && scrapingConfig.proxy.url) {
    options.proxy = {
      server: scrapingConfig.proxy.url,
    };
  }
  
  return options;
}

/**
 * Build browser context options
 */
function getContextOptions(): BrowserContextOptions {
  const options: BrowserContextOptions = {
    userAgent: scrapingConfig.userAgent,
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',
    // Emulate Australian geolocation (Sydney)
    geolocation: { latitude: -33.8688, longitude: 151.2093 },
    permissions: ['geolocation'],
  };
  
  return options;
}

/**
 * Main scraping function
 * Prioritizes JSON-LD extraction per PRD, falls back to HTML parsing
 * Per PRD: "Use AU residential proxies to see correct localized pricing/GST"
 */
export async function scrapeProductPage(url: string): Promise<RawScrapedData> {
  let browser: Browser | null = null;
  let lastError: Error | null = null;
  
  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= scrapingConfig.retry.maxAttempts; attempt++) {
    try {
      browser = await chromium.launch(getBrowserLaunchOptions());
      
      const context = await browser.newContext(getContextOptions());
      
      const page = await context.newPage();
      
      // Set extra headers for Australian requests
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-AU,en;q=0.9',
      });
      
      await page.goto(url, {
        timeout: scrapingConfig.timeoutMs,
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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Scraping attempt ${attempt} failed:`, lastError.message);
      
      // Calculate backoff delay
      if (attempt < scrapingConfig.retry.maxAttempts) {
        const delay = scrapingConfig.retry.delayMs * 
          Math.pow(scrapingConfig.retry.backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } finally {
      if (browser) {
        await browser.close();
        browser = null;
      }
    }
  }
  
  // All retries failed
  throw lastError || new Error('Scraping failed after all retries');
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

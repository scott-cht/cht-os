import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { createServerClient } from '@/lib/supabase/server';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';

/**
 * Scrape API endpoint
 * Extracts product data from a URL using Playwright
 * Priority: JSON-LD first, then HTML fallback
 * 
 * POST /api/scrape
 * Body: { url: string } OR { productId: string }
 */
export async function POST(request: NextRequest) {
  // Rate limit check for scraping (be polite to target sites)
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.scraping, clientIp);
  
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limited. Please wait before scraping more pages.', retryAfter: rateCheck.retryAfter },
      { 
        status: 429,
        headers: {
          'Retry-After': String(rateCheck.retryAfter),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
        },
      }
    );
  }

  let browser = null;
  
  try {
    const body = await request.json();
    const { url, productId } = body;

    let sourceUrl: string;
    let productRecord: { id?: string; source_url?: string } | null = null;

    // Support both direct URL and productId lookup
    if (url) {
      // Direct URL provided
      sourceUrl = url;
    } else if (productId) {
      // Look up from database
      const supabase = createServerClient();
      const { data: product, error: fetchError } = await supabase
        .from('product_onboarding')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError || !product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }

      if (!product.source_url) {
        return NextResponse.json(
          { error: 'Product has no source URL' },
          { status: 400 }
        );
      }

      sourceUrl = product.source_url;
      productRecord = product;

      // Update status to processing
      await supabase
        .from('product_onboarding')
        .update({ status: 'processing' })
        .eq('id', productId);
    } else {
      return NextResponse.json(
        { error: 'URL or Product ID is required' },
        { status: 400 }
      );
    }

    // Validate URL
    if (!sourceUrl.startsWith('http')) {
      return NextResponse.json(
        { error: 'Invalid URL. Please provide a valid product page URL.' },
        { status: 400 }
      );
    }

    // Launch browser and scrape
    browser = await chromium.launch({ headless: true });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-AU',
      timezoneId: 'Australia/Sydney',
    });

    const page = await context.newPage();

    // Navigate to the URL
    let targetUrl = sourceUrl;
    
    await page.goto(targetUrl, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });

    // Wait for dynamic content
    await page.waitForTimeout(2000);
    
    // Detect if this is a search results page and find actual product
    const searchPageResult = await detectAndFollowSearchResult(page, sourceUrl);
    if (searchPageResult.followed) {
      targetUrl = searchPageResult.productUrl || targetUrl;
      console.log(`Followed search result to: ${targetUrl}`);
      // Wait for new page to load
      await page.waitForTimeout(2000);
    }
    
    // Now add specifications anchor if applicable
    if (!targetUrl.includes('#specifications') && !targetUrl.includes('#specs')) {
      // Try scrolling to specifications section
      await page.evaluate(() => {
        const specsSection = document.querySelector('#specifications, #specs, [id*="specification"]');
        if (specsSection) {
          specsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
      await page.waitForTimeout(500);
    }

    // Expand all accordions/collapsible sections before scraping
    const tabClicked = await clickSpecificationsTab(page);
    await expandAccordions(page);

    // Debug: Get page HTML structure for specs section
    const debugInfo = await page.evaluate(() => {
      const debug: Record<string, unknown> = {};
      
      // Check what tabs exist
      const allTabs = Array.from(document.querySelectorAll('[role="tab"], .tab, [class*="tab"], button')).slice(0, 20);
      debug.tabsFound = allTabs.map(t => ({
        text: t.textContent?.trim().substring(0, 50),
        class: t.className,
        ariaSelected: t.getAttribute('aria-selected')
      }));
      
      // Check for accordion sections
      const accordions = Array.from(document.querySelectorAll('[class*="accordion"], [class*="Accordion"], details')).slice(0, 10);
      debug.accordionsFound = accordions.map(a => ({
        class: a.className,
        isOpen: a.hasAttribute('open') || a.querySelector('[aria-expanded="true"]') !== null,
        headerText: a.querySelector('summary, button, [class*="header"]')?.textContent?.trim().substring(0, 50)
      }));
      
      // Check for tables
      const tables = Array.from(document.querySelectorAll('table')).slice(0, 5);
      debug.tablesFound = tables.map(t => ({
        class: t.className,
        rowCount: t.querySelectorAll('tr').length,
        firstRowText: t.querySelector('tr')?.textContent?.trim().substring(0, 100)
      }));
      
      // Check for definition lists
      const dls = Array.from(document.querySelectorAll('dl')).slice(0, 5);
      debug.dlsFound = dls.map(dl => ({
        class: dl.className,
        dtCount: dl.querySelectorAll('dt').length,
        firstDt: dl.querySelector('dt')?.textContent?.trim().substring(0, 50)
      }));
      
      // Look for anything with "spec" in class name
      const specElements = Array.from(document.querySelectorAll('[class*="spec"], [class*="Spec"]')).slice(0, 10);
      debug.specElementsFound = specElements.map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.trim().substring(0, 100)
      }));
      
      // Look for list items that might contain specs
      const specLists = Array.from(document.querySelectorAll('ul li')).slice(0, 30);
      debug.listItemsFound = specLists.map(li => {
        const strong = li.querySelector('strong, b');
        return {
          hasStrong: !!strong,
          strongText: strong?.textContent?.trim().substring(0, 50),
          fullText: li.textContent?.trim().substring(0, 100),
          parentClass: li.parentElement?.className
        };
      }).filter(item => item.hasStrong || item.fullText?.includes(':'));
      
      return debug;
    });
    
    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

    // Priority 1: Extract JSON-LD (Source of Truth per PRD)
    const jsonLd = await extractJsonLd(page);

    // Priority 2: HTML parsing fallback
    const htmlParsed = await parseHtml(page);

    // Build the raw scraped data - use the final URL (may differ if we followed a search result)
    const rawScrapedJson = {
      jsonLd: jsonLd || undefined,
      htmlParsed,
      scrapedAt: new Date().toISOString(),
      sourceUrl: targetUrl, // Use final URL after any redirects/follows
      originalSearchUrl: searchPageResult.followed ? sourceUrl : undefined,
    };

    // Extract key fields for convenience
    // Handle JSON-LD brand which can be string or object like { "@type": "Brand", "name": "WiiM" }
    const extractBrandName = (brand: unknown): string | null => {
      if (!brand) return null;
      if (typeof brand === 'string') return brand;
      if (typeof brand === 'object' && brand !== null) {
        const brandObj = brand as Record<string, unknown>;
        if (brandObj.name && typeof brandObj.name === 'string') return brandObj.name;
      }
      return null;
    };
    
    // Handle JSON-LD name which can also be an object in some cases
    const extractName = (name: unknown): string | null => {
      if (!name) return null;
      if (typeof name === 'string') return name;
      if (typeof name === 'object' && name !== null) {
        const nameObj = name as Record<string, unknown>;
        if (nameObj.name && typeof nameObj.name === 'string') return nameObj.name;
      }
      return null;
    };
    
    const extractedTitle = extractName(jsonLd?.name) || htmlParsed?.title || null;
    const extractedPrice = parsePrice(jsonLd?.offers?.price || jsonLd?.price || htmlParsed?.price);
    const extractedDescription = htmlParsed?.description || jsonLd?.description || null;
    
    // Try multiple sources for brand
    let extractedBrand = extractBrandName(jsonLd?.brand) || htmlParsed?.brand || null;
    
    // If no brand found, try to extract from title (common pattern: "BrandName ProductModel")
    // Known audio brands to look for
    if (!extractedBrand && extractedTitle) {
      const knownBrands = [
        'WiiM', 'Marantz', 'Denon', 'Yamaha', 'Sony', 'Bose', 'Sonos', 'KEF', 
        'Bowers', 'B&W', 'Klipsch', 'JBL', 'Harman', 'Bang', 'Olufsen', 'NAD',
        'Cambridge', 'Rotel', 'Arcam', 'Naim', 'Focal', 'Dynaudio', 'Dali',
        'Monitor Audio', 'Polk', 'Definitive', 'SVS', 'REL', 'Emotiva', 'Anthem',
        'McIntosh', 'Mark Levinson', 'Audio Research', 'Pass Labs', 'Parasound',
        'Primare', 'Hegel', 'Bluesound', 'Apple', 'Samsung', 'LG', 'Panasonic',
        'Pioneer', 'Onkyo', 'Integra', 'Technics', 'Audio-Technica', 'Sennheiser',
        'Shure', 'Beyerdynamic', 'AKG', 'Grado', 'Audeze', 'HiFiMan', 'Astell',
        'FiiO', 'iFi', 'Topping', 'SMSL', 'Schiit', 'Pro-Ject', 'Rega', 'Thorens'
      ];
      
      const titleLower = extractedTitle.toLowerCase();
      for (const brand of knownBrands) {
        if (titleLower.startsWith(brand.toLowerCase() + ' ') || 
            titleLower.includes(' ' + brand.toLowerCase() + ' ')) {
          extractedBrand = brand;
          break;
        }
      }
    }
    
    // Also try to extract model from title by removing brand
    let extractedModel = extractedTitle;
    if (extractedBrand && extractedTitle) {
      // Remove brand from beginning of title to get model
      const brandPattern = new RegExp(`^${extractedBrand}\\s+`, 'i');
      extractedModel = extractedTitle.replace(brandPattern, '').trim() || extractedTitle;
    }

    // If we have a productRecord, update it in the database
    if (productRecord?.id) {
      const supabase = createServerClient();
      const { error: updateError } = await supabase
        .from('product_onboarding')
        .update({
          raw_scraped_json: rawScrapedJson,
          title: extractedTitle,
          rrp_aud: extractedPrice,
          status: 'reviewed',
        })
        .eq('id', productRecord.id);

      if (updateError) {
        console.error('Failed to save scraped data:', updateError.message);
      }
    }

    await browser.close();

    // Return scraped data (works for both direct URL and productId modes)
    return NextResponse.json({
      success: true,
      jsonLd: jsonLd || null,
      htmlParsed,
      // Include the actual URL that was scraped (important when following search results)
      scrapedUrl: targetUrl,
      originalUrl: sourceUrl,
      followedSearchResult: searchPageResult.followed,
      extracted: {
        title: extractedTitle,
        model: extractedModel,
        brand: extractedBrand,
        price: extractedPrice,
        description: extractedDescription,
        hasJsonLd: !!jsonLd,
        imageCount: htmlParsed?.images?.length || 0,
        specCount: Object.keys(htmlParsed?.specifications || {}).length,
      },
      debug: {
        tabClicked,
        urlUsed: targetUrl,
        followedSearchResult: searchPageResult.followed,
        originalUrl: sourceUrl,
        ...debugInfo,
        specsExtracted: Object.keys(htmlParsed?.specifications || {}).slice(0, 20),
        specValues: Object.entries(htmlParsed?.specifications || {}).slice(0, 10).map(([k, v]) => `${k}: ${v.substring(0, 50)}`),
      },
    });

  } catch (error) {
    console.error('Scrape error:', error);
    
    if (browser) {
      await browser.close();
    }

    const errorMessage = error instanceof Error ? error.message : 'Scraping failed';

    return NextResponse.json(
      { 
        error: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * Detect if page is a search results page and follow to actual product
 */
async function detectAndFollowSearchResult(
  page: import('playwright').Page, 
  originalUrl: string
): Promise<{ followed: boolean; productUrl?: string }> {
  try {
    // Check if URL looks like a search results page
    const searchPatterns = [
      '/search', '/catalogsearch', '/find', '?q=', '?query=', '?s=',
      '/results', 'search?', 'search/', 'search-results'
    ];
    
    const isSearchUrl = searchPatterns.some(pattern => 
      originalUrl.toLowerCase().includes(pattern)
    );
    
    if (!isSearchUrl) {
      return { followed: false };
    }
    
    console.log('Detected search results page, looking for first product...');
    
    // Common selectors for product links in search results
    const productLinkSelectors = [
      // Generic product grid/list items
      '.product-item a[href*="/product"]',
      '.product-item a.product-link',
      '.product-item-link',
      '.product-card a',
      '.product-tile a',
      '[class*="product-item"] a',
      '[class*="product-card"] a',
      '[class*="ProductCard"] a',
      '[class*="product-tile"] a',
      // Magento/WooCommerce common patterns
      '.products-grid .product-item-info a',
      '.product-item-info a.product-item-link',
      '.woocommerce-loop-product__link',
      // Generic search result links that go to product pages
      '.search-results .product a',
      '.search-result-item a',
      '[data-testid="product-link"]',
      '[data-testid="search-result"] a',
      // Title/heading links (often the product name)
      '.product-item h2 a',
      '.product-item h3 a',
      '.product-name a',
      '.product-title a',
      '[class*="product"] h2 a',
      '[class*="product"] h3 a',
      // Fallback: any link within product containers
      '.products li a',
      '.product-list a',
      '.search-results a[href]:not([href="#"])',
    ];
    
    for (const selector of productLinkSelectors) {
      try {
        const productLink = await page.$(selector);
        if (productLink) {
          const href = await productLink.getAttribute('href');
          const isVisible = await productLink.isVisible();
          
          // Validate it's a real product URL (not another search, not pagination)
          if (href && isVisible && 
              !href.includes('/search') && 
              !href.includes('?q=') &&
              !href.includes('page=') &&
              !href.includes('/cart') &&
              href.length > 10) {
            
            // Make absolute URL if relative
            let productUrl = href;
            if (href.startsWith('/')) {
              const baseUrl = new URL(originalUrl);
              productUrl = `${baseUrl.origin}${href}`;
            }
            
            console.log(`Found product link: ${productUrl}`);
            
            // Navigate to the product page
            await page.goto(productUrl, {
              timeout: 30000,
              waitUntil: 'domcontentloaded',
            });
            
            return { followed: true, productUrl };
          }
        }
      } catch {
        // Try next selector
      }
    }
    
    // If no product link found with selectors, try clicking first product image
    try {
      const firstProductImage = await page.$('.product-item img, .product-card img, [class*="product"] img');
      if (firstProductImage) {
        const parent = await firstProductImage.$('xpath=ancestor::a[1]');
        if (parent) {
          const href = await parent.getAttribute('href');
          if (href && !href.includes('/search') && !href.includes('?q=')) {
            let productUrl = href;
            if (href.startsWith('/')) {
              const baseUrl = new URL(originalUrl);
              productUrl = `${baseUrl.origin}${href}`;
            }
            
            await page.goto(productUrl, {
              timeout: 30000,
              waitUntil: 'domcontentloaded',
            });
            
            return { followed: true, productUrl };
          }
        }
      }
    } catch {
      // Ignore
    }
    
    console.log('Could not find product link on search page');
    return { followed: false };
    
  } catch (error) {
    console.error('Error detecting/following search result:', error);
    return { followed: false };
  }
}

/**
 * Click on Specifications tab before extracting specs
 */
async function clickSpecificationsTab(page: import('playwright').Page) {
  try {
    // Common tab selectors for specifications - order matters, most specific first
    const tabSelectors = [
      // Combined "Details & Specifications" patterns (common on brand sites)
      'text=Details & Specifications',
      'text=Details and Specifications',
      'a:has-text("Details & Specifications")',
      'button:has-text("Details & Specifications")',
      // Text-based selectors
      'text=Specifications',
      'text=Specs',
      'text=Technical Specifications',
      'text=Tech Specs',
      'text=Product Specifications',
      // Tab role selectors
      '[role="tab"]:has-text("Specifications")',
      '[role="tab"]:has-text("Specs")',
      '[role="tab"]:has-text("Details")',
      // Button/link selectors
      'button:has-text("Specifications")',
      'a:has-text("Specifications")',
      'button:has-text("Specs")',
      'a:has-text("Specs")',
      // Class-based selectors
      '.tab-specifications',
      '.specs-tab',
      '[data-tab="specifications"]',
      '[data-tab="specs"]',
      '#tab-specifications',
      '#specifications-tab',
      // Navigation items
      'nav a:has-text("Specifications")',
      '.tabs a:has-text("Specifications")',
      '.product-tabs a:has-text("Specifications")',
      // Scroll to/anchor links
      'a[href*="specification"]',
      'a[href*="specs"]',
      'a[href="#specifications"]',
    ];

    for (const selector of tabSelectors) {
      try {
        const tab = await page.$(selector);
        if (tab) {
          const isVisible = await tab.isVisible();
          if (isVisible) {
            await tab.click();
            await page.waitForTimeout(1500); // Wait for tab content to load
            console.log(`Clicked specifications tab: ${selector}`);
            return true;
          }
        }
      } catch {
        // Try next selector
      }
    }

    // Try scrolling to specs section if there's an anchor
    try {
      await page.evaluate(() => {
        const specsSection = document.querySelector('#specifications, #specs, [id*="specification"], [id*="spec"]');
        if (specsSection) {
          specsSection.scrollIntoView({ behavior: 'smooth' });
          return true;
        }
        return false;
      });
      await page.waitForTimeout(500);
    } catch {
      // Ignore
    }

    // Also try using page.click with text matching
    try {
      await page.click('text=/[Ss]pecifications/', { timeout: 2000 });
      await page.waitForTimeout(1000);
      console.log('Clicked specifications tab via text match');
      return true;
    } catch {
      // Ignore
    }

    return false;
  } catch (error) {
    console.log('Could not find specifications tab:', error);
    return false;
  }
}

/**
 * Expand all accordions, collapsible sections, and tabs before scraping
 */
async function expandAccordions(page: import('playwright').Page) {
  try {
    // NOTE: clickSpecificationsTab is now called separately before this function
    
    // Common accordion/expandable selectors
    const accordionTriggers = [
      // Generic accordion patterns
      '[data-accordion-trigger]',
      '[data-toggle="collapse"]',
      '[aria-expanded="false"]',
      'button[aria-controls]',
      '.accordion-trigger',
      '.accordion-header',
      '.accordion-button.collapsed',
      '.collapse-trigger',
      '.expandable-header',
      // Details/summary (HTML5 native accordions)
      'details:not([open]) > summary',
      // Specific brand patterns
      '.product-specs-accordion button',
      '.specifications-accordion button',
      '.spec-accordion-trigger',
      '[class*="accordion"] button',
      '[class*="Accordion"] button',
      '[class*="collapse"] button',
      '[class*="Collapse"] button',
      '[class*="expandable"] button',
      '[class*="Expandable"] button',
      // Tab panels
      '.tab-button:not(.active)',
      '[role="tab"][aria-selected="false"]',
      // "Show more" / "Expand" buttons
      'button:has-text("Expand")',
      'button:has-text("Show")',
      'button:has-text("More")',
      'a:has-text("Expand All")',
      // Marantz specific
      '.pdp-spec-accordion button',
      '.pdp-accordion button',
    ];

    for (const selector of accordionTriggers) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          try {
            // Check if visible and clickable
            const isVisible = await element.isVisible();
            if (isVisible) {
              await element.click({ timeout: 500 });
              await page.waitForTimeout(100); // Small delay between clicks
            }
          } catch {
            // Ignore individual click failures
          }
        }
      } catch {
        // Ignore selector failures
      }
    }

    // Try clicking "Expand All" links/buttons - this is important for sites like Marantz
    const expandAllSelectors = [
      'text=Expand All',
      'text=Expand all',
      'text=Show All',
      'text=Show all',
      'a:has-text("Expand")',
      'button:has-text("Expand All")',
      '[class*="expand-all"]',
      '[class*="expandAll"]',
    ];
    
    for (const selector of expandAllSelectors) {
      try {
        const expandButton = await page.$(selector);
        if (expandButton) {
          const isVisible = await expandButton.isVisible();
          if (isVisible) {
            await expandButton.click();
            await page.waitForTimeout(1000);
            console.log(`Clicked expand all: ${selector}`);
            break;
          }
        }
      } catch {
        // Ignore
      }
    }

    // Open all <details> elements
    await page.evaluate(() => {
      document.querySelectorAll('details:not([open])').forEach(details => {
        details.setAttribute('open', '');
      });
    });

    // Wait for any animations/content to load
    await page.waitForTimeout(500);

  } catch (error) {
    console.log('Accordion expansion had some issues (non-fatal):', error);
  }
}

/**
 * Extract JSON-LD structured data from page
 */
async function extractJsonLd(page: import('playwright').Page) {
  try {
    return await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          
          // Handle @graph format
          if (Array.isArray(data['@graph'])) {
            const product = data['@graph'].find(
              (item: Record<string, unknown>) => item['@type'] === 'Product'
            );
            if (product) return product;
          }
          
          // Direct Product type
          if (data['@type'] === 'Product') {
            return data;
          }
          
          // Array of items
          if (Array.isArray(data)) {
            const product = data.find(
              (item: Record<string, unknown>) => item['@type'] === 'Product'
            );
            if (product) return product;
          }
        } catch {
          continue;
        }
      }
      return null;
    });
  } catch (error) {
    console.error('JSON-LD extraction error:', error);
    return null;
  }
}

/**
 * Parse HTML for product data (fallback)
 */
async function parseHtml(page: import('playwright').Page) {
  return await page.evaluate(() => {
    const getMetaContent = (name: string): string | undefined => {
      const meta = document.querySelector(
        `meta[name="${name}"], meta[property="${name}"], meta[itemprop="${name}"]`
      );
      return meta?.getAttribute('content') || undefined;
    };

    // Title extraction with multiple fallbacks
    const title = 
      document.querySelector('h1')?.textContent?.trim() ||
      getMetaContent('og:title') ||
      getMetaContent('twitter:title') ||
      document.title;

    // Description - extract full product description from multiple sources
    let description: string | undefined;
    
    // Try specific product description selectors first (full content)
    const descriptionSelectors = [
      '.product-description',
      '.product-details',
      '.product-info',
      '[class*="product-description"]',
      '[class*="productDescription"]',
      '[class*="product-details"]',
      '[class*="product-info"]',
      '[data-testid="product-description"]',
      '[itemprop="description"]',
      '#product-description',
      '#productDescription',
      '.description-content',
      '.prod-desc',
      '.pdp-description',
      'article.product',
      '.product-content',
      '[class*="ProductDescription"]',
      '[class*="product_description"]',
    ];
    
    for (const selector of descriptionSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        // Also get text content as fallback
        const text = el.textContent?.trim();
        if (text && text.length > 50) {
          // Store both HTML and text version
          description = text;
          break;
        }
      }
    }
    
    // Fallback to meta description if no detailed description found
    if (!description || description.length < 50) {
      description = 
        getMetaContent('description') ||
        getMetaContent('og:description') ||
        description;
    }
    
    // Try to get HTML description separately for richer content
    let descriptionHtml: string | undefined;
    for (const selector of descriptionSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const html = el.innerHTML?.trim();
        if (html && html.length > 50) {
          descriptionHtml = html;
          break;
        }
      }
    }

    // Price extraction
    let price: string | undefined;
    const priceSelectors = [
      '[class*="price"]:not([class*="was"]):not([class*="old"])',
      '[data-price]',
      '[itemprop="price"]',
      '.product-price',
      '#product-price',
    ];
    
    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || el.getAttribute('data-price') || el.getAttribute('content');
        if (text && /\$?\d+/.test(text)) {
          price = text;
          break;
        }
      }
    }

    // Image extraction - comprehensive selectors for various e-commerce sites
    const images: string[] = [];
    const ogImage = getMetaContent('og:image');
    if (ogImage) images.push(ogImage);

    // Product images from various selectors
    const imageSelectors = [
      '.product-image img',
      '.product-gallery img',
      '.product-images img',
      '.gallery img',
      '.pdp-gallery img',
      '[class*="product-image"] img',
      '[class*="productImage"] img',
      '[class*="ProductImage"] img',
      '[class*="gallery"] img',
      '[class*="slider"] img',
      '[class*="carousel"] img',
      '[data-zoom-image]',
      'img[itemprop="image"]',
      '.slick-slide img',
      '.swiper-slide img',
      '[class*="product"] img',
      'picture source',
      'picture img',
      '[data-srcset]',
      'img[data-src]',
      'img[data-lazy]',
      'img[loading="lazy"]',
    ];

    for (const selector of imageSelectors) {
      document.querySelectorAll(selector).forEach(el => {
        // Handle both img and source elements
        let src = 
          el.getAttribute('data-zoom-image') ||
          el.getAttribute('data-large') ||
          el.getAttribute('data-original') ||
          el.getAttribute('data-src') ||
          el.getAttribute('data-lazy') ||
          el.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
          el.getAttribute('data-srcset')?.split(',')[0]?.trim().split(' ')[0] ||
          el.getAttribute('src');
        
        // Make relative URLs absolute
        if (src && src.startsWith('/')) {
          src = window.location.origin + src;
        }
        
        // Filter out small/placeholder images
        if (src && 
            !images.includes(src) && 
            !src.includes('placeholder') &&
            !src.includes('loading') &&
            !src.includes('spinner') &&
            !src.includes('1x1') &&
            !src.includes('pixel') &&
            src.length > 10) {
          images.push(src);
        }
      });
    }

    // Specifications table extraction - comprehensive selectors
    const specifications: Record<string, string> = {};
    let specificationsHtml = '';
    
    // Helper to check if text looks like a specification value (not marketing copy)
    const looksLikeSpecValue = (value: string): boolean => {
      if (!value || value.length > 300) return false;
      // Spec values are typically short and contain numbers, units, or technical terms
      const hasNumbers = /\d/.test(value);
      const hasUnits = /\b(mm|cm|m|kg|g|lb|oz|W|V|A|Hz|kHz|MHz|GHz|dB|ohm|Ω|ch|channels?|bit|byte|MB|GB|TB)\b/i.test(value);
      const isShort = value.length < 100;
      const hasTechTerms = /\b(yes|no|true|false|included|supported|compatible|hdmi|usb|wifi|bluetooth|ethernet|optical|coaxial|rca|xlr|balanced|unbalanced)\b/i.test(value);
      const looksLikeList = value.includes(',') && value.split(',').length <= 10;
      const isSentence = value.split(' ').length > 15 && !hasNumbers && !hasUnits;
      
      // Reject if it looks like marketing copy (long sentences without technical content)
      if (isSentence && !hasUnits && !hasTechTerms) return false;
      
      return hasNumbers || hasUnits || hasTechTerms || looksLikeList || isShort;
    };
    
    // Helper to check if text looks like a spec label
    const looksLikeSpecLabel = (label: string): boolean => {
      if (!label || label.length > 80 || label.length < 2) return false;
      // Reject common marketing headers
      const marketingTerms = /\b(enjoy|experience|immersive|outstanding|exceptional|premium|elegant|timeless|modern|leader|flexibility|performance|design)\b/i;
      if (marketingTerms.test(label)) return false;
      return true;
    };
    
    const specContainerSelectors = [
      '.specifications',
      '.product-specifications', 
      '.technical-specifications',
      '.tech-specs',
      '.product-specs',
      '[class*="specification"]',
      '[class*="Specification"]',
      '#specifications',
      '#product-specifications',
      '.features',
      '.product-features',
      '[class*="tech-spec"]',
      '[class*="techSpec"]',
      // Accordion style specs
      '[class*="pdp-spec"]',
      '[class*="accordion"]',
      '[class*="Accordion"]',
      '.details-specifications',
    ];
    
    // Try to capture entire specifications section as HTML
    for (const selector of specContainerSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        const html = container.innerHTML?.trim();
        if (html && html.length > 100) {
          specificationsHtml = html;
          break;
        }
      }
    }
    
    const specRowSelectors = [
      'table.specifications tr',
      '.specs tr',
      '.product-specs tr',
      '.technical-specs tr',
      '[class*="specification"] tr',
      '[class*="Specification"] tr',
      '[class*="tech-spec"] tr',
      '.features-table tr',
      '[class*="product-features"] tr',
      '[class*="details-table"] tr',
      'table.product-attributes tr',
      'dl.specifications dt',
      '.spec-list li',
      '[class*="spec-row"]',
      '[class*="spec-item"]',
      // Accordion-style specs (label + value pairs)
      '[class*="accordion"] [class*="label"]',
      '[class*="accordion"] [class*="title"]',
      '[class*="pdp-spec"] [class*="row"]',
      '[class*="pdp-spec"] li',
      // Definition lists anywhere
      'dl dt',
      // Generic rows with two children
      '[class*="feature"] [class*="row"]',
      'table tr',
    ];

    for (const selector of specRowSelectors) {
      // Handle table rows
      if (selector.includes('tr')) {
        document.querySelectorAll(selector).forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const key = cells[0].textContent?.trim();
            const value = cells[1].textContent?.trim();
            if (key && value && key !== value && looksLikeSpecLabel(key) && looksLikeSpecValue(value)) {
              specifications[key] = value;
            }
          }
        });
      }
      // Handle definition lists
      else if (selector.includes('dt')) {
        document.querySelectorAll(selector).forEach(dt => {
          const key = dt.textContent?.trim();
          const dd = dt.nextElementSibling;
          const value = dd?.textContent?.trim();
          if (key && value && key !== value && looksLikeSpecLabel(key) && looksLikeSpecValue(value)) {
            specifications[key] = value;
          }
        });
      }
      // Handle accordion label/value pairs
      else if (selector.includes('label') || selector.includes('title')) {
        document.querySelectorAll(selector).forEach(labelEl => {
          const key = labelEl.textContent?.trim();
          // Try to find sibling or parent value element
          const valueEl = labelEl.nextElementSibling || 
                          labelEl.parentElement?.querySelector('[class*="value"]') ||
                          labelEl.parentElement?.querySelector('[class*="data"]');
          const value = valueEl?.textContent?.trim();
          if (key && value && key !== value && looksLikeSpecLabel(key) && looksLikeSpecValue(value)) {
            specifications[key] = value;
          }
        });
      }
      // Handle list items with key:value format
      else if (selector.includes('li') || selector.includes('row') || selector.includes('item')) {
        document.querySelectorAll(selector).forEach(item => {
          const text = item.textContent?.trim();
          if (text && text.includes(':')) {
            const [key, ...valueParts] = text.split(':');
            const value = valueParts.join(':').trim();
            if (key && value && key.trim() !== value.trim() && looksLikeSpecLabel(key.trim()) && looksLikeSpecValue(value)) {
              specifications[key.trim()] = value;
            }
          }
        });
      }
      if (Object.keys(specifications).length > 15) break;
    }
    
    // Additional extraction: Look for any elements with key-value structure
    // This catches accordion-style specs that might not match standard patterns
    if (Object.keys(specifications).length < 5) {
      // Try finding accordion sections with titles and content - but ONLY if content looks like specs
      document.querySelectorAll('[class*="accordion"], [class*="Accordion"], details, [class*="collapse"], [class*="Collapse"]').forEach(section => {
        const title = section.querySelector('summary, button, [class*="title"], [class*="header"], h3, h4')?.textContent?.trim();
        if (title && looksLikeSpecLabel(title) && !title.toLowerCase().includes('more') && !title.toLowerCase().includes('expand')) {
          // Get content from the expanded section
          const content = section.querySelector('[class*="content"], [class*="body"], [class*="panel"], .collapse, dd, p');
          const value = content?.textContent?.trim();
          if (value && looksLikeSpecValue(value) && title !== value) {
            specifications[title] = value;
          }
        }
      });
      
      // Also try to find any visible label/value pairs
      document.querySelectorAll('[class*="spec"], [class*="Spec"], [class*="detail"], [class*="Detail"]').forEach(container => {
        // Look for child elements that might be key-value pairs
        const children = container.children;
        if (children.length === 2) {
          const key = children[0].textContent?.trim();
          const value = children[1].textContent?.trim();
          if (key && value && key !== value && looksLikeSpecLabel(key) && looksLikeSpecValue(value)) {
            specifications[key] = value;
          }
        }
      });
    }
    
    // Marantz/Brand-specific extraction: Look for list items with bold labels
    // Format: <li><strong>Label</strong> Value</li> or <li><span>Label</span> Value</li>
    if (Object.keys(specifications).length < 10) {
      document.querySelectorAll('li, [class*="spec-item"], [class*="spec-row"]').forEach(item => {
        // Look for a label element (strong, b, span with class)
        const labelEl = item.querySelector('strong, b, [class*="label"], [class*="name"], [class*="title"]');
        if (labelEl) {
          const label = labelEl.textContent?.trim();
          // Get the rest of the text as value
          const fullText = item.textContent?.trim() || '';
          const value = fullText.replace(label || '', '').trim();
          
          if (label && value && label !== value && label.length < 80 && value.length < 500) {
            // Clean up the label (remove trailing colons, etc.)
            const cleanLabel = label.replace(/[:\-]$/, '').trim();
            if (cleanLabel) {
              specifications[cleanLabel] = value;
            }
          }
        }
      });
    }
    
    // Extract from unordered/ordered lists within spec sections
    document.querySelectorAll('[class*="specifications"] ul, [class*="spec"] ul, [id*="spec"] ul').forEach(list => {
      list.querySelectorAll('li').forEach(item => {
        const text = item.textContent?.trim() || '';
        // Check if it has a label:value or label - value pattern
        const colonMatch = text.match(/^([^:]+):\s*(.+)$/);
        const dashMatch = text.match(/^([^-]+)\s+-\s+(.+)$/);
        
        if (colonMatch) {
          const [, label, value] = colonMatch;
          if (label && value && label.trim().length < 80) {
            specifications[label.trim()] = value.trim();
          }
        } else if (dashMatch) {
          const [, label, value] = dashMatch;
          if (label && value && label.trim().length < 80) {
            specifications[label.trim()] = value.trim();
          }
        }
      });
    });
    
    // Generate clean specifications HTML table if we have specs
    if (Object.keys(specifications).length > 0 && !specificationsHtml) {
      specificationsHtml = '<table class="specifications-table"><tbody>' +
        Object.entries(specifications)
          .map(([key, value]) => `<tr><th>${key}</th><td>${value}</td></tr>`)
          .join('') +
        '</tbody></table>';
    }

    // SKU/Model number
    const sku = 
      getMetaContent('product:retailer_item_id') ||
      document.querySelector('[itemprop="sku"]')?.textContent?.trim() ||
      document.querySelector('[class*="sku"], [class*="model"]')?.textContent?.trim();

    // Brand
    const brand = 
      getMetaContent('product:brand') ||
      document.querySelector('[itemprop="brand"]')?.textContent?.trim();

    return {
      title,
      description,
      descriptionHtml,
      price,
      images: images.slice(0, 10), // Limit to 10 images
      specifications,
      specificationsHtml,
      sku,
      brand,
    };
  });
}

/**
 * Parse price string to number
 */
function parsePrice(priceStr: string | undefined | null): number | null {
  if (!priceStr) return null;
  
  const cleaned = String(priceStr)
    .replace(/[AUD$,\s]/gi, '')
    .replace(/\.00$/, '');
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

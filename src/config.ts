/**
 * Application Configuration
 * 
 * Centralized configuration for all application settings.
 * Values can be overridden via environment variables.
 */

// ============================================
// AI Configuration
// ============================================

export const aiConfig = {
  /** Claude model for content generation */
  model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  /** Maximum tokens for AI responses */
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096'),
  /** Temperature for AI responses (0-1) */
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  /** Timeout for AI requests in ms */
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000'),
};

// ============================================
// Scraping Configuration
// ============================================

export const scrapingConfig = {
  /** Request timeout in ms */
  timeoutMs: parseInt(process.env.SCRAPE_TIMEOUT_MS || '30000'),
  /** User agent for requests */
  userAgent: process.env.SCRAPE_USER_AGENT || 
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Proxy Configuration (Per PRD: "Use AU residential proxies")
  proxy: {
    /** Enable proxy for scraping */
    enabled: process.env.PROXY_ENABLED === 'true',
    /** Proxy server URL (e.g., http://user:pass@proxy.example.com:8080) */
    url: process.env.PROXY_URL || '',
    /** Proxy type */
    type: (process.env.PROXY_TYPE || 'http') as 'http' | 'socks5',
    /** Rotate proxies (if using a proxy pool service) */
    rotate: process.env.PROXY_ROTATE === 'true',
    /** Australian proxy preference */
    preferAU: process.env.PROXY_PREFER_AU !== 'false', // default true
  },
  
  /** Retry configuration */
  retry: {
    maxAttempts: parseInt(process.env.SCRAPE_RETRY_MAX || '3'),
    delayMs: parseInt(process.env.SCRAPE_RETRY_DELAY_MS || '1000'),
    backoffMultiplier: parseFloat(process.env.SCRAPE_RETRY_BACKOFF || '2'),
  },
  
  /** Domains to prioritize (Australian retailers) */
  priorityDomains: [
    '.com.au',
    '.au',
  ],
};

// ============================================
// Image Processing Configuration
// ============================================

export const imagesConfig = {
  /** Supabase Storage bucket name */
  bucket: process.env.STORAGE_BUCKET || 'product-images',
  /** WebP quality (0-100) */
  quality: parseInt(process.env.IMAGE_QUALITY || '85'),
  /** Maximum image width */
  maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '1200'),
  /** Maximum image height */
  maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '1200'),
  /** Maximum images per product */
  maxImagesPerProduct: parseInt(process.env.MAX_IMAGES_PER_PRODUCT || '10'),
};

// ============================================
// API Rate Limiting Configuration
// ============================================

export const rateLimitConfig = {
  /** Default rate limit (requests per minute) */
  defaultRpm: parseInt(process.env.RATE_LIMIT_RPM || '60'),
  
  /** Per-service rate limits */
  services: {
    anthropic: parseInt(process.env.RATE_LIMIT_ANTHROPIC_RPM || '50'),
    serpapi: parseInt(process.env.RATE_LIMIT_SERPAPI_RPM || '100'),
    shopify: parseInt(process.env.RATE_LIMIT_SHOPIFY_RPM || '40'),
    hubspot: parseInt(process.env.RATE_LIMIT_HUBSPOT_RPM || '100'),
    notion: parseInt(process.env.RATE_LIMIT_NOTION_RPM || '30'),
  },
};

// ============================================
// Pricing Configuration (Australian Standards)
// ============================================

export const pricingConfig = {
  /** GST rate (10% in Australia) */
  gstRate: 0.10,
  /** Default discount percentage for ex-demo */
  defaultExDemoDiscount: parseInt(process.env.DEFAULT_EX_DEMO_DISCOUNT || '20'),
  /** Default discount percentage for trade-in */
  defaultTradeInDiscount: parseInt(process.env.DEFAULT_TRADE_IN_DISCOUNT || '30'),
  /** Minimum margin percentage (safety threshold) */
  minimumMarginPercent: parseInt(process.env.MIN_MARGIN_PERCENT || '20'),
  /** Currency */
  currency: 'AUD',
  /** Locale for formatting */
  locale: 'en-AU',
};

// ============================================
// Shopify Configuration
// ============================================

export const shopifyConfig = {
  /** Token cache duration in ms */
  tokenCacheMs: parseInt(process.env.SHOPIFY_TOKEN_CACHE_MS || '60000'),
  /** API version */
  apiVersion: process.env.SHOPIFY_API_VERSION || 'January25',
  /** Default product status */
  defaultStatus: 'DRAFT' as const,
};

// ============================================
// Pagination Configuration
// ============================================

export const paginationConfig = {
  /** Default page size */
  defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT || '50'),
  /** Maximum page size */
  maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT || '100'),
};

// ============================================
// Search Configuration
// ============================================

export const searchConfig = {
  /** SerpAPI parameters for Australian results */
  serpapi: {
    gl: 'au', // Country
    hl: 'en', // Language
    google_domain: 'google.com.au',
  },
  /** Site filter for Australian domains */
  siteFilter: 'site:.com.au',
  /** Maximum search results */
  maxResults: parseInt(process.env.SEARCH_MAX_RESULTS || '10'),
};

// ============================================
// Feature Flags
// ============================================

export const features = {
  /** Enable CSRF protection */
  csrfProtection: process.env.CSRF_PROTECTION === 'true',
  /** Enable audit logging */
  auditLogging: process.env.AUDIT_LOGGING !== 'false', // default true
  /** Enable realtime updates */
  realtimeUpdates: process.env.REALTIME_UPDATES !== 'false', // default true
  /** Enable proxy for scraping */
  proxyEnabled: process.env.PROXY_ENABLED === 'true',
};

// ============================================
// Export Combined Config
// ============================================

export const config = {
  ai: aiConfig,
  scraping: scrapingConfig,
  images: imagesConfig,
  rateLimit: rateLimitConfig,
  pricing: pricingConfig,
  shopify: shopifyConfig,
  pagination: paginationConfig,
  search: searchConfig,
  features,
};

export default config;

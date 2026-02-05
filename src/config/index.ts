/**
 * Application Configuration
 * 
 * Centralizes all configurable values that were previously hardcoded.
 * Values can be overridden via environment variables.
 */

export const config = {
  // AI Configuration
  ai: {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    visionModel: process.env.ANTHROPIC_VISION_MODEL || 'claude-sonnet-4-20250514',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  },

  // Image Processing
  images: {
    bucket: process.env.IMAGE_BUCKET || 'product-images',
    maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '2000', 10),
    maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '2000', 10),
    quality: parseInt(process.env.IMAGE_QUALITY || '80', 10),
    maxPerProduct: parseInt(process.env.MAX_IMAGES_PER_PRODUCT || '10', 10),
    allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },

  // Scraping Configuration
  scraping: {
    timeout: parseInt(process.env.SCRAPE_TIMEOUT || '30000', 10),
    waitTime: parseInt(process.env.SCRAPE_WAIT_TIME || '2000', 10),
    retries: parseInt(process.env.SCRAPE_RETRIES || '2', 10),
    userAgent: process.env.SCRAPE_USER_AGENT || 
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },

  // Pricing Configuration
  pricing: {
    currency: 'AUD',
    minPrice: parseInt(process.env.MIN_PRICE || '50', 10),
    maxPrice: parseInt(process.env.MAX_PRICE || '100000', 10),
    minMarginMultiplier: parseFloat(process.env.MIN_MARGIN_MULTIPLIER || '1.2'),
    defaultDiscountPercent: parseInt(process.env.DEFAULT_DISCOUNT || '20', 10),
  },

  // Pagination Defaults
  pagination: {
    defaultLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || '50', 10),
    maxLimit: parseInt(process.env.MAX_PAGE_LIMIT || '100', 10),
  },

  // Shopify Configuration
  shopify: {
    apiVersion: process.env.SHOPIFY_API_VERSION || '2025-01',
    metafieldNamespace: process.env.SHOPIFY_METAFIELD_NS || 'product_scout',
    defaultStatus: 'DRAFT' as const, // Per PRD: always create as DRAFT
  },

  // HubSpot Configuration
  hubspot: {
    defaultPipeline: process.env.HUBSPOT_PIPELINE_ID || 'default',
    defaultStage: process.env.HUBSPOT_INTAKE_STAGE_ID || 'appointmentscheduled',
  },

  // SEO Constraints (per PRD)
  seo: {
    maxTitleLength: 60,
    minMetaDescriptionLength: 150,
    maxMetaDescriptionLength: 155,
    minDescriptionWords: 300,
  },

  // Cache TTL (in milliseconds)
  cache: {
    oauthToken: parseInt(process.env.OAUTH_TOKEN_CACHE_TTL || '60000', 10),
    rrpSearch: parseInt(process.env.RRP_CACHE_TTL || '3600000', 10), // 1 hour
  },

  // Demo Tracking Alerts
  demo: {
    warningMonths: parseInt(process.env.DEMO_WARNING_MONTHS || '12', 10),
    criticalMonths: parseInt(process.env.DEMO_CRITICAL_MONTHS || '24', 10),
  },

  // Australian Retailer Domains (for RRP search)
  retailers: {
    priority: [
      'jbhifi.com.au',
      'harveynorman.com.au',
      'thegoodguys.com.au',
      'officeworks.com.au',
      'bing-lee.com.au',
      'appliance-online.com.au',
    ],
    excluded: [
      'ebay.com.au',
      'amazon.com.au',
      'gumtree.com.au',
      'facebook.com',
      'reddit.com',
    ],
  },
} as const;

// Type exports for use in other files
export type Config = typeof config;
export type AIConfig = typeof config.ai;
export type ImageConfig = typeof config.images;
export type ScrapingConfig = typeof config.scraping;
export type PricingConfig = typeof config.pricing;

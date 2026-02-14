import type { RmaStatus } from '@/types';

function getString(value: string | undefined, fallback = ''): string {
  return (value ?? fallback).trim();
}

function getNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

type RmaStageMap = Record<RmaStatus, string>;

const rmaStages: RmaStageMap = {
  received: getString(process.env.HUBSPOT_RMA_STAGE_RECEIVED),
  testing: getString(process.env.HUBSPOT_RMA_STAGE_TESTING),
  sent_to_manufacturer: getString(process.env.HUBSPOT_RMA_STAGE_SENT_TO_MANUFACTURER),
  repaired_replaced: getString(process.env.HUBSPOT_RMA_STAGE_REPAIRED_REPLACED),
  back_to_customer: getString(process.env.HUBSPOT_RMA_STAGE_BACK_TO_CUSTOMER),
};

export const config = {
  ai: {
    model: getString(process.env.ANTHROPIC_MODEL, 'claude-3-5-sonnet-20241022'),
    visionModel: getString(process.env.ANTHROPIC_VISION_MODEL, 'claude-3-5-sonnet-20241022'),
    maxTokens: getNumber(process.env.ANTHROPIC_MAX_TOKENS, 4096),
  },
  shopify: {
    apiVersion: getString(process.env.SHOPIFY_API_VERSION, '2025-01'),
    metafieldNamespace: getString(process.env.SHOPIFY_METAFIELD_NAMESPACE, 'cht'),
  },
  images: {
    bucket: getString(process.env.SUPABASE_STORAGE_BUCKET, 'product-images'),
    quality: getNumber(process.env.IMAGE_WEBP_QUALITY, 82),
    maxWidth: getNumber(process.env.IMAGE_MAX_WIDTH, 2048),
    maxHeight: getNumber(process.env.IMAGE_MAX_HEIGHT, 2048),
  },
  hubspot: {
    portalId: getString(process.env.HUBSPOT_PORTAL_ID),
    rmaPipelineId: getString(process.env.HUBSPOT_RMA_PIPELINE_ID),
    rmaStages,
  },
  klaviyo: {
    apiKey: getString(process.env.KLAVIYO_PRIVATE_API_KEY),
    revision: getString(process.env.KLAVIYO_API_REVISION, '2024-10-15'),
    defaultFromEmail: getString(process.env.KLAVIYO_DEFAULT_FROM_EMAIL),
    defaultFromLabel: getString(process.env.KLAVIYO_DEFAULT_FROM_LABEL),
    defaultReplyToEmail: getString(process.env.KLAVIYO_DEFAULT_REPLY_TO_EMAIL),
    productBaseUrl: getString(process.env.KLAVIYO_PRODUCT_BASE_URL),
  },
} as const;

export const scrapingConfig = {
  timeoutMs: getNumber(process.env.SCRAPING_TIMEOUT_MS, 30000),
  userAgent: getString(
    process.env.SCRAPING_USER_AGENT,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  ),
  retry: {
    maxAttempts: getNumber(process.env.SCRAPING_RETRY_MAX_ATTEMPTS, 3),
    delayMs: getNumber(process.env.SCRAPING_RETRY_DELAY_MS, 1000),
    backoffMultiplier: getNumber(process.env.SCRAPING_RETRY_BACKOFF_MULTIPLIER, 2),
  },
  proxy: {
    enabled: getBoolean(process.env.SCRAPING_PROXY_ENABLED, false),
    url: getString(process.env.SCRAPING_PROXY_URL),
  },
} as const;

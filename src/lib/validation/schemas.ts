import { z } from 'zod';

/**
 * API Request Validation Schemas
 * 
 * Centralized Zod schemas for validating all API request bodies
 */

// ============================================
// Common Schemas
// ============================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const urlSchema = z.string().url('Invalid URL format').max(2048, 'URL too long');

export const priceSchema = z.number()
  .min(0, 'Price must be non-negative')
  .max(1000000, 'Price exceeds maximum');

export const percentageSchema = z.number()
  .min(0, 'Percentage must be non-negative')
  .max(100, 'Percentage cannot exceed 100');

// ============================================
// Product Schemas
// ============================================

export const createProductSchema = z.object({
  brand: z.string().min(1, 'Brand is required').max(255),
  modelNumber: z.string().min(1, 'Model number is required').max(255),
  sourceUrl: urlSchema.optional(),
});

export const updateProductSchema = z.object({
  title: z.string().max(255).optional(),
  descriptionHtml: z.string().max(50000).optional(),
  rrpAud: priceSchema.optional(),
  costPrice: priceSchema.optional(),
  salesPrice: priceSchema.optional(),
  status: z.enum(['pending', 'processing', 'reviewed', 'synced', 'error']).optional(),
}).partial();

// ============================================
// Inventory Schemas
// ============================================

export const listingTypeSchema = z.enum(['new', 'trade_in', 'ex_demo']);
export const conditionGradeSchema = z.enum(['mint', 'excellent', 'good', 'fair', 'poor']);
export const syncStatusSchema = z.enum(['pending', 'syncing', 'synced', 'error']);
export const listingStatusSchema = z.enum(['on_demo', 'ready_to_sell', 'sold']);
export const serialCaptureStatusSchema = z.enum(['captured', 'not_found', 'skipped']);

export const createInventoryItemSchema = z.object({
  listing_type: listingTypeSchema,
  brand: z.string().min(1, 'Brand is required').max(255),
  model: z.string().min(1, 'Model is required').max(255),
  serial_number: z.string().max(255).optional().nullable(),
  serial_capture_status: serialCaptureStatusSchema.optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  rrp_aud: priceSchema.optional().nullable(),
  cost_price: priceSchema.optional().nullable(),
  sale_price: priceSchema,
  condition_grade: conditionGradeSchema.optional().nullable(),
  condition_report: z.string().max(5000).optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  description_html: z.string().max(50000).optional().nullable(),
  meta_description: z.string().max(160).optional().nullable(),
  specifications: z.record(z.string(), z.unknown()).optional().nullable(),
  source_url: urlSchema.optional().nullable(),
  rrp_source: z.string().max(255).optional().nullable(),
  image_urls: z.array(z.string()).optional(),
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export const inventoryFiltersSchema = z.object({
  listing_type: listingTypeSchema.optional(),
  listing_status: listingStatusSchema.optional(),
  sync_status: syncStatusSchema.optional(),
  condition_grade: conditionGradeSchema.optional(),
  search: z.string().max(500).optional(),
  brand: z.string().max(255).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().max(1000000).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'sale_price', 'brand', 'model']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  includeArchived: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

// ============================================
// Bulk Operations Schemas
// ============================================

export const bulkSyncSchema = z.object({
  action: z.literal('sync'),
  itemIds: z.array(uuidSchema).min(1, 'At least one item required').max(50, 'Maximum 50 items'),
});

export const bulkPriceUpdateSchema = z.object({
  action: z.literal('update_prices'),
  itemIds: z.array(uuidSchema).min(1).max(50),
  discountPercent: percentageSchema.optional(),
  fixedPrice: priceSchema.optional(),
}).refine(
  (data) => data.discountPercent !== undefined || data.fixedPrice !== undefined,
  { message: 'Either discountPercent or fixedPrice is required' }
);

export const bulkArchiveSchema = z.object({
  action: z.enum(['archive', 'unarchive']),
  itemIds: z.array(uuidSchema).min(1).max(50),
});

export const bulkStatusUpdateSchema = z.object({
  action: z.literal('update_status'),
  itemIds: z.array(uuidSchema).min(1).max(50),
  listingStatus: listingStatusSchema,
});

export const bulkOperationSchema = z.discriminatedUnion('action', [
  bulkSyncSchema,
  bulkPriceUpdateSchema,
  bulkArchiveSchema,
  bulkStatusUpdateSchema,
]);

// ============================================
// Search & Scrape Schemas
// ============================================

export const searchQuerySchema = z.object({
  query: z.string()
    .min(2, 'Search query too short')
    .max(500, 'Search query too long')
    .transform((val) => val.trim()),
});

export const scrapeRequestSchema = z.object({
  url: urlSchema.refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'URL must use http or https protocol' }
  ),
  productId: uuidSchema.optional(),
});

// ============================================
// Image Processing Schemas
// ============================================

export const processImagesSchema = z.object({
  productId: uuidSchema,
});

export const uploadImagesSchema = z.object({
  productId: uuidSchema.optional(),
  brand: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
});

// ============================================
// Shopify Schemas
// ============================================

export const shopifyPushSchema = z.object({
  productId: uuidSchema,
});

// ============================================
// AI Generation Schemas
// ============================================

export const generateContentSchema = z.object({
  productId: uuidSchema,
  regenerate: z.boolean().optional(),
});

// ============================================
// Specification Lookup Schemas
// ============================================

export const specificationLookupSchema = z.object({
  brand: z.string().min(1).max(255),
  model: z.string().min(1).max(255),
});

// ============================================
// RRP Lookup Schemas
// ============================================

export const rrpLookupSchema = z.object({
  brand: z.string().min(1).max(255),
  model: z.string().min(1).max(255),
});

// ============================================
// Vision AI Schemas
// ============================================

export const visionIdentifySchema = z.object({
  imageBase64: z.string().min(100, 'Invalid image data'),
});

// ============================================
// Klaviyo Schemas (Phase 2 - Email Studio)
// ============================================

export const klaviyoExportStyleSchema = z.object({
  templateIds: z.array(z.string().min(1)).max(20).optional(),
  campaignMessageIds: z
    .array(
      z.object({
        campaignId: z.string().min(1),
        messageId: z.string().min(1),
      })
    )
    .max(20)
    .optional(),
  saveToDb: z.boolean().optional().default(true),
}).refine(
  (data) => (data.templateIds?.length ?? 0) + (data.campaignMessageIds?.length ?? 0) >= 1,
  { message: 'At least one templateId or campaignMessageId entry is required' }
);

export const klaviyoGenerateSchema = z
  .object({
    inventoryIds: z.array(uuidSchema).max(50).optional(),
    filter: z
      .object({
        listingTypes: z.array(listingTypeSchema).max(5).optional(),
        limit: z.coerce.number().min(1).max(50).optional(),
      })
      .optional(),
    styleGuideIds: z.array(uuidSchema).min(1, 'At least one style guide required').max(10),
    intent: z.string().min(1, 'Intent is required').max(200),
  })
  .refine(
    (data) => data.inventoryIds === undefined || data.inventoryIds.length >= 1,
    { message: 'inventoryIds must not be empty when provided' }
  );

export const klaviyoPushSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  preheader: z.string().max(500).optional().nullable(),
  htmlBody: z.string().min(1, 'HTML body is required').max(500000),
  plainText: z.string().max(100000).optional().nullable(),
  campaignName: z.string().max(255).optional().nullable(),
  createCampaign: z.boolean().optional().default(false),
});

// ============================================
// Audit Log Schemas
// ============================================

export const auditLogFiltersSchema = z.object({
  entity_type: z.string().optional(),
  entity_id: uuidSchema.optional(),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

// ============================================
// Helper Functions
// ============================================

/**
 * Validate request body with schema
 * Returns parsed data or throws formatted error
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  
  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new ValidationError(errors.join('; '), result.error.issues);
  }
  
  return result.data;
}

/**
 * Validate query params with schema
 */
export function validateParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): T {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  return validateBody(schema, params);
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  public readonly errors: z.ZodIssue[];
  
  constructor(message: string, errors: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

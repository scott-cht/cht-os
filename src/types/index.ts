/**
 * Central type exports
 */

export * from './database';
export * from './inventory';
export * from './filters';

// Search result from discovery phase
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  isAustralian: boolean;
}

// AI-generated content
export interface AIGeneratedContent {
  title: string;           // < 60 characters
  metaDescription: string; // 150-155 characters
  descriptionHtml: string; // Unique content with bullet points
  altTexts: string[];      // SEO-optimized alt texts for images
}

// Retail pricing calculation
export interface PricingCalculation {
  rrpAud: number;
  discountPercent: number;
  salesPrice: number;      // Whole AUD, no cents
  costPrice: number;
  marginPercent: number;
  isBelowSafetyThreshold: boolean; // true if salesPrice < costPrice * 1.2
}

// Image processing result
export interface ProcessedImage {
  originalUrl: string;
  storagePath: string;     // Supabase Storage path
  publicUrl: string;
  filename: string;        // SEO-friendly: brand-model-category-index.webp
  altText: string;
  width: number;
  height: number;
}

// Shopify product draft
export interface ShopifyDraftProduct {
  title: string;
  descriptionHtml: string;
  vendor: string;          // Brand name
  productType: string;
  status: 'DRAFT';         // Always DRAFT per PRD
  metafields: {
    namespace: string;
    key: string;
    value: string;
    type: string;
  }[];
  images: {
    src: string;
    altText: string;
  }[];
  variants: {
    price: string;
    sku: string;
  }[];
}

// Realtime status updates
export interface StatusUpdate {
  productId: string;
  phase: 'discovery' | 'extraction' | 'ai_processing' | 'media' | 'shopify_push';
  status: 'started' | 'in_progress' | 'completed' | 'error';
  message: string;
  timestamp: string;
}

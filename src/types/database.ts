/**
 * Database types generated from schema.sql
 * Shopify Product Scout & Onboarder
 */

export type ProductStatus = 'pending' | 'processing' | 'reviewed' | 'synced' | 'error';

// Specification types for categorized specs
export interface SpecificationItem {
  key: string;
  value: string;
  unit?: string;
}

export interface SpecificationCategory {
  name: string;
  icon?: string;
  items: SpecificationItem[];
}

export interface CategorizedSpecifications {
  categories: SpecificationCategory[];
  uncategorized?: SpecificationItem[];
}

export interface ProductOnboarding {
  id: string;
  created_at: string;
  brand: string;
  model_number: string;
  source_url: string | null;
  
  // Raw data storage (Source of Truth)
  raw_scraped_json: RawScrapedData | null;
  
  // Processed data (For review before Shopify push)
  title: string | null;
  description_html: string | null;
  rrp_aud: number | null;
  cost_price: number | null;
  sales_price: number | null;
  
  // Meta for tracking
  status: ProductStatus;
  shopify_product_id: string | null;
  error_log: string | null;
}

export interface RawScrapedData {
  // JSON-LD extracted data
  jsonLd?: {
    name?: string;
    sku?: string;
    brand?: string;
    description?: string;
    price?: string;
    priceCurrency?: string;
    image?: string | string[];
    offers?: {
      price?: string;
      priceCurrency?: string;
      availability?: string;
    };
  };
  
  // HTML parsed data
  htmlParsed?: {
    title?: string;
    description?: string;
    descriptionHtml?: string;
    price?: string;
    specifications?: Record<string, string>;
    specificationsHtml?: string;
    images?: string[];
    sku?: string;
    brand?: string;
  };
  
  // Categorized specifications (AI processed)
  categorizedSpecs?: CategorizedSpecifications;
  
  // AI Generated content
  aiGenerated?: {
    title: string;
    metaDescription: string;
    descriptionHtml: string;
    altTexts: string[];
    generatedAt: string;
  };
  
  // Processed images (uploaded to Supabase Storage)
  processedImages?: {
    originalUrl: string;
    storagePath: string;
    publicUrl: string;
    filename: string;
    altText: string;
    width: number;
    height: number;
  }[];
  
  // Metadata
  scrapedAt: string;
  sourceUrl: string;
}

export interface ProductOnboardingInsert {
  brand: string;
  model_number: string;
  source_url?: string;
  raw_scraped_json?: RawScrapedData;
  title?: string;
  description_html?: string;
  rrp_aud?: number;
  cost_price?: number;
  sales_price?: number;
  status?: ProductStatus;
}

export interface ProductOnboardingUpdate {
  source_url?: string;
  raw_scraped_json?: RawScrapedData;
  title?: string;
  description_html?: string;
  rrp_aud?: number;
  cost_price?: number;
  sales_price?: number;
  status?: ProductStatus;
  shopify_product_id?: string;
  error_log?: string;
}

// Supabase Database type definition
export interface Database {
  public: {
    Tables: {
      product_onboarding: {
        Row: ProductOnboarding;
        Insert: ProductOnboardingInsert;
        Update: ProductOnboardingUpdate;
      };
    };
  };
}

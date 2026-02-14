/**
 * Shopify Product Import & Enrichment Types
 * 
 * Types for managing imported Shopify products, snapshots, and enrichment workflow.
 */

// ============================================
// Enums
// ============================================

export type ShopifyProductStatus = 'active' | 'draft' | 'archived';
export type EnrichmentStatus = 'pending' | 'enriched' | 'synced';
export type SnapshotType = 'original' | 'before_sync' | 'manual';

// ============================================
// Shopify API Response Types
// ============================================

export interface ShopifyImage {
  id: string;
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  barcode: string | null;
}

export interface ShopifyMetafield {
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface ShopifyProductFromAPI {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  images: {
    edges: Array<{
      node: ShopifyImage;
    }>;
  };
  variants: {
    edges: Array<{
      node: ShopifyVariant;
    }>;
  };
  metafields: {
    edges: Array<{
      node: ShopifyMetafield;
    }>;
  };
}

// ============================================
// Database Types
// ============================================

export interface ShopifyProduct {
  id: string;
  shopify_id: string;
  shopify_variant_id: string | null;
  handle: string | null;
  
  // Original content from Shopify
  title: string;
  description_html: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string[];
  status: ShopifyProductStatus;
  
  // Stored as JSONB
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  metafields: Record<string, ShopifyMetafield>;
  
  // Enriched content (separate from original)
  enriched_title: string | null;
  enriched_description_html: string | null;
  enriched_meta_description: string | null;
  
  // Linking
  linked_inventory_id: string | null;
  
  // Status
  enrichment_status: EnrichmentStatus;
  
  // Timestamps
  shopify_created_at: string | null;
  shopify_updated_at: string | null;
  last_imported_at: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopifyProductSnapshot {
  id: string;
  shopify_product_id: string;
  snapshot_type: SnapshotType;
  note: string | null;
  data: ShopifyProductSnapshotData;
  created_at: string;
}

export interface ShopifyProductSnapshotData {
  title: string;
  description_html: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string[];
  status: ShopifyProductStatus;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  metafields: Record<string, ShopifyMetafield>;
  enriched_title: string | null;
  enriched_description_html: string | null;
  enriched_meta_description: string | null;
}

// ============================================
// Insert/Update Types
// ============================================

export interface ShopifyProductInsert {
  shopify_id: string;
  shopify_variant_id?: string | null;
  handle?: string | null;
  title: string;
  description_html?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string[];
  status?: ShopifyProductStatus;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
  metafields?: Record<string, ShopifyMetafield>;
  shopify_created_at?: string | null;
  shopify_updated_at?: string | null;
}

export interface ShopifyProductUpdate {
  title?: string;
  description_html?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string[];
  status?: ShopifyProductStatus;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
  metafields?: Record<string, ShopifyMetafield>;
  enriched_title?: string | null;
  enriched_description_html?: string | null;
  enriched_meta_description?: string | null;
  linked_inventory_id?: string | null;
  enrichment_status?: EnrichmentStatus;
  last_synced_at?: string | null;
  shopify_updated_at?: string | null;
}

export interface ShopifyProductSnapshotInsert {
  shopify_product_id: string;
  snapshot_type: SnapshotType;
  note?: string | null;
  data: ShopifyProductSnapshotData;
}

// ============================================
// API Request/Response Types
// ============================================

export interface ImportProgress {
  status: 'idle' | 'fetching' | 'processing' | 'complete' | 'error';
  total: number;
  processed: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  currentProduct?: string;
}

export interface ImportResponse {
  success: boolean;
  message: string;
  stats: {
    total: number;
    imported: number;
    updated: number;
    skipped: number;
    errors: number;
  };
}

export interface EnrichResponse {
  success: boolean;
  product: ShopifyProduct;
  generated: {
    title: string;
    titleLength: number;
    metaDescription: string;
    metaDescriptionLength: number;
    descriptionHtml: string;
  };
}

export interface SyncRequest {
  fields: {
    title?: boolean;
    description?: boolean;
    metaDescription?: boolean;
  };
  createSnapshot?: boolean;
}

export interface SyncResponse {
  success: boolean;
  product: ShopifyProduct;
  snapshotId?: string;
  shopifyUpdated: boolean;
  pushedFields?: string[];
}

export interface RollbackRequest {
  snapshotId: string;
  syncToShopify?: boolean;
}

export interface RollbackResponse {
  success: boolean;
  product: ShopifyProduct;
  restoredFrom: ShopifyProductSnapshot;
  shopifySynced: boolean;
}

// ============================================
// Matching Types
// ============================================

export interface MatchSuggestion {
  inventoryItem: {
    id: string;
    brand: string;
    model: string;
    sku: string | null;
    rrp_aud: number | null;
    sale_price: number;
  };
  matchType: 'sku_exact' | 'brand_model_exact' | 'brand_model_fuzzy';
  confidence: number; // 0-100
  matchDetails: {
    skuMatch?: boolean;
    brandMatch?: boolean;
    modelMatch?: boolean;
    similarityScore?: number;
  };
}

export interface MatchSuggestionsResponse {
  suggestions: MatchSuggestion[];
  currentLink: {
    id: string;
    brand: string;
    model: string;
  } | null;
}

export interface LinkRequest {
  inventoryItemId: string;
}

// ============================================
// Filter Types
// ============================================

export interface ShopifyProductFilters {
  status?: ShopifyProductStatus;
  enrichmentStatus?: EnrichmentStatus;
  linked?: 'linked' | 'unlinked' | 'all';
  search?: string;
  vendor?: string;
}

export interface ShopifyProductListResponse {
  products: ShopifyProduct[];
  total: number;
  page: number;
  limit: number;
  filters: ShopifyProductFilters;
}

// ============================================
// Diff Types (for UI comparison)
// ============================================

export interface ProductDiff {
  field: 'title' | 'description_html' | 'meta_description';
  original: string | null;
  enriched: string | null;
  hasChanges: boolean;
}

export interface ProductDiffSummary {
  product: ShopifyProduct;
  diffs: ProductDiff[];
  hasAnyChanges: boolean;
  snapshots: ShopifyProductSnapshot[];
}

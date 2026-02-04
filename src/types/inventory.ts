/**
 * CHT Operating System - Inventory Types
 * Phase 1: Unified Product Lister
 */

export type ListingType = 'new' | 'trade_in' | 'ex_demo';

export type ConditionGrade = 'mint' | 'excellent' | 'good' | 'fair' | 'poor';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface InventoryItem {
  id: string;
  created_at: string;
  updated_at: string;
  
  // Classification
  listing_type: ListingType;
  
  // Product Identification
  brand: string;
  model: string;
  serial_number: string | null;
  sku: string | null;
  
  // Pricing (AUD)
  rrp_aud: number | null;
  cost_price: number | null;
  sale_price: number;
  
  // Condition (pre-owned/ex-demo)
  condition_grade: ConditionGrade | null;
  condition_report: string | null;
  
  // Media
  image_urls: string[];
  vision_ai_response: VisionAIResponse | null;
  
  // Content
  title: string | null;
  description_html: string | null;
  meta_description: string | null;
  specifications: Record<string, string>;
  
  // External IDs
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  hubspot_deal_id: string | null;
  notion_page_id: string | null;
  
  // Sync
  sync_status: SyncStatus;
  last_synced_at: string | null;
  sync_error: string | null;
  
  // Source
  source_url: string | null;
  rrp_source: string | null;
  
  // Meta
  created_by: string | null;
  is_archived: boolean;
}

export interface InventoryItemInsert {
  listing_type: ListingType;
  brand: string;
  model: string;
  serial_number?: string | null;
  sku?: string | null;
  rrp_aud?: number | null;
  cost_price?: number | null;
  sale_price: number;
  condition_grade?: ConditionGrade | null;
  condition_report?: string | null;
  image_urls?: string[];
  vision_ai_response?: VisionAIResponse | null;
  title?: string | null;
  description_html?: string | null;
  meta_description?: string | null;
  specifications?: Record<string, string>;
  source_url?: string | null;
  rrp_source?: string | null;
  created_by?: string | null;
}

export interface InventoryItemUpdate {
  listing_type?: ListingType;
  brand?: string;
  model?: string;
  serial_number?: string | null;
  sku?: string | null;
  rrp_aud?: number | null;
  cost_price?: number | null;
  sale_price?: number;
  condition_grade?: ConditionGrade | null;
  condition_report?: string | null;
  image_urls?: string[];
  title?: string | null;
  description_html?: string | null;
  meta_description?: string | null;
  specifications?: Record<string, string>;
  shopify_product_id?: string | null;
  shopify_variant_id?: string | null;
  hubspot_deal_id?: string | null;
  notion_page_id?: string | null;
  sync_status?: SyncStatus;
  last_synced_at?: string | null;
  sync_error?: string | null;
  is_archived?: boolean;
}

// Vision AI Response
export interface VisionAIResponse {
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  confidence: number;
  raw_text: string;
  identified_at: string;
}

// RRP Search Result
export interface RRPSearchResult {
  rrp_aud: number;
  source: string;
  source_url: string;
  confidence: 'high' | 'medium' | 'low';
  retrieved_at: string;
}

// Sync Result
export interface SyncResult {
  success: boolean;
  shopify?: {
    product_id: string;
    variant_id: string;
    admin_url: string;
  };
  hubspot?: {
    deal_id: string;
    deal_url: string;
  };
  notion?: {
    page_id: string;
    page_url: string;
  };
  errors?: string[];
}

// Form state for lister UI
export interface ListerFormState {
  step: 'choose_type' | 'capture' | 'details' | 'pricing' | 'review';
  listing_type: ListingType | null;
  
  // Capture step (trade-in)
  captured_image: string | null;
  vision_result: VisionAIResponse | null;
  
  // Details
  brand: string;
  model: string;
  serial_number: string;
  condition_grade: ConditionGrade | null;
  condition_report: string;
  
  // Pricing
  rrp_aud: number | null;
  rrp_source: string | null;
  sale_price: number | null;
  cost_price: number | null;
  
  // Images
  image_urls: string[];
  
  // Loading states
  isIdentifying: boolean;
  isFetchingRRP: boolean;
  isPublishing: boolean;
}

// Condition grade display info
export const CONDITION_GRADES: Record<ConditionGrade, { label: string; description: string; color: string }> = {
  mint: {
    label: 'Mint',
    description: 'Like new, no visible wear',
    color: 'emerald',
  },
  excellent: {
    label: 'Excellent',
    description: 'Minor signs of use, fully functional',
    color: 'green',
  },
  good: {
    label: 'Good',
    description: 'Normal wear, fully functional',
    color: 'yellow',
  },
  fair: {
    label: 'Fair',
    description: 'Noticeable wear, fully functional',
    color: 'orange',
  },
  poor: {
    label: 'Poor',
    description: 'Heavy wear or minor defects',
    color: 'red',
  },
};

// Listing type display info
export const LISTING_TYPES: Record<ListingType, { label: string; description: string; icon: string }> = {
  new: {
    label: 'New Retail',
    description: 'Brand new product from manufacturer',
    icon: '📦',
  },
  trade_in: {
    label: 'Trade-In',
    description: 'Customer trade-in item',
    icon: '🔄',
  },
  ex_demo: {
    label: 'Ex-Demo',
    description: 'Former demonstration unit',
    icon: '🏷️',
  },
};

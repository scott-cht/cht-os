/**
 * CHT Operating System - Inventory Types
 * Phase 1: Unified Product Lister
 */

export type ListingType = 'new' | 'trade_in' | 'ex_demo';

export type ConditionGrade = 'mint' | 'excellent' | 'good' | 'fair' | 'poor';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

// Listing status (separate from sync status)
// on_demo = Currently on demonstration, not for sale
// ready_to_sell = Ready to be listed for sale  
// sold = Item has been sold
export type ListingStatus = 'on_demo' | 'ready_to_sell' | 'sold';

// Demo age alert levels
export type DemoAgeAlert = 'ok' | 'warning' | 'critical';

export interface InventoryItem {
  id: string;
  created_at: string;
  updated_at: string;
  
  // Classification
  listing_type: ListingType;
  listing_status: ListingStatus | null;
  
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
  
  // Demo-specific fields
  demo_start_date: string | null;
  demo_location: string | null;
  converted_to_sale_at: string | null;
  sold_at: string | null;
  
  // Media
  image_urls: string[];
  registration_images: string[]; // Original photos when demo registered
  selling_images: string[]; // Condition photos when converting to sale
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
  
  // Computed (from views)
  days_on_demo?: number;
  demo_age_alert?: DemoAgeAlert;
}

export interface InventoryItemInsert {
  listing_type: ListingType;
  listing_status?: ListingStatus | null;
  brand: string;
  model: string;
  serial_number?: string | null;
  sku?: string | null;
  rrp_aud?: number | null;
  cost_price?: number | null;
  sale_price: number;
  condition_grade?: ConditionGrade | null;
  condition_report?: string | null;
  demo_start_date?: string | null;
  demo_location?: string | null;
  image_urls?: string[];
  registration_images?: string[];
  selling_images?: string[];
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
  listing_status?: ListingStatus | null;
  brand?: string;
  model?: string;
  serial_number?: string | null;
  sku?: string | null;
  rrp_aud?: number | null;
  cost_price?: number | null;
  sale_price?: number;
  condition_grade?: ConditionGrade | null;
  condition_report?: string | null;
  demo_start_date?: string | null;
  demo_location?: string | null;
  converted_to_sale_at?: string | null;
  sold_at?: string | null;
  image_urls?: string[];
  registration_images?: string[];
  selling_images?: string[];
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

// Listing status display info
export const LISTING_STATUSES: Record<ListingStatus, { label: string; description: string; color: string }> = {
  on_demo: {
    label: 'On Demo',
    description: 'Currently on demonstration display',
    color: 'blue',
  },
  ready_to_sell: {
    label: 'Ready to Sell',
    description: 'Listed for sale',
    color: 'green',
  },
  sold: {
    label: 'Sold',
    description: 'Item has been sold',
    color: 'gray',
  },
};

// Demo age alert display info
export const DEMO_AGE_ALERTS: Record<DemoAgeAlert, { label: string; description: string; color: string }> = {
  ok: {
    label: 'Current',
    description: 'Less than 12 months on demo',
    color: 'green',
  },
  warning: {
    label: '12+ Months',
    description: 'On demo for over 12 months',
    color: 'yellow',
  },
  critical: {
    label: '24+ Months',
    description: 'On demo for over 24 months - consider selling',
    color: 'red',
  },
};

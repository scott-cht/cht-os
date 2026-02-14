/**
 * Klaviyo Marketing Engine - Types
 * Phase 2: Email Studio
 */

// Klaviyo API response types (minimal for our use)
export interface KlaviyoTemplateListItem {
  id: string;
  name: string;
  created?: string;
  updated?: string;
}

export interface KlaviyoCampaignListItem {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
}

export interface KlaviyoCampaignMessageRef {
  campaignId: string;
  messageId: string;
}

// Style guide: exported email content for AI reference
export interface EmailStyleGuide {
  id: string;
  name: string;
  subject: string | null;
  html: string;
  plainText: string | null;
  sourceType: 'template' | 'campaign_message';
  sourceId: string;
  createdAt?: string;
}

// Exported style sample (from API response before saving to DB)
export interface ExportedStyleSample {
  id: string;
  name: string;
  subject?: string | null;
  html: string;
  plainText?: string | null;
}

// AI-generated email output
export interface GeneratedEmail {
  subject: string;
  preheader?: string | null;
  htmlBody: string;
  plainText?: string | null;
  campaignName?: string | null;
}

// Inventory item summary for email copywriter context
export interface InventoryItemForEmail {
  id: string;
  brand: string;
  model: string;
  title: string | null;
  sale_price: number;
  listing_type: string;
  image_urls: string[];
  /** Public URL for the product page (e.g. store front). Used for "View product" / CTA links in emails. */
  product_url?: string | null;
  description_html: string | null;
  condition_grade?: string | null;
  condition_report?: string | null;
}

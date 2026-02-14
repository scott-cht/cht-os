export type IntegrationStatus = { klaviyo?: { configured: boolean; status: string } };

export interface SectionTag {
  type: string;
  description?: string;
}

export interface StyleGuide {
  id: string;
  name: string;
  subject: string | null;
  html?: string;
  createdAt?: string;
  layoutNotes?: string | null;
  sectionTags?: SectionTag[];
}

export interface TemplateItem {
  id: string;
  name: string;
}

export interface CampaignItem {
  id: string;
  name: string;
  created_at?: string;
}

export interface CampaignMessage {
  id: string;
  label?: string;
}

export interface SelectedCampaignMessage {
  campaignId: string;
  messageId: string;
}

export interface InventoryPickerItem {
  id: string;
  brand: string;
  model: string;
  title: string | null;
  sale_price: number;
  listing_type: string;
  image_urls: string[];
}

export interface EmailPreviewData {
  subject: string;
  preheader?: string | null;
  htmlBody: string;
}

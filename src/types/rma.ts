import type { ConditionGrade } from './inventory';

export type RmaStatus =
  | 'received'
  | 'testing'
  | 'sent_to_manufacturer'
  | 'repaired_replaced'
  | 'back_to_customer';

export type ServiceEventType =
  | 'sale_recorded'
  | 'rma_received'
  | 'rma_testing'
  | 'rma_sent_to_manufacturer'
  | 'rma_repaired_replaced'
  | 'rma_back_to_customer'
  | 'service_note'
  | 'lamp_hours_recorded';

export type RmaSource = 'manual' | 'shopify_return_webhook' | 'customer_form';
export type RmaSubmissionChannel = 'internal_dashboard' | 'shopify_webhook' | 'customer_portal';
export type RmaWarrantyStatus = 'in_warranty' | 'out_of_warranty' | 'unknown';
export type RmaWarrantyBasis = 'manufacturer' | 'extended' | 'acl' | 'manual_override' | 'unknown';
export type RmaDisposition = 'repair' | 'replace' | 'refund' | 'reject' | 'monitor';
export type RmaPriority = 'low' | 'normal' | 'high' | 'urgent';
export type RmaContactPreference = 'email' | 'phone' | 'sms' | 'unknown';

export interface RmaCase {
  id: string;
  shopify_order_id: string;
  shopify_order_name: string | null;
  shopify_order_number: number | null;
  inventory_item_id: string | null;
  serial_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_company: string | null;
  customer_contact_preference: RmaContactPreference;
  customer_address_json: Record<string, unknown> | null;
  shopify_customer_id: string | null;
  order_processed_at: string | null;
  order_financial_status: string | null;
  order_fulfillment_status: string | null;
  order_currency: string | null;
  order_total_amount: number | null;
  order_line_items_json: Record<string, unknown> | null;
  issue_summary: string;
  issue_details: string | null;
  arrival_condition_report: string | null;
  arrival_condition_grade: ConditionGrade | null;
  arrival_condition_images: string[];
  status: RmaStatus;
  source: RmaSource;
  submission_channel: RmaSubmissionChannel;
  shopify_return_id: string | null;
  external_reference: string | null;
  dedupe_key: string | null;
  warranty_status: RmaWarrantyStatus;
  warranty_basis: RmaWarrantyBasis;
  warranty_expires_at: string | null;
  warranty_decision_notes: string | null;
  warranty_checked_at: string | null;
  inbound_carrier: string | null;
  inbound_tracking_number: string | null;
  inbound_tracking_url: string | null;
  inbound_status: string | null;
  outbound_carrier: string | null;
  outbound_tracking_number: string | null;
  outbound_tracking_url: string | null;
  outbound_status: string | null;
  received_at: string | null;
  inspected_at: string | null;
  shipped_back_at: string | null;
  delivered_back_at: string | null;
  return_label_url: string | null;
  proof_of_delivery_url: string | null;
  disposition: RmaDisposition | null;
  disposition_reason: string | null;
  priority: RmaPriority;
  sla_due_at: string | null;
  assigned_owner_name: string | null;
  assigned_owner_email: string | null;
  assigned_technician_name: string | null;
  assigned_technician_email: string | null;
  assigned_at: string | null;
  hubspot_ticket_id: string | null;
  ai_recommendation: {
    recommendation: 'repair' | 'replace' | 'monitor';
    rationale: string;
    confidence: number;
    generatedAt: string;
  } | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface RmaCaseInsert {
  shopify_order_id: string;
  shopify_order_name?: string | null;
  shopify_order_number?: number | null;
  inventory_item_id?: string | null;
  serial_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_company?: string | null;
  customer_contact_preference?: RmaContactPreference;
  customer_address_json?: Record<string, unknown> | null;
  shopify_customer_id?: string | null;
  order_processed_at?: string | null;
  order_financial_status?: string | null;
  order_fulfillment_status?: string | null;
  order_currency?: string | null;
  order_total_amount?: number | null;
  order_line_items_json?: Record<string, unknown> | null;
  issue_summary: string;
  issue_details?: string | null;
  arrival_condition_report?: string | null;
  arrival_condition_grade?: ConditionGrade | null;
  arrival_condition_images?: string[];
  status?: RmaStatus;
  source?: RmaSource;
  submission_channel?: RmaSubmissionChannel;
  shopify_return_id?: string | null;
  external_reference?: string | null;
  dedupe_key?: string | null;
  warranty_status?: RmaWarrantyStatus;
  warranty_basis?: RmaWarrantyBasis;
  warranty_expires_at?: string | null;
  warranty_decision_notes?: string | null;
  warranty_checked_at?: string | null;
  inbound_carrier?: string | null;
  inbound_tracking_number?: string | null;
  inbound_tracking_url?: string | null;
  inbound_status?: string | null;
  outbound_carrier?: string | null;
  outbound_tracking_number?: string | null;
  outbound_tracking_url?: string | null;
  outbound_status?: string | null;
  received_at?: string | null;
  inspected_at?: string | null;
  shipped_back_at?: string | null;
  delivered_back_at?: string | null;
  return_label_url?: string | null;
  proof_of_delivery_url?: string | null;
  disposition?: RmaDisposition | null;
  disposition_reason?: string | null;
  priority?: RmaPriority;
  sla_due_at?: string | null;
  assigned_owner_name?: string | null;
  assigned_owner_email?: string | null;
  assigned_technician_name?: string | null;
  assigned_technician_email?: string | null;
  assigned_at?: string | null;
  hubspot_ticket_id?: string | null;
  created_by?: string | null;
}

export interface RmaCaseUpdate {
  issue_summary?: string;
  issue_details?: string | null;
  arrival_condition_report?: string | null;
  arrival_condition_grade?: ConditionGrade | null;
  arrival_condition_images?: string[];
  status?: RmaStatus;
  source?: RmaSource;
  submission_channel?: RmaSubmissionChannel;
  shopify_return_id?: string | null;
  external_reference?: string | null;
  dedupe_key?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_company?: string | null;
  customer_contact_preference?: RmaContactPreference;
  customer_address_json?: Record<string, unknown> | null;
  shopify_customer_id?: string | null;
  order_processed_at?: string | null;
  order_financial_status?: string | null;
  order_fulfillment_status?: string | null;
  order_currency?: string | null;
  order_total_amount?: number | null;
  order_line_items_json?: Record<string, unknown> | null;
  warranty_status?: RmaWarrantyStatus;
  warranty_basis?: RmaWarrantyBasis;
  warranty_expires_at?: string | null;
  warranty_decision_notes?: string | null;
  warranty_checked_at?: string | null;
  inbound_carrier?: string | null;
  inbound_tracking_number?: string | null;
  inbound_tracking_url?: string | null;
  inbound_status?: string | null;
  outbound_carrier?: string | null;
  outbound_tracking_number?: string | null;
  outbound_tracking_url?: string | null;
  outbound_status?: string | null;
  received_at?: string | null;
  inspected_at?: string | null;
  shipped_back_at?: string | null;
  delivered_back_at?: string | null;
  return_label_url?: string | null;
  proof_of_delivery_url?: string | null;
  disposition?: RmaDisposition | null;
  disposition_reason?: string | null;
  priority?: RmaPriority;
  sla_due_at?: string | null;
  assigned_owner_name?: string | null;
  assigned_owner_email?: string | null;
  assigned_technician_name?: string | null;
  assigned_technician_email?: string | null;
  assigned_at?: string | null;
  hubspot_ticket_id?: string | null;
  ai_recommendation?: RmaCase['ai_recommendation'];
  closed_at?: string | null;
}

export interface SerialRegistry {
  id: string;
  serial_number: string;
  brand: string | null;
  model: string | null;
  first_seen_inventory_id: string | null;
  first_seen_at: string | null;
  sold_shopify_order_id: string | null;
  sold_at: string | null;
  rma_count: number;
  last_rma_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SerialServiceEvent {
  id: string;
  serial_registry_id: string;
  rma_case_id: string | null;
  event_type: ServiceEventType;
  summary: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

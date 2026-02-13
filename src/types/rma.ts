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
  issue_summary: string;
  issue_details: string | null;
  arrival_condition_report: string | null;
  arrival_condition_grade: ConditionGrade | null;
  arrival_condition_images: string[];
  status: RmaStatus;
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
  issue_summary: string;
  issue_details?: string | null;
  arrival_condition_report?: string | null;
  arrival_condition_grade?: ConditionGrade | null;
  arrival_condition_images?: string[];
  status?: RmaStatus;
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

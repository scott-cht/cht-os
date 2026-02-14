# Phase 4 RMA Hardening and Service Ops Plan

## Objective

Upgrade the RMA system from basic case tracking to full service operations coverage:

- Complete customer + order snapshot at intake
- Explicit warranty evaluation and traceability
- Structured inbound/outbound shipment tracking
- Better SLA and operational visibility
- Stronger extraction-ready data model for automation and reporting

## Current Gaps

- Webhook/manual/public intake can create useful RMAs, but order/customer context is incomplete in many cases.
- Warranty state is not modeled as first-class data.
- Return logistics (carrier/tracking/status timestamps) is not modeled in structured fields.
- Older plaintext `issue_details` are not optimal for machine extraction.
- RMA board/detail currently emphasizes status flow, but lacks dedicated ops panels (warranty + logistics + purchase context).

## Scope (All Suggestions Consolidated)

### 1) Data Model Expansion

Add additive fields to `rma_cases` for:

- **Customer snapshot**
  - `customer_first_name`, `customer_last_name`
  - `customer_company`
  - `customer_contact_preference` (`email`, `phone`, `sms`, `unknown`)
  - `customer_address_json` (shipping/billing summary JSON)
  - `shopify_customer_id`
- **Order snapshot**
  - `order_processed_at`
  - `order_financial_status`
  - `order_fulfillment_status`
  - `order_currency`
  - `order_total_amount`
  - `order_line_items_json` (normalized line item snapshot)
- **Warranty**
  - `warranty_status` (`in_warranty`, `out_of_warranty`, `unknown`)
  - `warranty_basis` (`manufacturer`, `extended`, `acl`, `manual_override`, `unknown`)
  - `warranty_expires_at`
  - `warranty_decision_notes`
  - `warranty_checked_at`
- **Logistics**
  - `inbound_carrier`, `inbound_tracking_number`, `inbound_tracking_url`, `inbound_status`
  - `outbound_carrier`, `outbound_tracking_number`, `outbound_tracking_url`, `outbound_status`
  - `received_at`, `inspected_at`, `shipped_back_at`, `delivered_back_at`
  - `return_label_url`, `proof_of_delivery_url`
- **Ops**
  - `disposition` (`repair`, `replace`, `refund`, `reject`, `monitor`)
  - `disposition_reason`
  - `priority` (`low`, `normal`, `high`, `urgent`)
  - `sla_due_at`

### 2) Intake Enrichment

For manual, webhook, and public intake:

- Always store a normalized customer/order snapshot at creation time (best effort).
- Keep webhook create non-blocking when Shopify enrichment fails.
- Build deterministic normalized order line item snapshot for extraction and audit.

### 3) Warranty Engine (Initial)

- Compute baseline warranty using order purchase date + configurable warranty window.
- Persist both computed result and operator-overridable fields.
- Log warranty decisions in service timeline metadata.

### 4) Logistics Tracking

- Support manual updates for inbound/outbound shipping info in case detail.
- Persist logistics statuses and milestone timestamps.
- Prepare model for future carrier webhook automation.

### 5) UI/UX Hardening

- Add dedicated sections in RMA detail:
  - Customer + order snapshot
  - Warranty panel (status, basis, expiry, notes)
  - Logistics panel (inbound/outbound tracking + milestones)
- Add board badges/filters for:
  - warranty status
  - priority
  - logistics exceptions (e.g., outbound shipped but undelivered)

### 6) Automation + Reporting Foundation

- SLA indicators (time-in-stage and overdue marker).
- Structured fields for future dashboards:
  - turnaround time
  - warranty hit rate
  - repeat issue frequency by SKU/serial
  - logistics exceptions

### 7) Testing and Rollout Gates

- Integration tests:
  - webhook creates enriched snapshot
  - webhook dedupe + shipment/warranty field persistence
  - public/manual intake persists structured snapshot fields
  - warranty calculation baseline paths
- Documentation:
  - required env vars
  - expected payload mappings
  - operational runbook for warranty/logistics updates

## Delivery Sequence (Step-by-Step)

1. Schema migration + indexes + enum constraints.
2. Type and schema updates.
3. API create/update enrichment and warranty baseline compute.
4. UI detail/board updates for warranty and logistics.
5. Tests + docs + rollout checklist.

## Acceptance Criteria

- New RMA records contain structured customer/order context when available.
- Warranty status is explicit and queryable.
- Inbound/outbound tracking can be captured in structured fields.
- RMA detail page shows extracted fields in dedicated sections (not only free text).
- Webhook dedupe still works and is regression-tested.
- Existing records remain readable (legacy compatibility retained).

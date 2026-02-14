# RMA Operations Runbook (Phase 4)

This runbook defines day-to-day operational handling for RMA cases, plus payload mappings for the main service APIs.

## Prerequisites

- Apply database migrations:
  - `015_rma_and_serial_registry.sql`
  - `016_rma_sources_and_dedupe.sql`
  - `017_rma_ops_enrichment.sql`
  - `018_rma_assignment_fields.sql`
  - `019_rma_communications.sql`
- Ensure app is running with valid Supabase credentials.
- For webhook intake, configure Shopify returns webhook to `/api/shopify/webhooks/returns`.

## Board Workflow

1. Start in `/rma` and choose a preset:
   - `My Queue`
   - `Overdue`
   - `Needs Outbound Tracking`
   - `Outbound in transit`
2. Validate case ownership:
   - Assign technician/owner if missing.
   - Use `Bulk Assign` for queue balancing.
3. Review SLA risk and warranty badges.
4. Escalate urgent workloads:
   - Use `Mark Urgent` or `Bulk Mark Urgent`.
5. Keep outbound exceptions clear:
   - Cases in `repaired_replaced` should have outbound details.

## Status Guardrails

Status changes are validated in `/api/rma/[id]/status`.

- Backward transitions are blocked.
- Required fields by stage:
  - To `testing`: `received_at` must exist.
  - To `sent_to_manufacturer` or `repaired_replaced`: `inspected_at` must exist.
  - To `back_to_customer`: `outbound_carrier` and `outbound_tracking_number` must exist.

## Warranty Decision Procedure

Use `POST /api/rma/[id]/warranty-decision` when a technician confirms warranty position.

Required payload:

```json
{
  "warranty_status": "in_warranty | out_of_warranty | unknown",
  "warranty_basis": "manufacturer | extended | acl | manual_override | unknown",
  "decision_notes": "Required operator note",
  "priority": "low | normal | high | urgent"
}
```

Outcome:
- Updates warranty fields on `rma_cases`.
- Stamps `warranty_checked_at`.
- Appends a service timeline event for audit traceability.

## Tracking Update Procedure

Use `POST /api/rma/[id]/tracking` for inbound/outbound logistics updates.

Inbound payload example:

```json
{
  "direction": "inbound",
  "carrier": "Australia Post",
  "tracking_number": "IN-123",
  "tracking_url": "https://tracking.example/in-123",
  "status": "delivered",
  "event_note": "Inbound parcel delivered"
}
```

Outbound payload example:

```json
{
  "direction": "outbound",
  "carrier": "StarTrack",
  "tracking_number": "OUT-456",
  "tracking_url": "https://tracking.example/out-456",
  "status": "in_transit",
  "event_note": "Booked and dispatched"
}
```

Automation behavior:
- Inbound `delivered` can auto-set `received_at` and move case to `testing`.
- Outbound tracking can auto-set `shipped_back_at` and move case to `back_to_customer`.
- Timeline event is logged for each tracking update.

## Customer Communication Procedure

Use `POST /api/rma/[id]/communications` to log outbound customer contact and optionally open a local mail client link.

Template-driven payload example:

```json
{
  "template_key": "testing_update",
  "recipient": "customer@example.com",
  "send_mode": "manual_mailto"
}
```

Freeform payload example:

```json
{
  "recipient": "customer@example.com",
  "subject": "RMA update",
  "body": "Your unit has been assessed...",
  "send_mode": "log_only"
}
```

Read communication history:
- `GET /api/rma/[id]/communications`

## KPI Reporting

Use `GET /api/rma/kpis` for operational snapshots.

Supported filters:
- `source`
- `status`
- `warranty_status`
- `priority`
- `technician_email`
- `my_queue_email`
- `search`

Response highlights:
- `total_cases`
- `open_cases`
- `overdue_cases`
- `avg_turnaround_days`
- `queue_by_technician`
- `warranty_hit_rate_pct`
- `logistics_exception_rate_pct`
- `repeat_issue_serials` (top repeated serials by case count)

Time-in-stage endpoint:
- `GET /api/rma/time-in-stage`
- Supports same filter parameters as `/api/rma/kpis`.
- Returns:
  - `entries[]` with `case_id`, `status`, `entered_at`, `hours_in_stage`, `is_sla_overdue`
  - `summary_by_status` with average time-in-stage per status

Logistics exceptions queue endpoint:
- `GET /api/rma/logistics-exceptions`
- Supports same filter parameters as `/api/rma/kpis`.
- Returns:
  - `exceptions[]` with `exception_types` for each case
  - `summary` counts by exception class
  - `total_exceptions`

## Troubleshooting

- `409` errors on communications:
  - Confirm `019_rma_communications.sql` was applied.
- `409` errors on enrichment/assignment fields:
  - Confirm `017_rma_ops_enrichment.sql` and `018_rma_assignment_fields.sql`.
- Webhook auth failures:
  - Verify `x-shopify-hmac-sha256` signing secret and topic headers.

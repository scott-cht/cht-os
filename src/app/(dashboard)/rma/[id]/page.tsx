'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { notify } from '@/lib/store/app-store';
import type { RmaCase, RmaStatus, ServiceEventType } from '@/types';

const STATUS_OPTIONS: Array<{ value: RmaStatus; label: string }> = [
  { value: 'received', label: 'Received' },
  { value: 'testing', label: 'Testing' },
  { value: 'sent_to_manufacturer', label: 'Sent to Manufacturer' },
  { value: 'repaired_replaced', label: 'Repaired/Replaced' },
  { value: 'back_to_customer', label: 'Back to Customer' },
];

const EVENT_OPTIONS: ServiceEventType[] = [
  'service_note',
  'lamp_hours_recorded',
  'rma_testing',
  'rma_sent_to_manufacturer',
  'rma_repaired_replaced',
];

const COMM_TEMPLATE_OPTIONS = [
  { value: 'received_ack', label: 'Received Acknowledgement' },
  { value: 'testing_update', label: 'Testing Update' },
  { value: 'oow_quote', label: 'Out-of-Warranty Quote Request' },
  { value: 'shipped_back', label: 'Shipped Back' },
] as const;

const DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'comms', label: 'Comms' },
  { key: 'history', label: 'History' },
] as const;

interface ParsedWebhookDetails {
  format: 'shopify_return_webhook_v1';
  source: string;
  webhook_topic: string;
  return_id: string;
  order_id: string;
  return_status: string;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  primary: {
    sku: string | null;
    serial: string | null;
  };
  return_note: string | null;
  line_items: Array<{
    index: number;
    item: string | null;
    sku: string | null;
    serial: string | null;
    qty: number | null;
    reason: string | null;
  }>;
}

interface RmaCommunicationLogEntry {
  id: string;
  template_key: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
}

function parseWebhookDetails(value: string | null): ParsedWebhookDetails | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ParsedWebhookDetails;
    if (parsed?.format === 'shopify_return_webhook_v1') {
      return parsed;
    }
  } catch {
    // Fall through to legacy plaintext parsing.
  }

  // Legacy plaintext format support so existing records render as structured fields.
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const findValue = (label: string): string | null => {
    const prefix = `${label}:`;
    const line = lines.find((entry) => entry.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!line) return null;
    return line.slice(prefix.length).trim() || null;
  };

  const topic = findValue('Webhook topic');
  const returnNote = findValue('Return note');
  const primarySku = findValue('Primary SKU');
  const lineItemLines = lines.filter((line) => /^line_\d+:/i.test(line));

  if (!topic && lineItemLines.length === 0) {
    return null;
  }

  const parsedItems = lineItemLines.map((line, index) => {
    const [, rest = ''] = line.split(':');
    const fields = rest.split(',').map((entry) => entry.trim());
    const item = fields.find((entry) => entry.startsWith('item='))?.replace('item=', '') || null;
    const sku = fields.find((entry) => entry.startsWith('sku='))?.replace('sku=', '') || null;
    const serial = fields.find((entry) => entry.startsWith('serial='))?.replace('serial=', '') || null;
    const qtyRaw = fields.find((entry) => entry.startsWith('qty='))?.replace('qty=', '') || null;
    const reason = fields.find((entry) => entry.startsWith('reason='))?.replace('reason=', '') || null;
    const qty = qtyRaw ? Number.parseInt(qtyRaw, 10) : null;

    return {
      index: index + 1,
      item,
      sku,
      serial,
      qty: Number.isNaN(qty ?? NaN) ? null : qty,
      reason,
    };
  });

  return {
    format: 'shopify_return_webhook_v1',
    source: 'shopify_return_webhook',
    webhook_topic: topic || 'unknown',
    return_id: 'unknown',
    order_id: 'unknown',
    return_status: 'unknown',
    customer: {
      name: null,
      email: null,
      phone: null,
    },
    primary: {
      sku: primarySku,
      serial: parsedItems.find((item) => item.serial)?.serial || null,
    },
    return_note: returnNote,
    line_items: parsedItems,
  };
}

function toLocalDateTimeValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoFromLocalDateTime(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatSourceLabel(source: string): string {
  if (source === 'shopify_return_webhook') return 'Shopify Return';
  if (source === 'customer_form') return 'Customer Form';
  return 'Manual';
}

function generateTemplateDraft(
  template: (typeof COMM_TEMPLATE_OPTIONS)[number]['value'],
  rmaCase: RmaCase
): { subject: string; body: string } {
  const orderRef = rmaCase.shopify_order_name || rmaCase.shopify_order_id || 'your order';
  const customerName = rmaCase.customer_first_name || rmaCase.customer_name || 'there';
  const serial = rmaCase.serial_number ? `\nSerial: ${rmaCase.serial_number}` : '';

  if (template === 'received_ack') {
    return {
      subject: `RMA received for ${orderRef}`,
      body: `Hi ${customerName},\n\nWe have received your return request and your case is now in our service queue.\n\nCase ID: ${rmaCase.id}\nOrder: ${orderRef}${serial}\n\nWe will send another update once inspection is complete.\n\nRegards,\nCHT Support`,
    };
  }
  if (template === 'testing_update') {
    return {
      subject: `RMA inspection update for ${orderRef}`,
      body: `Hi ${customerName},\n\nYour item is currently in assessment with our technician team.\n\nCase ID: ${rmaCase.id}\nOrder: ${orderRef}${serial}\n\nWe will confirm next steps as soon as testing is complete.\n\nRegards,\nCHT Support`,
    };
  }
  if (template === 'oow_quote') {
    return {
      subject: `Action required: Out-of-warranty service for ${orderRef}`,
      body: `Hi ${customerName},\n\nAfter reviewing your item, this case is currently marked as out of warranty.\n\nCase ID: ${rmaCase.id}\nOrder: ${orderRef}${serial}\n\nPlease reply to approve paid repair/replacement options and we will proceed.\n\nRegards,\nCHT Support`,
    };
  }

  return {
    subject: `Your serviced item has been shipped - ${orderRef}`,
    body: `Hi ${customerName},\n\nYour serviced item has now been shipped back.\n\nCase ID: ${rmaCase.id}\nOrder: ${orderRef}\nCarrier: ${rmaCase.outbound_carrier || 'TBC'}\nTracking: ${rmaCase.outbound_tracking_number || 'TBC'}\n\nThank you for your patience.\n\nRegards,\nCHT Support`,
  };
}

export default function RmaCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rmaCase, setRmaCase] = useState<RmaCase | null>(null);
  const [events, setEvents] = useState<Array<{
    id: string;
    event_type: string;
    summary: string | null;
    notes: string | null;
    created_at: string;
    metadata: Record<string, unknown>;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusValue, setStatusValue] = useState<RmaStatus>('received');
  const [statusNote, setStatusNote] = useState('');
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [eventType, setEventType] = useState<ServiceEventType>('service_note');
  const [eventSummary, setEventSummary] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warrantyStatus, setWarrantyStatus] = useState<'in_warranty' | 'out_of_warranty' | 'unknown'>('unknown');
  const [warrantyBasis, setWarrantyBasis] = useState<'manufacturer' | 'extended' | 'acl' | 'manual_override' | 'unknown'>('unknown');
  const [warrantyNotes, setWarrantyNotes] = useState('');
  const [inboundCarrier, setInboundCarrier] = useState('');
  const [inboundTracking, setInboundTracking] = useState('');
  const [inboundTrackingUrl, setInboundTrackingUrl] = useState('');
  const [inboundStatus, setInboundStatus] = useState('');
  const [outboundCarrier, setOutboundCarrier] = useState('');
  const [outboundTracking, setOutboundTracking] = useState('');
  const [outboundTrackingUrl, setOutboundTrackingUrl] = useState('');
  const [outboundStatus, setOutboundStatus] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [receivedAt, setReceivedAt] = useState('');
  const [inspectedAt, setInspectedAt] = useState('');
  const [shippedBackAt, setShippedBackAt] = useState('');
  const [deliveredBackAt, setDeliveredBackAt] = useState('');
  const [assignedOwnerName, setAssignedOwnerName] = useState('');
  const [assignedOwnerEmail, setAssignedOwnerEmail] = useState('');
  const [assignedTechnicianName, setAssignedTechnicianName] = useState('');
  const [assignedTechnicianEmail, setAssignedTechnicianEmail] = useState('');
  const [communicationTemplate, setCommunicationTemplate] =
    useState<(typeof COMM_TEMPLATE_OPTIONS)[number]['value']>('received_ack');
  const [communicationRecipient, setCommunicationRecipient] = useState('');
  const [communicationSubject, setCommunicationSubject] = useState('');
  const [communicationBody, setCommunicationBody] = useState('');
  const [communications, setCommunications] = useState<RmaCommunicationLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof DETAIL_TABS)[number]['key']>('overview');

  const loadCase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/rma/${id}`);
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      const nextCase = data.case as RmaCase;
      setRmaCase(nextCase);
      setEvents(data.events || []);
      setStatusValue(nextCase.status);
      setWarrantyStatus(nextCase.warranty_status || 'unknown');
      setWarrantyBasis(nextCase.warranty_basis || 'unknown');
      setWarrantyNotes(nextCase.warranty_decision_notes || '');
      setInboundCarrier(nextCase.inbound_carrier || '');
      setInboundTracking(nextCase.inbound_tracking_number || '');
      setInboundTrackingUrl(nextCase.inbound_tracking_url || '');
      setInboundStatus(nextCase.inbound_status || '');
      setOutboundCarrier(nextCase.outbound_carrier || '');
      setOutboundTracking(nextCase.outbound_tracking_number || '');
      setOutboundTrackingUrl(nextCase.outbound_tracking_url || '');
      setOutboundStatus(nextCase.outbound_status || '');
      setPriority(nextCase.priority || 'normal');
      setReceivedAt(toLocalDateTimeValue(nextCase.received_at));
      setInspectedAt(toLocalDateTimeValue(nextCase.inspected_at));
      setShippedBackAt(toLocalDateTimeValue(nextCase.shipped_back_at));
      setDeliveredBackAt(toLocalDateTimeValue(nextCase.delivered_back_at));
      setAssignedOwnerName(nextCase.assigned_owner_name || '');
      setAssignedOwnerEmail(nextCase.assigned_owner_email || '');
      setAssignedTechnicianName(nextCase.assigned_technician_name || '');
      setAssignedTechnicianEmail(nextCase.assigned_technician_email || '');
      setCommunicationRecipient(nextCase.customer_email || '');

      const commResponse = await fetch(`/api/rma/${id}/communications`);
      const commData = await commResponse.json();
      if (commResponse.ok && !commData.error) {
        setCommunications((commData.communications || []) as RmaCommunicationLogEntry[]);
      }
    } catch (error) {
      notify.error('Failed to load RMA case', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!rmaCase) return;
    const draft = generateTemplateDraft(communicationTemplate, rmaCase);
    setCommunicationSubject(draft.subject);
    setCommunicationBody(draft.body);
  }, [communicationTemplate, rmaCase]);

  const updateStatus = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rma/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue, note: statusNote || null }),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setSyncResult(
        data.hubspotTicketSync?.attempted
          ? data.hubspotTicketSync?.success
            ? 'HubSpot ticket synced'
            : `HubSpot sync warning: ${data.hubspotTicketSync.error}`
          : 'No HubSpot ticket linked'
      );
      notify.success('Status updated', 'RMA status and service history updated');
      setStatusNote('');
      loadCase();
    } catch (error) {
      notify.error('Failed to update status', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createServiceEvent = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rma/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          summary: eventSummary || null,
          notes: eventNotes || null,
          metadata: {},
        }),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      notify.success('Service event added', 'Timeline updated');
      setEventSummary('');
      setEventNotes('');
      loadCase();
    } catch (error) {
      notify.error('Failed to append event', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateSuggestion = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rma/${id}/suggestion`, { method: 'POST' });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      notify.success('AI recommendation generated', data.recommendation?.recommendation || 'Done');
      loadCase();
    } catch (error) {
      notify.error('Suggestion generation failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const manualSyncHubSpot = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rma/${id}/hubspot-sync`, { method: 'POST' });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setSyncResult(
        data.hubspotTicketSync?.success
          ? 'HubSpot ticket synced successfully'
          : `HubSpot sync failed: ${data.hubspotTicketSync?.error || 'Unknown error'}`
      );
    } catch (error) {
      notify.error('HubSpot sync failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveOpsDetails = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rma/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warranty_status: warrantyStatus,
          warranty_basis: warrantyBasis,
          warranty_decision_notes: warrantyNotes || null,
          warranty_checked_at: new Date().toISOString(),
          priority,
          inbound_carrier: inboundCarrier || null,
          inbound_tracking_number: inboundTracking || null,
          inbound_tracking_url: inboundTrackingUrl || null,
          inbound_status: inboundStatus || null,
          outbound_carrier: outboundCarrier || null,
          outbound_tracking_number: outboundTracking || null,
          outbound_tracking_url: outboundTrackingUrl || null,
          outbound_status: outboundStatus || null,
          received_at: toIsoFromLocalDateTime(receivedAt),
          inspected_at: toIsoFromLocalDateTime(inspectedAt),
          shipped_back_at: toIsoFromLocalDateTime(shippedBackAt),
          delivered_back_at: toIsoFromLocalDateTime(deliveredBackAt),
          assigned_owner_name: assignedOwnerName || null,
          assigned_owner_email: assignedOwnerEmail || null,
          assigned_technician_name: assignedTechnicianName || null,
          assigned_technician_email: assignedTechnicianEmail || null,
          assigned_at:
            assignedOwnerEmail || assignedTechnicianEmail || assignedOwnerName || assignedTechnicianName
              ? new Date().toISOString()
              : null,
        }),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      notify.success('Ops details saved', 'Warranty and logistics fields updated');
      loadCase();
    } catch (error) {
      notify.error('Failed to save ops details', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveWarrantyDecision = async () => {
    if (!warrantyNotes.trim()) {
      notify.error('Warranty note required', 'Add decision notes before saving warranty decision');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rma/${id}/warranty-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warranty_status: warrantyStatus,
          warranty_basis: warrantyBasis,
          decision_notes: warrantyNotes,
          priority,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to save warranty decision');
      }
      notify.success('Warranty decision saved', 'Decision logged to service timeline');
      loadCase();
    } catch (error) {
      notify.error('Warranty decision failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pushTrackingUpdate = async (direction: 'inbound' | 'outbound', status: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rma/${id}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          carrier: direction === 'inbound' ? inboundCarrier || null : outboundCarrier || null,
          tracking_number: direction === 'inbound' ? inboundTracking || null : outboundTracking || null,
          tracking_url: direction === 'inbound' ? inboundTrackingUrl || null : outboundTrackingUrl || null,
          status,
          event_note: `${direction} tracking status updated from RMA detail`,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to update tracking');
      }
      notify.success('Tracking updated', `${direction} tracking status saved`);
      loadCase();
    } catch (error) {
      notify.error('Tracking update failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadCommunicationTemplate = () => {
    if (!rmaCase) return;
    const draft = generateTemplateDraft(communicationTemplate, rmaCase);
    setCommunicationSubject(draft.subject);
    setCommunicationBody(draft.body);
    if (!communicationRecipient.trim() && rmaCase.customer_email) {
      setCommunicationRecipient(rmaCase.customer_email);
    }
  };

  const sendCommunication = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/rma/${id}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_key: communicationTemplate,
          recipient: communicationRecipient || undefined,
          subject: communicationSubject || undefined,
          body: communicationBody || undefined,
          send_mode: 'manual_mailto',
          metadata: {
            initiated_from: 'rma_detail_page',
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to create communication');
      }
      if (data.mailto_url) {
        window.location.href = data.mailto_url as string;
      }
      notify.success('Communication logged', 'Email opened in your default mail client');
      loadCase();
    } catch (error) {
      notify.error('Communication failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !rmaCase) {
    return (
      <Shell title="RMA Case" subtitle="Loading...">
        <Card><p className="text-sm text-zinc-500">Loading case...</p></Card>
      </Shell>
    );
  }

  const webhookDetails = parseWebhookDetails(rmaCase.issue_details);
  const slaOverdue =
    !!rmaCase.sla_due_at &&
    rmaCase.status !== 'back_to_customer' &&
    new Date(rmaCase.sla_due_at).getTime() < Date.now();
  const currentStatusIndex = STATUS_OPTIONS.findIndex((option) => option.value === rmaCase.status);
  const attentionItems = [
    !rmaCase.assigned_technician_email ? 'Technician is unassigned' : null,
    rmaCase.status === 'received' && !rmaCase.inbound_tracking_number ? 'Missing inbound tracking' : null,
    rmaCase.status === 'repaired_replaced' && !rmaCase.outbound_tracking_number ? 'Missing outbound tracking' : null,
    rmaCase.warranty_status === 'unknown' ? 'Warranty decision pending' : null,
    slaOverdue ? 'SLA is overdue' : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <Shell title={`RMA ${rmaCase.shopify_order_name || rmaCase.shopify_order_id}`} subtitle="Service passport and resolution workflow">
      <Card className="mb-4 rounded-2xl border-emerald-200/70 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-cyan-950/20 shadow-sm py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/rma" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">← Back to RMA board</Link>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">RMA Action Center</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Core context and actions are always visible above the fold.</p>
          </div>
        </div>
      </Card>

      <Card className="mb-4 sticky top-16 z-10 rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm py-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-2 items-center">
          <select
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value as RmaStatus)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high' | 'urgent')}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs"
          >
            <option value="low">Priority: Low</option>
            <option value="normal">Priority: Normal</option>
            <option value="high">Priority: High</option>
            <option value="urgent">Priority: Urgent</option>
          </select>
          <input
            value={assignedTechnicianEmail}
            onChange={(e) => setAssignedTechnicianEmail(e.target.value)}
            placeholder="Technician email"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs"
          />
          <input
            value={assignedTechnicianName}
            onChange={(e) => setAssignedTechnicianName(e.target.value)}
            placeholder="Technician name"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs"
          />
          <Button className="w-full" onClick={updateStatus} isLoading={isSubmitting}>Save Status</Button>
          <Button className="w-full" variant="secondary" onClick={saveOpsDetails} isLoading={isSubmitting}>Save Ops</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
        <Card className="xl:col-span-7 rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <p><span className="text-zinc-500">Order:</span> {rmaCase.shopify_order_name || rmaCase.shopify_order_id}</p>
            <p><span className="text-zinc-500">Customer:</span> {rmaCase.customer_name || rmaCase.customer_email || 'Unknown'}</p>
            <p><span className="text-zinc-500">Serial:</span> {rmaCase.serial_number || 'N/A'}</p>
            <p><span className="text-zinc-500">Source:</span> {formatSourceLabel(rmaCase.source)}</p>
            <p className="md:col-span-2"><span className="text-zinc-500">Issue:</span> {rmaCase.issue_summary}</p>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {STATUS_OPTIONS.map((option, idx) => (
              <div
                key={option.value}
                className={`rounded-lg px-2 py-1 text-[11px] text-center ${
                  idx <= currentStatusIndex
                    ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                }`}
              >
                {option.label}
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-5 rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs inline-flex rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-zinc-700 dark:text-zinc-300 capitalize">
              Status: {rmaCase.status.replaceAll('_', ' ')}
            </span>
            <span className="text-xs inline-flex rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-zinc-700 dark:text-zinc-300 capitalize">
              Warranty: {(rmaCase.warranty_status || 'unknown').replaceAll('_', ' ')}
            </span>
            <span className={`text-xs inline-flex rounded-full px-2.5 py-1 ${slaOverdue ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'}`}>
              {slaOverdue ? 'SLA overdue' : 'SLA on track'}
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2">Needs attention</p>
          {attentionItems.length === 0 ? (
            <p className="text-xs text-zinc-500">No blockers. Case is ready to progress.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {attentionItems.map((item) => (
                <span key={item} className="text-[11px] inline-flex rounded-full bg-rose-100 dark:bg-rose-900/20 px-2 py-0.5 text-rose-700 dark:text-rose-300">
                  {item}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-900/50 p-2">
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Case Details</h3>
            {rmaCase.issue_details && (
              <div>
                {webhookDetails ? (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/90 dark:bg-zinc-900/60 p-3 text-xs text-zinc-700 dark:text-zinc-300 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <p><span className="text-zinc-500">Topic:</span> {webhookDetails.webhook_topic}</p>
                      <p><span className="text-zinc-500">Return Status:</span> {webhookDetails.return_status}</p>
                      <p><span className="text-zinc-500">Order ID:</span> {webhookDetails.order_id}</p>
                      <p><span className="text-zinc-500">Return ID:</span> {webhookDetails.return_id}</p>
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/90 dark:bg-zinc-900/60 p-3 text-xs text-zinc-700 dark:text-zinc-300">
                    {rmaCase.issue_details}
                  </pre>
                )}
              </div>
            )}
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Order Snapshot</h3>
              <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                <p><span className="text-zinc-500">Processed At:</span> {rmaCase.order_processed_at ? new Date(rmaCase.order_processed_at).toLocaleString() : 'N/A'}</p>
                <p><span className="text-zinc-500">Financial Status:</span> {rmaCase.order_financial_status || 'N/A'}</p>
                <p><span className="text-zinc-500">Fulfillment Status:</span> {rmaCase.order_fulfillment_status || 'N/A'}</p>
                <p><span className="text-zinc-500">Currency:</span> {rmaCase.order_currency || 'N/A'}</p>
                <p><span className="text-zinc-500">Order Total:</span> {typeof rmaCase.order_total_amount === 'number' ? rmaCase.order_total_amount.toFixed(2) : 'N/A'}</p>
              </div>
            </Card>
            <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Warranty Snapshot</h3>
              <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                <p><span className="text-zinc-500">Status:</span> {rmaCase.warranty_status.replaceAll('_', ' ')}</p>
                <p><span className="text-zinc-500">Basis:</span> {rmaCase.warranty_basis.replaceAll('_', ' ')}</p>
                <p><span className="text-zinc-500">Checked:</span> {rmaCase.warranty_checked_at ? new Date(rmaCase.warranty_checked_at).toLocaleString() : 'N/A'}</p>
                <p><span className="text-zinc-500">Notes:</span> {rmaCase.warranty_decision_notes || 'None'}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'logistics' && (
        <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Logistics & Tracking</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <input value={inboundCarrier} onChange={(e) => setInboundCarrier(e.target.value)} placeholder="Inbound carrier" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input value={inboundTracking} onChange={(e) => setInboundTracking(e.target.value)} placeholder="Inbound tracking number" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input value={inboundTrackingUrl} onChange={(e) => setInboundTrackingUrl(e.target.value)} placeholder="Inbound tracking URL" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input value={inboundStatus} onChange={(e) => setInboundStatus(e.target.value)} placeholder="Inbound status" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input value={outboundCarrier} onChange={(e) => setOutboundCarrier(e.target.value)} placeholder="Outbound carrier" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input value={outboundTracking} onChange={(e) => setOutboundTracking(e.target.value)} placeholder="Outbound tracking number" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input value={outboundTrackingUrl} onChange={(e) => setOutboundTrackingUrl(e.target.value)} placeholder="Outbound tracking URL" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input value={outboundStatus} onChange={(e) => setOutboundStatus(e.target.value)} placeholder="Outbound status" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input type="datetime-local" value={inspectedAt} onChange={(e) => setInspectedAt(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input type="datetime-local" value={shippedBackAt} onChange={(e) => setShippedBackAt(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input type="datetime-local" value={deliveredBackAt} onChange={(e) => setDeliveredBackAt(e.target.value)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button variant="ghost" onClick={() => pushTrackingUpdate('inbound', inboundStatus || 'delivered')} isLoading={isSubmitting}>Record Inbound Update</Button>
            <Button variant="ghost" onClick={() => pushTrackingUpdate('outbound', outboundStatus || 'delivered')} isLoading={isSubmitting}>Record Outbound Update</Button>
            <Button variant="secondary" onClick={saveOpsDetails} isLoading={isSubmitting}>Save Logistics</Button>
          </div>
        </Card>
      )}

      {activeTab === 'warranty' && (
        <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Warranty Decision</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select value={warrantyStatus} onChange={(e) => setWarrantyStatus(e.target.value as 'in_warranty' | 'out_of_warranty' | 'unknown')} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs">
              <option value="unknown">Warranty: Unknown</option>
              <option value="in_warranty">Warranty: In warranty</option>
              <option value="out_of_warranty">Warranty: Out of warranty</option>
            </select>
            <select value={warrantyBasis} onChange={(e) => setWarrantyBasis(e.target.value as 'manufacturer' | 'extended' | 'acl' | 'manual_override' | 'unknown')} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs">
              <option value="unknown">Basis: Unknown</option>
              <option value="manufacturer">Basis: Manufacturer</option>
              <option value="extended">Basis: Extended</option>
              <option value="acl">Basis: ACL</option>
              <option value="manual_override">Basis: Manual override</option>
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high' | 'urgent')} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs">
              <option value="low">Priority: Low</option>
              <option value="normal">Priority: Normal</option>
              <option value="high">Priority: High</option>
              <option value="urgent">Priority: Urgent</option>
            </select>
          </div>
          <textarea value={warrantyNotes} onChange={(e) => setWarrantyNotes(e.target.value)} rows={4} placeholder="Warranty decision notes" className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button variant="secondary" onClick={saveWarrantyDecision} isLoading={isSubmitting}>Save Warranty Decision</Button>
            <Button variant="ghost" onClick={saveOpsDetails} isLoading={isSubmitting}>Save Priority / Ownership</Button>
          </div>
        </Card>
      )}

      {activeTab === 'comms' && (
        <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Customer Communication</h3>
          <div className="space-y-2">
            <select value={communicationTemplate} onChange={(e) => setCommunicationTemplate(e.target.value as (typeof COMM_TEMPLATE_OPTIONS)[number]['value'])} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs">
              {COMM_TEMPLATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input value={communicationRecipient} onChange={(e) => setCommunicationRecipient(e.target.value)} placeholder="Recipient email" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <input value={communicationSubject} onChange={(e) => setCommunicationSubject(e.target.value)} placeholder="Email subject" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <textarea value={communicationBody} onChange={(e) => setCommunicationBody(e.target.value)} rows={6} placeholder="Email body" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={loadCommunicationTemplate}>Reload Template</Button>
              <Button variant="secondary" onClick={sendCommunication} isLoading={isSubmitting}>Open Email + Log</Button>
            </div>
          </div>
          <div className="mt-4 space-y-2 max-h-56 overflow-y-auto">
            {communications.length === 0 ? (
              <p className="text-xs text-zinc-500">No communication entries yet.</p>
            ) : (
              communications.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/50 p-2">
                  <p className="text-xs font-medium text-zinc-800 dark:text-zinc-100">{entry.subject}</p>
                  <p className="text-[11px] text-zinc-500">{entry.recipient} · {entry.status}</p>
                  <p className="text-[11px] text-zinc-500">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {activeTab === 'history' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Service Passport Timeline</h3>
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/50 rounded-xl p-3">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{event.summary || event.event_type}</p>
                    {event.notes && <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{event.notes}</p>}
                    <p className="text-xs text-zinc-500 mt-1">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                ))}
                {events.length === 0 && <p className="text-sm text-zinc-500">No service events yet.</p>}
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Add Service Event</h3>
              <select value={eventType} onChange={(e) => setEventType(e.target.value as ServiceEventType)} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm mb-3">
                {EVENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <input value={eventSummary} onChange={(e) => setEventSummary(e.target.value)} placeholder="Summary" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm mb-3" />
              <textarea value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} rows={3} placeholder="Notes" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm" />
              <Button className="w-full mt-3" variant="secondary" onClick={createServiceEvent} isLoading={isSubmitting}>Add Event</Button>
            </Card>
            <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">AI Recommendation</h3>
              {rmaCase.ai_recommendation ? (
                <div className="mb-3 text-sm">
                  <p className="font-medium capitalize">{rmaCase.ai_recommendation.recommendation}</p>
                  <p className="text-zinc-600 dark:text-zinc-300">{rmaCase.ai_recommendation.rationale}</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 mb-3">No recommendation generated yet.</p>
              )}
              <Button className="w-full" onClick={generateSuggestion} isLoading={isSubmitting}>Generate Recommendation</Button>
            </Card>
            <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">HubSpot Ticket Sync</h3>
              <p className="text-xs text-zinc-500 mb-3">Ticket ID: {rmaCase.hubspot_ticket_id || 'Not linked'}</p>
              <Button className="w-full" variant="secondary" onClick={manualSyncHubSpot} isLoading={isSubmitting}>Sync Ticket Now</Button>
              {syncResult && <p className="text-xs text-zinc-500 mt-2">{syncResult}</p>}
            </Card>
          </div>
        </div>
      )}

    </Shell>
  );
}

'use client';
/* eslint-disable @next/next/no-img-element */

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

  if (isLoading || !rmaCase) {
    return (
      <Shell title="RMA Case" subtitle="Loading...">
        <Card><p className="text-sm text-zinc-500">Loading case...</p></Card>
      </Shell>
    );
  }

  return (
    <Shell title={`RMA ${rmaCase.shopify_order_name || rmaCase.shopify_order_id}`} subtitle="Service passport and resolution workflow">
      <div className="mb-4">
        <Link href="/rma" className="text-sm text-emerald-600 hover:text-emerald-700">← Back to RMA board</Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Case Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p><span className="text-zinc-500">Order:</span> {rmaCase.shopify_order_name || rmaCase.shopify_order_id}</p>
              <p><span className="text-zinc-500">Customer:</span> {rmaCase.customer_name || rmaCase.customer_email || 'Unknown'}</p>
              <p><span className="text-zinc-500">Serial:</span> {rmaCase.serial_number || 'N/A'}</p>
              <p><span className="text-zinc-500">Status:</span> <span className="capitalize">{rmaCase.status.replaceAll('_', ' ')}</span></p>
              <p className="md:col-span-2"><span className="text-zinc-500">Issue:</span> {rmaCase.issue_summary}</p>
              {rmaCase.issue_details && <p className="md:col-span-2"><span className="text-zinc-500">Details:</span> {rmaCase.issue_details}</p>}
              {rmaCase.arrival_condition_report && (
                <p className="md:col-span-2"><span className="text-zinc-500">Arrival Condition:</span> {rmaCase.arrival_condition_report}</p>
              )}
            </div>
            {rmaCase.arrival_condition_images?.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto">
                {rmaCase.arrival_condition_images.map((img, idx) => (
                  <img key={idx} src={img} alt={`Condition ${idx + 1}`} className="w-24 h-24 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Service Passport Timeline</h2>
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {event.summary || event.event_type}
                  </p>
                  {event.notes && <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{event.notes}</p>}
                  <p className="text-xs text-zinc-500 mt-1">{new Date(event.created_at).toLocaleString()}</p>
                </div>
              ))}
              {events.length === 0 && <p className="text-sm text-zinc-500">No service events yet.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Update Status</h3>
            <select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value as RmaStatus)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm mb-3"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
              placeholder="Status note (optional)"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            />
            <Button className="w-full mt-3" onClick={updateStatus} isLoading={isSubmitting}>Save Status</Button>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Add Service Event</h3>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as ServiceEventType)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm mb-3"
            >
              {EVENT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <input
              value={eventSummary}
              onChange={(e) => setEventSummary(e.target.value)}
              placeholder="Summary"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm mb-3"
            />
            <textarea
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              rows={3}
              placeholder="Notes"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            />
            <Button className="w-full mt-3" variant="secondary" onClick={createServiceEvent} isLoading={isSubmitting}>
              Add Event
            </Button>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">AI Recommendation</h3>
            {rmaCase.ai_recommendation ? (
              <div className="mb-3 text-sm">
                <p className="font-medium capitalize">{rmaCase.ai_recommendation.recommendation}</p>
                <p className="text-zinc-600 dark:text-zinc-300">{rmaCase.ai_recommendation.rationale}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Confidence: {Math.round((rmaCase.ai_recommendation.confidence || 0) * 100)}%
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 mb-3">No recommendation generated yet.</p>
            )}
            <Button className="w-full" onClick={generateSuggestion} isLoading={isSubmitting}>
              Generate Recommendation
            </Button>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">HubSpot Ticket Sync</h3>
            <p className="text-xs text-zinc-500 mb-3">Ticket ID: {rmaCase.hubspot_ticket_id || 'Not linked'}</p>
            <Button className="w-full" variant="secondary" onClick={manualSyncHubSpot} isLoading={isSubmitting}>
              Sync Ticket Now
            </Button>
            {syncResult && <p className="text-xs text-zinc-500 mt-2">{syncResult}</p>}
          </Card>
        </div>
      </div>
    </Shell>
  );
}

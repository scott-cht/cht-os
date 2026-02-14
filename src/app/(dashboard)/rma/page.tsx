'use client';

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CameraCapture } from '@/components/lister/CameraCapture';
import { notify } from '@/lib/store/app-store';
import type { ConditionGrade, RmaCase, RmaPriority, RmaSource, RmaStatus, RmaWarrantyStatus } from '@/types';

const RMA_COLUMNS: Array<{ status: RmaStatus; label: string }> = [
  { status: 'received', label: 'Received' },
  { status: 'testing', label: 'Testing' },
  { status: 'sent_to_manufacturer', label: 'Sent to Manufacturer' },
  { status: 'repaired_replaced', label: 'Repaired/Replaced' },
  { status: 'back_to_customer', label: 'Back to Customer' },
];

const CONDITION_GRADES: ConditionGrade[] = ['mint', 'excellent', 'good', 'fair', 'poor'];
const SOURCE_FILTERS: Array<{ value: 'all' | RmaSource; label: string }> = [
  { value: 'all', label: 'All sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'shopify_return_webhook', label: 'Shopify Returns' },
  { value: 'customer_form', label: 'Customer Form' },
];
const WARRANTY_FILTERS: Array<{ value: 'all' | RmaWarrantyStatus; label: string }> = [
  { value: 'all', label: 'Any warranty' },
  { value: 'in_warranty', label: 'In warranty' },
  { value: 'out_of_warranty', label: 'Out of warranty' },
  { value: 'unknown', label: 'Unknown warranty' },
];
const PRIORITY_FILTERS: Array<{ value: 'all' | RmaPriority; label: string }> = [
  { value: 'all', label: 'Any priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];
const LOGISTICS_FILTERS = [
  { value: 'all', label: 'Any logistics' },
  { value: 'needs_inbound_tracking', label: 'Needs inbound tracking' },
  { value: 'needs_outbound_tracking', label: 'Needs outbound tracking' },
  { value: 'outbound_in_transit', label: 'Outbound in transit' },
  { value: 'sla_overdue', label: 'SLA overdue' },
] as const;

type LogisticsFilter = (typeof LOGISTICS_FILTERS)[number]['value'];
type SortMode = 'newest' | 'sla_risk' | 'priority';
type RmaPreset = 'all' | 'my_queue' | 'overdue' | 'needs_outbound_tracking' | 'outbound_in_transit';
type ViewMode = 'kanban' | 'table';

interface RmaKpis {
  total_cases: number;
  open_cases: number;
  overdue_cases: number;
  in_warranty_cases: number;
  warranty_hit_rate_pct: number | null;
  high_priority_cases: number;
  logistics_exception_cases: number;
  logistics_exception_rate_pct: number | null;
  avg_turnaround_days: number | null;
  queue_by_technician: Record<string, number>;
  repeat_issue_serials: Array<{ serial_number: string; case_count: number }>;
}

interface RmaTimeInStageEntry {
  case_id: string;
  status: RmaStatus;
  entered_at: string;
  hours_in_stage: number;
  is_sla_overdue: boolean;
}

interface LogisticsExceptionCase {
  id: string;
  status: RmaStatus;
  issue_summary: string;
  shopify_order_name: string | null;
  serial_number: string | null;
  assigned_technician_email: string | null;
  exception_types: Array<
    'needs_inbound_tracking' | 'needs_outbound_tracking' | 'outbound_in_transit' | 'sla_overdue'
  >;
}

interface LogisticsExceptionSummary {
  needs_inbound_tracking: number;
  needs_outbound_tracking: number;
  outbound_in_transit: number;
  sla_overdue: number;
}

interface RmaCasesResponse {
  error?: string;
  cases?: RmaCase[];
}

interface RmaKpisResponse {
  error?: string;
  kpis?: RmaKpis | null;
}

interface RmaTimeInStageResponse {
  error?: string;
  entries?: RmaTimeInStageEntry[];
}

interface RmaLogisticsExceptionsResponse {
  error?: string;
  exceptions?: LogisticsExceptionCase[];
  summary?: LogisticsExceptionSummary | null;
}

function isSlaOverdue(rmaCase: RmaCase): boolean {
  if (!rmaCase.sla_due_at || rmaCase.status === 'back_to_customer') return false;
  return new Date(rmaCase.sla_due_at).getTime() < Date.now();
}

function matchesLogisticsFilter(rmaCase: RmaCase, filter: LogisticsFilter): boolean {
  switch (filter) {
    case 'needs_inbound_tracking':
      return rmaCase.status === 'received' && !rmaCase.inbound_tracking_number;
    case 'needs_outbound_tracking':
      return rmaCase.status === 'repaired_replaced' && !rmaCase.outbound_tracking_number;
    case 'outbound_in_transit':
      return (
        rmaCase.status === 'back_to_customer' &&
        !!rmaCase.outbound_tracking_number &&
        !rmaCase.delivered_back_at
      );
    case 'sla_overdue':
      return isSlaOverdue(rmaCase);
    default:
      return true;
  }
}

function priorityRank(priority: RmaPriority | null | undefined): number {
  switch (priority) {
    case 'urgent':
      return 4;
    case 'high':
      return 3;
    case 'normal':
      return 2;
    case 'low':
      return 1;
    default:
      return 2;
  }
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

function formatHoursInStage(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return '0h';
  const total = Math.floor(hours);
  const days = Math.floor(total / 24);
  const remHours = total % 24;
  if (days > 0) return `${days}d ${remHours}h`;
  return `${remHours}h`;
}

function formatDue(value: string | null): string {
  if (!value) return 'No SLA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No SLA';
  return date.toLocaleString();
}

function formatExceptionTypeLabel(
  type: 'needs_inbound_tracking' | 'needs_outbound_tracking' | 'outbound_in_transit' | 'sla_overdue'
): string {
  switch (type) {
    case 'needs_inbound_tracking':
      return 'Needs inbound tracking';
    case 'needs_outbound_tracking':
      return 'Needs outbound tracking';
    case 'outbound_in_transit':
      return 'Outbound in transit';
    case 'sla_overdue':
      return 'SLA overdue';
    default:
      return type;
  }
}

function formatStatusLabel(status: RmaStatus): string {
  return status.replaceAll('_', ' ');
}

interface ShopifyOrderListItem {
  id: string;
  name: string;
  orderNumber: number | null;
  customerName: string | null;
  customerEmail: string | null;
  serialCandidates: string[];
}

interface ShopifyOrderDetails {
  order: {
    id: string;
    name: string;
    orderNumber: number | null;
    customer: { name: string | null; email: string | null; phone: string | null };
    serialCandidates: string[];
  };
}

interface AsyncGuard {
  signal?: AbortSignal;
  isActive?: () => boolean;
}

function isGuardActive(guard?: AsyncGuard): boolean {
  const signalActive = !guard?.signal?.aborted;
  const mountActive = guard?.isActive ? guard.isActive() : true;
  return signalActive && mountActive;
}

async function parseJsonResponse<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response (${response.status})`);
  }
}

export default function RmaPage() {
  const [cases, setCases] = useState<RmaCase[]>([]);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [showNewCase, setShowNewCase] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchingOrders, setSearchingOrders] = useState(false);
  const [orderQuery, setOrderQuery] = useState('');
  const [orders, setOrders] = useState<ShopifyOrderListItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<ShopifyOrderDetails['order'] | null>(null);
  const [issueSummary, setIssueSummary] = useState('');
  const [issueDetails, setIssueDetails] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [conditionReport, setConditionReport] = useState('');
  const [conditionGrade, setConditionGrade] = useState<ConditionGrade | null>(null);
  const [arrivalImages, setArrivalImages] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | RmaSource>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<'all' | RmaWarrantyStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | RmaPriority>('all');
  const [logisticsFilter, setLogisticsFilter] = useState<LogisticsFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('sla_risk');
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [slaDraftByCaseId, setSlaDraftByCaseId] = useState<Record<string, string>>({});
  const [bulkSlaDueAt, setBulkSlaDueAt] = useState('');
  const [bulkStatus, setBulkStatus] = useState<RmaStatus>('testing');
  const [bulkStatusNote, setBulkStatusNote] = useState('');
  const [queueTechnicianEmail, setQueueTechnicianEmail] = useState('');
  const [myQueueOnly, setMyQueueOnly] = useState(false);
  const [bulkTechnicianName, setBulkTechnicianName] = useState('');
  const [bulkTechnicianEmail, setBulkTechnicianEmail] = useState('');
  const [bulkOwnerName, setBulkOwnerName] = useState('');
  const [bulkOwnerEmail, setBulkOwnerEmail] = useState('');
  const [activePreset, setActivePreset] = useState<RmaPreset>('all');
  const [kpis, setKpis] = useState<RmaKpis | null>(null);
  const [timeInStageByCaseId, setTimeInStageByCaseId] = useState<Record<string, RmaTimeInStageEntry>>({});
  const [logisticsExceptions, setLogisticsExceptions] = useState<LogisticsExceptionCase[]>([]);
  const [logisticsSummary, setLogisticsSummary] = useState<LogisticsExceptionSummary | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  useEffect(() => {
    const savedQueueEmail = window.localStorage.getItem('rma.queueTechnicianEmail');
    if (savedQueueEmail) setQueueTechnicianEmail(savedQueueEmail);
    const savedMyQueueOnly = window.localStorage.getItem('rma.myQueueOnly');
    if (savedMyQueueOnly === 'true') setMyQueueOnly(true);
    const savedViewMode = window.localStorage.getItem('rma.viewMode');
    if (savedViewMode === 'kanban' || savedViewMode === 'table') {
      setViewMode(savedViewMode);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('rma.queueTechnicianEmail', queueTechnicianEmail);
  }, [queueTechnicianEmail]);

  useEffect(() => {
    window.localStorage.setItem('rma.myQueueOnly', myQueueOnly ? 'true' : 'false');
  }, [myQueueOnly]);

  useEffect(() => {
    window.localStorage.setItem('rma.viewMode', viewMode);
  }, [viewMode]);

  const buildFilterQuery = useCallback(() => {
    const query = new URLSearchParams({ limit: '100' });
    if (sourceFilter !== 'all') query.set('source', sourceFilter);
    if (warrantyFilter !== 'all') query.set('warranty_status', warrantyFilter);
    if (priorityFilter !== 'all') query.set('priority', priorityFilter);
    if (myQueueOnly && queueTechnicianEmail.trim()) {
      query.set('my_queue_email', queueTechnicianEmail.trim().toLowerCase());
    }
    return query;
  }, [sourceFilter, warrantyFilter, priorityFilter, myQueueOnly, queueTechnicianEmail]);

  const fetchCases = useCallback(async (guard?: AsyncGuard) => {
    setIsLoadingCases(true);
    try {
      const query = buildFilterQuery();
      const response = await fetch(`/api/rma?${query.toString()}`, { signal: guard?.signal });
      const data = await parseJsonResponse<RmaCasesResponse>(response);
      if (data.error) {
        throw new Error(data.error);
      }
      if (!isGuardActive(guard)) return;
      setCases(data.cases || []);
      setSlaDraftByCaseId((prev) => {
        const next: Record<string, string> = { ...prev };
        (data.cases || []).forEach((rmaCase: RmaCase) => {
          if (!(rmaCase.id in next)) {
            next[rmaCase.id] = toLocalDateTimeValue(rmaCase.sla_due_at);
          }
        });
        return next;
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!isGuardActive(guard)) return;
      notify.error('Failed to load RMA cases', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      if (!isGuardActive(guard)) return;
      setIsLoadingCases(false);
    }
  }, [buildFilterQuery]);

  const fetchKpis = useCallback(async (guard?: AsyncGuard) => {
    try {
      const query = buildFilterQuery();
      query.delete('limit');
      const response = await fetch(`/api/rma/kpis?${query.toString()}`, { signal: guard?.signal });
      const data = await parseJsonResponse<RmaKpisResponse>(response);
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to load KPI summary');
      }
      if (!isGuardActive(guard)) return;
      setKpis(data.kpis || null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!isGuardActive(guard)) return;
      notify.error('Failed to load KPI summary', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [buildFilterQuery]);

  const fetchTimeInStage = useCallback(async (guard?: AsyncGuard) => {
    try {
      const query = buildFilterQuery();
      query.delete('limit');
      const response = await fetch(`/api/rma/time-in-stage?${query.toString()}`, { signal: guard?.signal });
      const data = await parseJsonResponse<RmaTimeInStageResponse>(response);
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to load time-in-stage metrics');
      }
      const nextMap: Record<string, RmaTimeInStageEntry> = {};
      (data.entries || []).forEach((entry: RmaTimeInStageEntry) => {
        nextMap[entry.case_id] = entry;
      });
      if (!isGuardActive(guard)) return;
      setTimeInStageByCaseId(nextMap);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!isGuardActive(guard)) return;
      notify.error('Failed to load stage timing', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [buildFilterQuery]);

  const fetchLogisticsExceptions = useCallback(async (guard?: AsyncGuard) => {
    try {
      const query = buildFilterQuery();
      query.delete('limit');
      const response = await fetch(`/api/rma/logistics-exceptions?${query.toString()}`, { signal: guard?.signal });
      const data = await parseJsonResponse<RmaLogisticsExceptionsResponse>(response);
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to load logistics exceptions');
      }
      if (!isGuardActive(guard)) return;
      setLogisticsExceptions((data.exceptions || []) as LogisticsExceptionCase[]);
      setLogisticsSummary((data.summary || null) as LogisticsExceptionSummary | null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!isGuardActive(guard)) return;
      notify.error('Failed to load logistics exceptions', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [buildFilterQuery]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const guard: AsyncGuard = {
      signal: controller.signal,
      isActive: () => mounted,
    };

    fetchCases(guard);
    fetchKpis(guard);
    fetchTimeInStage(guard);
    fetchLogisticsExceptions(guard);

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [fetchCases, fetchKpis, fetchTimeInStage, fetchLogisticsExceptions]);

  const visibleCases = useMemo(() => {
    const filtered = cases.filter((rmaCase) => matchesLogisticsFilter(rmaCase, logisticsFilter));

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      if (sortMode === 'priority') {
        const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      // SLA risk sort
      const overdueA = isSlaOverdue(a) ? 1 : 0;
      const overdueB = isSlaOverdue(b) ? 1 : 0;
      if (overdueA !== overdueB) return overdueB - overdueA;

      const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
      if (priorityDiff !== 0) return priorityDiff;

      const dueA = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const dueB = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) return dueA - dueB;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return sorted;
  }, [cases, logisticsFilter, sortMode]);

  const groupedCases = useMemo(() => {
    return RMA_COLUMNS.reduce<Record<RmaStatus, RmaCase[]>>((acc, column) => {
      acc[column.status] = visibleCases.filter((c) => c.status === column.status);
      return acc;
    }, {
      received: [],
      testing: [],
      sent_to_manufacturer: [],
      repaired_replaced: [],
      back_to_customer: [],
    });
  }, [visibleCases]);

  const exceptionTypesByCaseId = useMemo(() => {
    const next: Record<string, LogisticsExceptionCase['exception_types']> = {};
    logisticsExceptions.forEach((item) => {
      next[item.id] = item.exception_types;
    });
    return next;
  }, [logisticsExceptions]);

  const summary = useMemo(() => {
    const total = visibleCases.length;
    const overdue = visibleCases.filter((rmaCase) => isSlaOverdue(rmaCase)).length;
    const inWarranty = visibleCases.filter((rmaCase) => rmaCase.warranty_status === 'in_warranty').length;
    const highPriority = visibleCases.filter(
      (rmaCase) => rmaCase.priority === 'high' || rmaCase.priority === 'urgent'
    ).length;
    return { total, overdue, inWarranty, highPriority };
  }, [visibleCases]);

  const handleOrderSearch = async () => {
    setSearchingOrders(true);
    try {
      const response = await fetch(`/api/rma/orders?search=${encodeURIComponent(orderQuery)}&limit=20`);
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setOrders(data.orders || []);
    } catch (error) {
      notify.error('Order search failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSearchingOrders(false);
    }
  };

  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    try {
      const response = await fetch(`/api/rma/orders/${encodeURIComponent(orderId)}`);
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      const order = data.order as ShopifyOrderDetails['order'];
      setSelectedOrderDetail(order);
      const preferredSerial = order.serialCandidates?.[0] || '';
      setSerialNumber(preferredSerial);
    } catch (error) {
      notify.error('Failed to load order details', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const resetForm = () => {
    setOrderQuery('');
    setOrders([]);
    setSelectedOrderId('');
    setSelectedOrderDetail(null);
    setIssueSummary('');
    setIssueDetails('');
    setSerialNumber('');
    setConditionReport('');
    setConditionGrade(null);
    setArrivalImages([]);
    setCaptureOpen(false);
  };

  const handleCreateCase = async () => {
    if (!selectedOrderDetail || !issueSummary.trim()) {
      notify.error('Missing required fields', 'Select an order and enter issue summary');
      return;
    }
    setIsCreating(true);
    try {
      const payload = {
        shopify_order_id: selectedOrderDetail.id,
        shopify_order_name: selectedOrderDetail.name,
        shopify_order_number: selectedOrderDetail.orderNumber,
        serial_number: serialNumber || null,
        customer_name: selectedOrderDetail.customer.name,
        customer_email: selectedOrderDetail.customer.email,
        customer_phone: selectedOrderDetail.customer.phone,
        issue_summary: issueSummary,
        issue_details: issueDetails || null,
        arrival_condition_report: conditionReport || null,
        arrival_condition_grade: conditionGrade,
        arrival_condition_images: arrivalImages,
        source: 'manual',
        submission_channel: 'internal_dashboard',
      };
      const response = await fetch('/api/rma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      notify.success('RMA case created', data.hubspotTicketSync?.success ? 'HubSpot ticket linked' : 'Case saved');
      setShowNewCase(false);
      resetForm();
      fetchCases();
    } catch (error) {
      notify.error('Failed to create RMA case', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsCreating(false);
    }
  };

  const quickUpdateCase = async (
    caseId: string,
    payload: Partial<
      Pick<
        RmaCase,
        | 'priority'
        | 'warranty_status'
        | 'warranty_basis'
        | 'warranty_checked_at'
        | 'assigned_owner_name'
        | 'assigned_owner_email'
        | 'assigned_technician_name'
        | 'assigned_technician_email'
        | 'assigned_at'
      >
    >
  ) => {
    try {
      const response = await fetch(`/api/rma/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to update case');
      }
      notify.success('Case updated', 'Quick action saved');
      fetchCases();
    } catch (error) {
      notify.error('Quick action failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const toggleCaseSelection = (caseId: string) => {
    setSelectedCaseIds((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  };

  const selectAllVisibleCases = () => {
    setSelectedCaseIds(visibleCases.map((rmaCase) => rmaCase.id));
  };

  const clearSelection = () => {
    setSelectedCaseIds([]);
  };

  const applyBulkUpdate = async (
    payload: Partial<Pick<RmaCase, 'priority' | 'warranty_status' | 'warranty_basis' | 'warranty_checked_at'>>
  ) => {
    if (selectedCaseIds.length === 0) {
      notify.error('No cases selected', 'Select one or more cases first');
      return;
    }
    setIsBulkUpdating(true);
    try {
      const results = await Promise.all(
        selectedCaseIds.map(async (caseId) => {
          const response = await fetch(`/api/rma/${caseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const body = await response.json();
          if (!response.ok || body.error) {
            throw new Error(body.error || `Failed updating case ${caseId}`);
          }
          return caseId;
        })
      );
      notify.success('Bulk update complete', `Updated ${results.length} case(s)`);
      clearSelection();
      fetchCases();
    } catch (error) {
      notify.error('Bulk update failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const applyBulkStatusUpdate = async () => {
    if (selectedCaseIds.length === 0) {
      notify.error('No cases selected', 'Select one or more cases first');
      return;
    }
    setIsBulkUpdating(true);
    try {
      const results = await Promise.all(
        selectedCaseIds.map(async (caseId) => {
          const response = await fetch(`/api/rma/${caseId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: bulkStatus,
              note: bulkStatusNote || null,
            }),
          });
          const body = await response.json();
          if (!response.ok || body.error) {
            throw new Error(body.error || `Failed status update for case ${caseId}`);
          }
          return caseId;
        })
      );
      notify.success('Bulk status update complete', `Updated ${results.length} case(s)`);
      clearSelection();
      setBulkStatusNote('');
      fetchCases();
    } catch (error) {
      notify.error('Bulk status update failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const applyBulkAssignment = async () => {
    if (selectedCaseIds.length === 0) {
      notify.error('No cases selected', 'Select one or more cases first');
      return;
    }
    if (!bulkTechnicianEmail.trim() && !bulkOwnerEmail.trim()) {
      notify.error('Assignment details missing', 'Provide at least technician or owner email');
      return;
    }

    const payload: Partial<RmaCase> = {
      assigned_technician_name: bulkTechnicianName.trim() || null,
      assigned_technician_email: bulkTechnicianEmail.trim().toLowerCase() || null,
      assigned_owner_name: bulkOwnerName.trim() || null,
      assigned_owner_email: bulkOwnerEmail.trim().toLowerCase() || null,
      assigned_at: new Date().toISOString(),
    };

    setIsBulkUpdating(true);
    try {
      const results = await Promise.all(
        selectedCaseIds.map(async (caseId) => {
          const response = await fetch(`/api/rma/${caseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const body = await response.json();
          if (!response.ok || body.error) {
            throw new Error(body.error || `Failed assignment update for case ${caseId}`);
          }
          return caseId;
        })
      );
      notify.success('Bulk assignment complete', `Updated ${results.length} case(s)`);
      clearSelection();
      fetchCases();
    } catch (error) {
      notify.error('Bulk assignment failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const saveSlaDueAt = async (caseId: string) => {
    try {
      const response = await fetch(`/api/rma/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sla_due_at: toIsoFromLocalDateTime(slaDraftByCaseId[caseId] || ''),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to update SLA due date');
      }
      notify.success('SLA updated', 'Case due date saved');
      fetchCases();
    } catch (error) {
      notify.error('SLA update failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const applyBulkSlaDueAt = async () => {
    if (selectedCaseIds.length === 0) {
      notify.error('No cases selected', 'Select one or more cases first');
      return;
    }
    const slaIso = toIsoFromLocalDateTime(bulkSlaDueAt);
    if (!slaIso) {
      notify.error('Invalid SLA date', 'Choose a valid SLA due date and time');
      return;
    }

    setIsBulkUpdating(true);
    try {
      const results = await Promise.all(
        selectedCaseIds.map(async (caseId) => {
          const response = await fetch(`/api/rma/${caseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sla_due_at: slaIso }),
          });
          const body = await response.json();
          if (!response.ok || body.error) {
            throw new Error(body.error || `Failed SLA update for case ${caseId}`);
          }
          return caseId;
        })
      );
      notify.success('Bulk SLA update complete', `Updated ${results.length} case(s)`);
      fetchCases();
    } catch (error) {
      notify.error('Bulk SLA update failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const applyPreset = (preset: RmaPreset) => {
    setActivePreset(preset);
    if (preset === 'all') {
      setMyQueueOnly(false);
      setLogisticsFilter('all');
      return;
    }
    if (preset === 'my_queue') {
      setMyQueueOnly(true);
      setLogisticsFilter('all');
      return;
    }
    if (preset === 'overdue') {
      setMyQueueOnly(false);
      setLogisticsFilter('sla_overdue');
      setSortMode('sla_risk');
      return;
    }
    if (preset === 'needs_outbound_tracking') {
      setMyQueueOnly(false);
      setLogisticsFilter('needs_outbound_tracking');
      return;
    }
    if (preset === 'outbound_in_transit') {
      setMyQueueOnly(false);
      setLogisticsFilter('outbound_in_transit');
      setSortMode('newest');
    }
  };

  return (
    <Shell title="RMA & Service" subtitle="Returns, repairs, and serial service passport">
      <Card className="mb-4 rounded-2xl border-emerald-200/70 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-cyan-950/20 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">Service Operations</p>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">RMA Pipeline</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">Triage exceptions, keep SLA on track, and close customer loops faster.</p>
          </div>
          <Button size="lg" className="shadow-sm" onClick={() => setShowNewCase((v) => !v)}>
            {showNewCase ? 'Close Intake' : 'New RMA Case'}
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-xl border border-white/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/60 px-3 py-2">
            <p className="text-[11px] text-zinc-500">Visible Cases</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-red-200/70 dark:border-red-800/60 bg-white/80 dark:bg-zinc-900/60 px-3 py-2">
            <p className="text-[11px] text-zinc-500">SLA Overdue</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">{summary.overdue}</p>
          </div>
          <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 bg-white/80 dark:bg-zinc-900/60 px-3 py-2">
            <p className="text-[11px] text-zinc-500">In Warranty</p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{summary.inWarranty}</p>
          </div>
          <div className="rounded-xl border border-amber-200/70 dark:border-amber-800/60 bg-white/80 dark:bg-zinc-900/60 px-3 py-2">
            <p className="text-[11px] text-zinc-500">High/Urgent</p>
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{summary.highPriority}</p>
          </div>
        </div>
      </Card>

      {showNewCase && (
        <Card className="mb-4 rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Create RMA Case</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Input
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              placeholder="Search Shopify orders (name, email, order #)"
            />
            <Button variant="secondary" onClick={handleOrderSearch} isLoading={searchingOrders}>
              Search Orders
            </Button>
          </div>

          {orders.length > 0 && (
            <div className="mb-4 border border-zinc-200 dark:border-zinc-700 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-700">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => handleSelectOrder(order.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                    selectedOrderId === order.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {order.name} · {order.customerName || 'Unknown customer'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {order.customerEmail || 'No email'} · Serial hints: {order.serialCandidates.join(', ') || 'none'}
                  </p>
                </button>
              ))}
            </div>
          )}

          {selectedOrderDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input value={selectedOrderDetail.name} disabled />
                <Input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Serial number"
                />
              </div>
              <Input
                value={issueSummary}
                onChange={(e) => setIssueSummary(e.target.value)}
                placeholder="Issue summary (required)"
              />
              <textarea
                value={issueDetails}
                onChange={(e) => setIssueDetails(e.target.value)}
                rows={3}
                placeholder="Issue details"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2"
              />
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Arrival Condition Grade</p>
                <div className="flex flex-wrap gap-2">
                  {CONDITION_GRADES.map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setConditionGrade(grade)}
                      className={`px-3 py-1.5 rounded-full border text-xs capitalize ${
                        conditionGrade === grade
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-zinc-300 dark:border-zinc-600'
                      }`}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={conditionReport}
                onChange={(e) => setConditionReport(e.target.value)}
                rows={3}
                placeholder="Arrival condition notes"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2"
              />

              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => setCaptureOpen((v) => !v)}>
                  {captureOpen ? 'Close Camera' : 'Capture Arrival Photos'}
                </Button>
                <span className="text-xs text-zinc-500">{arrivalImages.length} photo(s) attached</span>
              </div>

              {captureOpen && (
                <div className="rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
                  <CameraCapture
                    onCapture={(imageData, allImages) => {
                      setArrivalImages(allImages || [imageData]);
                      setCaptureOpen(false);
                    }}
                    onCancel={() => setCaptureOpen(false)}
                    multiple={true}
                    maxPhotos={10}
                  />
                </div>
              )}

              {arrivalImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {arrivalImages.map((img, idx) => (
                    <img key={idx} src={img} alt={`Arrival ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg" />
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={resetForm}>Reset</Button>
                <Button onClick={handleCreateCase} isLoading={isCreating}>Create RMA Case</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="mb-4 sticky top-16 z-10 rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-900/95 shadow-sm py-2.5 backdrop-blur">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
          <div className="xl:col-span-9 flex flex-wrap items-center gap-1.5">
            <label className="text-xs text-zinc-500 inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={myQueueOnly}
                onChange={(e) => setMyQueueOnly(e.target.checked)}
              />
              My Queue
            </label>
            <Input
              value={queueTechnicianEmail}
              onChange={(e) => setQueueTechnicianEmail(e.target.value)}
              placeholder="Technician email"
              className="w-44 h-9"
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-9 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 text-xs"
            >
              <option value="sla_risk">Sort: SLA risk</option>
              <option value="priority">Sort: Priority</option>
              <option value="newest">Sort: Newest</option>
            </select>
            <select
              value={logisticsFilter}
              onChange={(e) => setLogisticsFilter(e.target.value as LogisticsFilter)}
              className="h-9 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 text-xs"
            >
              {LOGISTICS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={warrantyFilter}
              onChange={(e) => setWarrantyFilter(e.target.value as 'all' | RmaWarrantyStatus)}
              className="h-9 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 text-xs"
            >
              {WARRANTY_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'all' | RmaPriority)}
              className="h-9 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 text-xs"
            >
              {PRIORITY_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | RmaSource)}
              className="h-9 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 text-xs"
            >
              {SOURCE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="xl:col-span-3 flex items-center justify-start xl:justify-end gap-2">
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-2.5 py-1 text-xs rounded ${
                  viewMode === 'kanban'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-300'
                }`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-xs rounded ${
                  viewMode === 'table'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-300'
                }`}
              >
                Table
              </button>
            </div>
            <span className="text-xs text-zinc-500">View: {viewMode === 'kanban' ? 'Kanban' : 'Table'}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-9 space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-900/50 p-1.5">
            <Button variant={activePreset === 'all' ? 'primary' : 'ghost'} onClick={() => applyPreset('all')}>All</Button>
            <Button variant={activePreset === 'my_queue' ? 'primary' : 'ghost'} onClick={() => applyPreset('my_queue')}>My Queue</Button>
            <Button variant={activePreset === 'overdue' ? 'primary' : 'ghost'} onClick={() => applyPreset('overdue')}>Overdue</Button>
            <Button
              variant={activePreset === 'needs_outbound_tracking' ? 'primary' : 'ghost'}
              onClick={() => applyPreset('needs_outbound_tracking')}
            >
              Needs Outbound Tracking
            </Button>
            <Button
              variant={activePreset === 'outbound_in_transit' ? 'primary' : 'ghost'}
              onClick={() => applyPreset('outbound_in_transit')}
            >
              Outbound In Transit
            </Button>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="ghost" onClick={selectAllVisibleCases}>Select Visible</Button>
              <Button variant="ghost" onClick={clearSelection}>Clear Selection</Button>
              <span className="text-[11px] rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-zinc-500">{selectedCaseIds.length} selected</span>
            </div>
          </div>

          {selectedCaseIds.length > 0 && (
            <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm py-3">
              <div className="mb-2">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Bulk action console</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as RmaStatus)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs"
            >
              {RMA_COLUMNS.map((column) => (
                <option key={column.status} value={column.status}>
                  Move to: {column.label}
                </option>
              ))}
            </select>
            <Input
              value={bulkStatusNote}
              onChange={(e) => setBulkStatusNote(e.target.value)}
              placeholder="Bulk status note (optional)"
              className="w-60"
            />
            <Button
              variant="secondary"
              isLoading={isBulkUpdating}
              onClick={applyBulkStatusUpdate}
            >
              Bulk Move Status
            </Button>
            <input
              type="datetime-local"
              value={bulkSlaDueAt}
              onChange={(e) => setBulkSlaDueAt(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-xs"
            />
            <Button
              variant="secondary"
              isLoading={isBulkUpdating}
              onClick={applyBulkSlaDueAt}
            >
              Bulk Set SLA
            </Button>
            <Input
              value={bulkTechnicianName}
              onChange={(e) => setBulkTechnicianName(e.target.value)}
              placeholder="Technician name"
              className="w-40"
            />
            <Input
              value={bulkTechnicianEmail}
              onChange={(e) => setBulkTechnicianEmail(e.target.value)}
              placeholder="Technician email"
              className="w-48"
            />
            <Input
              value={bulkOwnerName}
              onChange={(e) => setBulkOwnerName(e.target.value)}
              placeholder="Owner name"
              className="w-40"
            />
            <Input
              value={bulkOwnerEmail}
              onChange={(e) => setBulkOwnerEmail(e.target.value)}
              placeholder="Owner email"
              className="w-48"
            />
            <Button
              variant="secondary"
              isLoading={isBulkUpdating}
              onClick={applyBulkAssignment}
            >
              Bulk Assign
            </Button>
            <Button
              variant="secondary"
              isLoading={isBulkUpdating}
              onClick={() => applyBulkUpdate({ priority: 'urgent' })}
            >
              Bulk Mark Urgent
            </Button>
            <Button
              variant="secondary"
              isLoading={isBulkUpdating}
              onClick={() =>
                applyBulkUpdate({
                  warranty_status: 'out_of_warranty',
                  warranty_basis: 'manual_override',
                  warranty_checked_at: new Date().toISOString(),
                })
              }
            >
              Bulk Mark OOW
            </Button>
              </div>
            </Card>
          )}

        </div>

      </div>

      {isLoadingCases ? (
        <Card><p className="text-sm text-zinc-500">Loading RMA cases...</p></Card>
      ) : (
        viewMode === 'kanban' ? (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {RMA_COLUMNS.map((column) => (
              <Card key={column.status} className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/70">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{column.label}</p>
                  <p className="text-xs text-zinc-500">{groupedCases[column.status].length} case(s)</p>
                </div>
                <div className="p-2 space-y-2 min-h-[220px] max-h-[62vh] overflow-y-auto">
                  {groupedCases[column.status].map((rmaCase) => (
                    <div
                      key={rmaCase.id}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/70 p-3 hover:border-emerald-400 hover:shadow-sm transition-all"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={selectedCaseIds.includes(rmaCase.id)}
                            onChange={() => toggleCaseSelection(rmaCase.id)}
                          />
                          Select
                        </label>
                      </div>
                      <Link href={`/rma/${rmaCase.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">{rmaCase.issue_summary}</p>
                          <span className="text-[10px] inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-600 dark:text-zinc-300 capitalize whitespace-nowrap">
                            {formatStatusLabel(rmaCase.status)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{rmaCase.shopify_order_name || rmaCase.shopify_order_id}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="text-[10px] inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-600 dark:text-zinc-300">
                            {rmaCase.source === 'shopify_return_webhook'
                              ? 'Shopify Return'
                              : rmaCase.source === 'customer_form'
                                ? 'Customer Form'
                                : 'Manual'}
                          </span>
                          <span className="text-[10px] inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-600 dark:text-zinc-300">
                            Priority: {rmaCase.priority || 'normal'}
                          </span>
                          <span className="text-[10px] inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-600 dark:text-zinc-300">
                            Warranty: {(rmaCase.warranty_status || 'unknown').replaceAll('_', ' ')}
                          </span>
                          {isSlaOverdue(rmaCase) && (
                            <span className="text-[10px] inline-flex rounded-full bg-red-100 dark:bg-red-900/20 px-2 py-0.5 text-red-700 dark:text-red-300">
                              SLA Overdue
                            </span>
                          )}
                          {timeInStageByCaseId[rmaCase.id] && (
                            <span
                              className={`text-[10px] inline-flex rounded-full px-2 py-0.5 ${
                                timeInStageByCaseId[rmaCase.id].hours_in_stage >= 120
                                  ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                  : timeInStageByCaseId[rmaCase.id].hours_in_stage >= 48
                                    ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                              }`}
                            >
                              In stage: {formatHoursInStage(timeInStageByCaseId[rmaCase.id].hours_in_stage)}
                            </span>
                          )}
                          {(exceptionTypesByCaseId[rmaCase.id] || []).map((type) => (
                            <span
                              key={`${rmaCase.id}-${type}`}
                              className="text-[10px] inline-flex rounded-full bg-rose-100 dark:bg-rose-900/20 px-2 py-0.5 text-rose-700 dark:text-rose-300"
                            >
                              {formatExceptionTypeLabel(type)}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          {rmaCase.serial_number || 'No serial'} · {rmaCase.customer_name || rmaCase.customer_email || 'Unknown customer'}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Tech: {rmaCase.assigned_technician_name || rmaCase.assigned_technician_email || 'Unassigned'}
                        </p>
                        {rmaCase.shopify_return_id && (
                          <p className="text-[10px] text-zinc-500 mt-1">Return ID: {rmaCase.shopify_return_id}</p>
                        )}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => quickUpdateCase(rmaCase.id, { priority: 'urgent' })}
                          className="text-[10px] rounded border border-amber-400 px-2 py-0.5 text-amber-700 dark:text-amber-300"
                        >
                          Mark Urgent
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            quickUpdateCase(rmaCase.id, {
                              warranty_status: 'out_of_warranty',
                              warranty_basis: 'manual_override',
                              warranty_checked_at: new Date().toISOString(),
                            })
                          }
                          className="text-[10px] rounded border border-rose-400 px-2 py-0.5 text-rose-700 dark:text-rose-300"
                        >
                          Mark OOW
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            quickUpdateCase(rmaCase.id, {
                              assigned_technician_email: queueTechnicianEmail.trim().toLowerCase() || null,
                              assigned_technician_name: null,
                              assigned_at: new Date().toISOString(),
                            })
                          }
                          className="text-[10px] rounded border border-indigo-400 px-2 py-0.5 text-indigo-700 dark:text-indigo-300"
                        >
                          Assign to My Queue
                        </button>
                      </div>
                      <div className="mt-2 space-y-1">
                        <label className="text-[10px] text-zinc-500">SLA due</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="datetime-local"
                            value={slaDraftByCaseId[rmaCase.id] || ''}
                            onChange={(e) =>
                              setSlaDraftByCaseId((prev) => ({
                                ...prev,
                                [rmaCase.id]: e.target.value,
                              }))
                            }
                            className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-[10px]"
                          />
                          <button
                            type="button"
                            onClick={() => saveSlaDueAt(rmaCase.id)}
                            className="text-[10px] rounded border border-emerald-400 px-2 py-1 text-emerald-700 dark:text-emerald-300"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {groupedCases[column.status].length === 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-900/40 px-3 py-6 text-center">
                      <p className="text-xs font-medium text-zinc-500">No cases in {column.label.toLowerCase()}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">Adjust filters or presets to surface matching work.</p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm p-0 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100/90 dark:bg-zinc-800/80">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Table view - fast triage mode</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-100/95 dark:bg-zinc-800/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-700">
                  <tr className="text-left text-xs font-medium text-zinc-500">
                    <th className="px-3 py-2">Sel</th>
                    <th className="px-3 py-2">Issue</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Customer / Serial</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Warranty</th>
                    <th className="px-3 py-2">SLA</th>
                    <th className="px-3 py-2">Exceptions</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCases.map((rmaCase) => (
                    <tr key={rmaCase.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top odd:bg-white even:bg-zinc-50/40 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedCaseIds.includes(rmaCase.id)}
                          onChange={() => toggleCaseSelection(rmaCase.id)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/rma/${rmaCase.id}`} className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-emerald-600">
                          {rmaCase.issue_summary}
                        </Link>
                        <p className="text-xs text-zinc-500 mt-1">{rmaCase.shopify_order_name || rmaCase.shopify_order_id}</p>
                      </td>
                      <td className="px-3 py-2 text-xs capitalize">{formatStatusLabel(rmaCase.status)}</td>
                      <td className="px-3 py-2 text-xs">
                        <p>{rmaCase.customer_name || rmaCase.customer_email || 'Unknown customer'}</p>
                        <p className="text-zinc-500">{rmaCase.serial_number || 'No serial'}</p>
                      </td>
                      <td className="px-3 py-2 text-xs capitalize">{rmaCase.priority || 'normal'}</td>
                      <td className="px-3 py-2 text-xs capitalize">{(rmaCase.warranty_status || 'unknown').replaceAll('_', ' ')}</td>
                      <td className="px-3 py-2 text-xs">
                        <p>{formatDue(rmaCase.sla_due_at)}</p>
                        {timeInStageByCaseId[rmaCase.id] && (
                          <p className="text-zinc-500">In stage: {formatHoursInStage(timeInStageByCaseId[rmaCase.id].hours_in_stage)}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(exceptionTypesByCaseId[rmaCase.id] || []).map((type) => (
                            <span
                              key={`${rmaCase.id}-tbl-${type}`}
                              className="text-[10px] inline-flex rounded-full bg-rose-100 dark:bg-rose-900/20 px-2 py-0.5 text-rose-700 dark:text-rose-300"
                            >
                              {formatExceptionTypeLabel(type)}
                            </span>
                          ))}
                          {(exceptionTypesByCaseId[rmaCase.id] || []).length === 0 && (
                            <span className="text-[10px] text-zinc-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => quickUpdateCase(rmaCase.id, { priority: 'urgent' })}
                            className="text-[10px] rounded border border-amber-400 px-2 py-0.5 text-amber-700 dark:text-amber-300"
                          >
                            Urgent
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              quickUpdateCase(rmaCase.id, {
                                assigned_technician_email: queueTechnicianEmail.trim().toLowerCase() || null,
                                assigned_technician_name: null,
                                assigned_at: new Date().toISOString(),
                              })
                            }
                            className="text-[10px] rounded border border-indigo-400 px-2 py-0.5 text-indigo-700 dark:text-indigo-300"
                          >
                            Assign me
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleCases.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center">
                        <p className="text-xs font-medium text-zinc-500">No cases match current filters.</p>
                        <p className="mt-1 text-[11px] text-zinc-400">Try resetting presets or broadening logistics filters.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {kpis && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm py-3">
            <p className="text-xs text-zinc-500">Open / Overdue (Global)</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{kpis.open_cases}</p>
            <p className="text-xs text-red-600 dark:text-red-400">{kpis.overdue_cases} overdue</p>
          </Card>
          <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm py-3">
            <p className="text-xs text-zinc-500">My Queue Count</p>
            <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
              {queueTechnicianEmail.trim()
                ? (kpis.queue_by_technician[queueTechnicianEmail.trim().toLowerCase()] || 0)
                : 0}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {queueTechnicianEmail.trim() || 'Set technician email'}
            </p>
          </Card>
          <Card className="rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm py-3">
            <p className="text-xs text-zinc-500">Performance Snapshot</p>
            <div className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
              <p>Warranty hit rate: <span className="font-medium text-emerald-600 dark:text-emerald-400">{kpis.warranty_hit_rate_pct == null ? 'N/A' : `${kpis.warranty_hit_rate_pct.toFixed(1)}%`}</span></p>
              <p>Exception rate: <span className="font-medium text-rose-600 dark:text-rose-400">{kpis.logistics_exception_rate_pct == null ? 'N/A' : `${kpis.logistics_exception_rate_pct.toFixed(1)}%`}</span></p>
              <p>Avg turnaround: <span className="font-medium text-zinc-900 dark:text-zinc-100">{kpis.avg_turnaround_days == null ? 'N/A' : `${kpis.avg_turnaround_days.toFixed(1)}d`}</span></p>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">
              Top repeat serial: {kpis.repeat_issue_serials[0]?.serial_number || 'None'}
            </p>
          </Card>
        </div>
      )}

      <Card className="mt-4 rounded-2xl border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Logistics Exceptions</h3>
            <p className="text-xs text-zinc-500">Immediate blockers from current filter scope.</p>
          </div>
          {logisticsSummary && (
            <p className="text-[11px] text-zinc-500">
              Inbound: {logisticsSummary.needs_inbound_tracking} · Outbound: {logisticsSummary.needs_outbound_tracking} ·
              Transit: {logisticsSummary.outbound_in_transit} · SLA: {logisticsSummary.sla_overdue}
            </p>
          )}
        </div>
        {logisticsExceptions.length === 0 ? (
          <p className="text-xs text-zinc-500">No logistics exceptions in scope.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {logisticsExceptions.slice(0, 9).map((exceptionCase) => (
              <Link
                key={exceptionCase.id}
                href={`/rma/${exceptionCase.id}`}
                className="block rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 p-3 hover:border-emerald-400 hover:shadow-sm transition-all"
              >
                <p className="text-xs text-zinc-500">{exceptionCase.shopify_order_name || 'Unknown order'}</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">
                  {exceptionCase.issue_summary}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {exceptionCase.serial_number || 'No serial'} · {exceptionCase.assigned_technician_email || 'Unassigned'}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {exceptionCase.exception_types.map((type) => (
                    <span
                      key={`${exceptionCase.id}-${type}`}
                      className="text-[10px] inline-flex rounded-full bg-rose-100 dark:bg-rose-900/20 px-2 py-0.5 text-rose-700 dark:text-rose-300"
                    >
                      {formatExceptionTypeLabel(type)}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </Shell>
  );
}

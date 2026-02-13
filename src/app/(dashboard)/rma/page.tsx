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
import type { ConditionGrade, RmaCase, RmaStatus } from '@/types';

const RMA_COLUMNS: Array<{ status: RmaStatus; label: string }> = [
  { status: 'received', label: 'Received' },
  { status: 'testing', label: 'Testing' },
  { status: 'sent_to_manufacturer', label: 'Sent to Manufacturer' },
  { status: 'repaired_replaced', label: 'Repaired/Replaced' },
  { status: 'back_to_customer', label: 'Back to Customer' },
];

const CONDITION_GRADES: ConditionGrade[] = ['mint', 'excellent', 'good', 'fair', 'poor'];

interface ShopifyOrderListItem {
  id: string;
  name: string;
  orderNumber: number;
  customerName: string | null;
  customerEmail: string | null;
  serialCandidates: string[];
}

interface ShopifyOrderDetails {
  order: {
    id: string;
    name: string;
    orderNumber: number;
    customer: { name: string | null; email: string | null; phone: string | null };
    serialCandidates: string[];
  };
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

  const fetchCases = useCallback(async () => {
    setIsLoadingCases(true);
    try {
      const response = await fetch('/api/rma?limit=100');
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setCases(data.cases || []);
    } catch (error) {
      notify.error('Failed to load RMA cases', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const groupedCases = useMemo(() => {
    return RMA_COLUMNS.reduce<Record<RmaStatus, RmaCase[]>>((acc, column) => {
      acc[column.status] = cases.filter((c) => c.status === column.status);
      return acc;
    }, {
      received: [],
      testing: [],
      sent_to_manufacturer: [],
      repaired_replaced: [],
      back_to_customer: [],
    });
  }, [cases]);

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

  return (
    <Shell title="RMA & Service" subtitle="Returns, repairs, and serial service passport">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">RMA Pipeline</h2>
          <p className="text-sm text-zinc-500">Track each case from intake to back-to-customer.</p>
        </div>
        <Button onClick={() => setShowNewCase((v) => !v)}>{showNewCase ? 'Close Intake' : 'New RMA Case'}</Button>
      </div>

      {showNewCase && (
        <Card className="mb-8">
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

      {isLoadingCases ? (
        <Card><p className="text-sm text-zinc-500">Loading RMA cases...</p></Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {RMA_COLUMNS.map((column) => (
            <Card key={column.status} className="p-0 overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{column.label}</p>
                <p className="text-xs text-zinc-500">{groupedCases[column.status].length} case(s)</p>
              </div>
              <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                {groupedCases[column.status].map((rmaCase) => (
                  <Link
                    key={rmaCase.id}
                    href={`/rma/${rmaCase.id}`}
                    className="block rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 hover:border-emerald-400 transition-colors"
                  >
                    <p className="text-xs text-zinc-500">{rmaCase.shopify_order_name || rmaCase.shopify_order_id}</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">{rmaCase.issue_summary}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {rmaCase.serial_number || 'No serial'} · {rmaCase.customer_name || rmaCase.customer_email || 'Unknown customer'}
                    </p>
                  </Link>
                ))}
                {groupedCases[column.status].length === 0 && (
                  <p className="text-xs text-zinc-400 p-2">No cases in this stage.</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}

'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { notify } from '@/lib/store/app-store';
import { PrintLabelsDialog, usePrintLabelsDialog } from '@/components/labels';
import { parsePrice } from '@/lib/utils/pricing';
import type { InventoryItem, ConditionGrade, SyncResult } from '@/types';

const CONDITION_GRADES: { value: ConditionGrade; label: string; color: string }[] = [
  { value: 'mint', label: 'Mint', color: 'emerald' },
  { value: 'excellent', label: 'Excellent', color: 'green' },
  { value: 'good', label: 'Good', color: 'yellow' },
  { value: 'fair', label: 'Fair', color: 'orange' },
  { value: 'poor', label: 'Poor', color: 'red' },
];

// Calculate days on demo
function daysBetween(date1: string): number {
  const d1 = new Date(date1);
  const now = new Date();
  const diffTime = now.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export default function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const printLabelsDialog = usePrintLabelsDialog();
  const { confirm, isOpen: confirmOpen, config: confirmConfig, handleClose: confirmClose, handleConfirm: confirmConfirm } = useConfirmDialog();
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [aiResult, setAiResult] = useState<{ title: string; metaDescription: string; titleLength: number; metaDescriptionLength: number } | null>(null);
  const [imageResult, setImageResult] = useState<{ processed: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<InventoryItem>>({});
  
  // Price input validation state
  const [priceErrors, setPriceErrors] = useState<Record<string, string | null>>({});
  
  // Convert to sale state
  const [sellingImages, setSellingImages] = useState<string[]>([]);

  // Handle price input changes with validation
  const handlePriceChange = (field: 'sale_price' | 'cost_price' | 'rrp_aud', value: string) => {
    // Clear error when user starts typing
    setPriceErrors(prev => ({ ...prev, [field]: null }));
    
    // Allow empty string for clearing
    if (value === '' || value === null) {
      setFormData(prev => ({ ...prev, [field]: undefined }));
      return;
    }
    
    // Try to parse the price
    const parsed = parsePrice(value);
    
    if (parsed === null) {
      setPriceErrors(prev => ({ ...prev, [field]: 'Please enter a valid number' }));
      return;
    }
    
    if (parsed < 0) {
      setPriceErrors(prev => ({ ...prev, [field]: 'Price cannot be negative' }));
      return;
    }
    
    setFormData(prev => ({ ...prev, [field]: parsed }));
  };

  useEffect(() => {
    async function fetchItem() {
      try {
        const response = await fetch(`/api/inventory/${id}`);
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
        } else {
          setItem(data.item);
          setFormData(data.item);
        }
      } catch {
        setError('Failed to load item');
      } finally {
        setIsLoading(false);
      }
    }

    fetchItem();
  }, [id]);

  const handleSave = async () => {
    const normalizedSerial = (formData.serial_number || '').trim();
    if (formData.serial_capture_status === 'captured' && !normalizedSerial) {
      notify.error('Save failed', 'Enter a serial number or change serial status to Not found / Skipped');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          serial_number: normalizedSerial || null,
          serial_capture_status:
            formData.serial_capture_status ??
            (normalizedSerial ? 'captured' : 'skipped'),
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Save failed', data.error);
      } else {
        setItem(data.item);
        setFormData(data.item);
        notify.success('Changes saved', 'Item updated successfully');
      }
    } catch {
      setError('Failed to save changes');
      notify.error('Save failed', 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await fetch(`/api/inventory/${id}/sync`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Sync failed', data.error);
      } else {
        setSyncResult(data.result);
        // Refresh item to get updated sync status
        const refreshResponse = await fetch(`/api/inventory/${id}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.item) {
          setItem(refreshData.item);
          setFormData(refreshData.item);
        }
        notify.success('Sync complete', 'Item synced to platforms');
      }
    } catch {
      setError('Sync failed');
      notify.error('Sync failed', 'Please try again');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Archive Item',
      message: 'Are you sure you want to archive this item? It will be hidden from the inventory list but can be restored later.',
      confirmText: 'Archive',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        notify.success('Item archived', 'Item has been archived');
        router.push('/inventory');
      } else {
        notify.error('Archive failed', 'Failed to archive item');
      }
    } catch {
      setError('Failed to delete item');
      notify.error('Archive failed', 'Failed to archive item');
    }
  };

  // Duplicate item
  const handleDuplicate = async () => {
    setIsDuplicating(true);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Duplicate failed', data.error);
      } else {
        notify.success('Item duplicated', 'Opening duplicated item...');
        router.push(`/inventory/${data.item.id}`);
      }
    } catch {
      setError('Failed to duplicate item');
      notify.error('Duplicate failed', 'Failed to duplicate item');
    } finally {
      setIsDuplicating(false);
    }
  };

  // Generate AI content
  const handleGenerateContent = async () => {
    setIsGenerating(true);
    setError(null);
    setAiResult(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Generation failed', data.error);
      } else {
        setAiResult({
          title: data.generated.title,
          metaDescription: data.generated.metaDescription,
          titleLength: data.generated.titleLength,
          metaDescriptionLength: data.generated.metaDescriptionLength,
        });
        // Refresh item data
        const refreshResponse = await fetch(`/api/inventory/${id}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.item) {
          setItem(refreshData.item);
          setFormData(refreshData.item);
        }
        notify.success('Content generated', 'SEO title and description created');
      }
    } catch {
      setError('AI generation failed');
      notify.error('Generation failed', 'Please try again');
    } finally {
      setIsGenerating(false);
    }
  };

  // Process images
  const handleProcessImages = async () => {
    setIsProcessingImages(true);
    setError(null);
    setImageResult(null);

    try {
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Processing failed', data.error);
      } else {
        setImageResult({
          processed: data.results.processed,
          failed: data.results.failed,
        });
        // Refresh item data
        const refreshResponse = await fetch(`/api/inventory/${id}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.item) {
          setItem(refreshData.item);
          setFormData(refreshData.item);
        }
        notify.success('Images processed', `${data.results.processed} images converted to WebP`);
      }
    } catch {
      setError('Image processing failed');
      notify.error('Processing failed', 'Image processing failed');
    } finally {
      setIsProcessingImages(false);
    }
  };

  // Handle selling photos upload
  const handleSellingPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result as string;
        setSellingImages((prev) => [...prev, imageData]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = ''; // Reset input
  };

  // Remove selling photo
  const removeSellingPhoto = (index: number) => {
    setSellingImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Convert demo to sale
  const handleConvertToSale = async () => {
    if (!formData.sale_price || formData.sale_price <= 0) {
      setError('Please set a sale price before converting to sale');
      return;
    }

    if (!formData.condition_grade) {
      setError('Please select a condition grade');
      return;
    }

    setIsConverting(true);
    setError(null);

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          listing_status: 'ready_to_sell',
          selling_images: sellingImages,
          image_urls: sellingImages.length > 0 ? sellingImages : formData.registration_images || [],
          converted_to_sale_at: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Conversion failed', data.error);
      } else {
        setItem(data.item);
        setFormData(data.item);
        notify.success('Converted to sale', 'Item is now ready to sync to platforms');
        // Refresh page to show updated status
        router.refresh();
      }
    } catch {
      setError('Failed to convert to sale');
      notify.error('Conversion failed', 'Failed to convert to sale');
    } finally {
      setIsConverting(false);
    }
  };

  if (isLoading) {
    return (
      <Shell title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      </Shell>
    );
  }

  if (error && !item) {
    return (
      <Shell title="Error">
        <Card className="p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/inventory">
            <Button>Back to Inventory</Button>
          </Link>
        </Card>
      </Shell>
    );
  }

  if (!item) return null;

  // Determine subtitle based on listing type and status
  const getSubtitle = () => {
    if (item.listing_type === 'new') return 'New Retail';
    if (item.listing_type === 'trade_in') return 'Trade-In';
    if (item.listing_type === 'ex_demo') {
      if (item.listing_status === 'on_demo') return 'Demo Unit · On Display';
      if (item.listing_status === 'ready_to_sell') return 'Ex-Demo · Ready to Sell';
      if (item.listing_status === 'sold') return 'Ex-Demo · Sold';
      return 'Ex-Demo';
    }
    return '';
  };

  return (
    <Shell 
      title={`${item.brand} ${item.model}`}
      subtitle={getSubtitle()}
    >
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className={`mb-6 p-4 rounded-lg ${
          syncResult.success 
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        }`}>
          <h3 className={`font-semibold mb-2 ${syncResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {syncResult.success ? 'Sync Complete' : 'Sync Partial'}
          </h3>
          <div className="space-y-1 text-sm">
            {syncResult.shopify && (
              <p className="text-emerald-600 dark:text-emerald-400">
                ✓ Shopify: <a href={syncResult.shopify.admin_url} target="_blank" rel="noopener noreferrer" className="underline">View Product</a>
              </p>
            )}
            {syncResult.hubspot && (
              <p className="text-emerald-600 dark:text-emerald-400">
                ✓ HubSpot: <a href={syncResult.hubspot.deal_url} target="_blank" rel="noopener noreferrer" className="underline">View Deal</a>
              </p>
            )}
            {syncResult.notion && (
              <p className="text-emerald-600 dark:text-emerald-400">
                ✓ Notion: <a href={syncResult.notion.page_url} target="_blank" rel="noopener noreferrer" className="underline">View Page</a>
              </p>
            )}
            {syncResult.errors?.map((err, i) => (
              <p key={i} className="text-red-600 dark:text-red-400">✗ {err}</p>
            ))}
          </div>
        </div>
      )}

      {/* Demo Status Banner */}
      {item.listing_type === 'ex_demo' && item.listing_status === 'on_demo' && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🏷️</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-blue-700 dark:text-blue-400">Currently On Demo</h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
                  Not for Sale
                </span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-500 mb-2">
                This unit is on demonstration display and has not been listed for sale yet.
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                {item.demo_start_date && (
                  <div>
                    <span className="text-blue-500">Demo Start:</span>{' '}
                    <span className="font-medium text-blue-700 dark:text-blue-400">
                      {new Date(item.demo_start_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {item.demo_start_date && (
                  <div>
                    <span className="text-blue-500">Days on Demo:</span>{' '}
                    <span className="font-medium text-blue-700 dark:text-blue-400">
                      {daysBetween(item.demo_start_date)} days
                    </span>
                  </div>
                )}
                {item.cost_price && (
                  <div>
                    <span className="text-blue-500">Cost Price:</span>{' '}
                    <span className="font-medium text-blue-700 dark:text-blue-400">
                      ${item.cost_price.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Sale Section (for demo items on demo) */}
      {item.listing_type === 'ex_demo' && item.listing_status === 'on_demo' && (
        <Card className="mb-6">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-emerald-50 dark:bg-emerald-900/20">
            <h2 className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ready to Sell This Demo?
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleSellingPhotoUpload}
              className="hidden"
            />

            {/* Selling Photos */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Condition Photos <span className="text-zinc-400 font-normal">(show current condition)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {sellingImages.map((img, idx) => (
                  <div key={idx} className="relative">
                    { }
                    <img src={img} alt={`Condition ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg" />
                    <button
                      onClick={() => removeSellingPhoto(idx)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg flex flex-col items-center justify-center text-zinc-400 hover:border-zinc-400 hover:text-zinc-500 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs mt-1">Add</span>
                </button>
              </div>
            </div>

            {/* Quick Condition & Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Condition *</label>
                <div className="grid grid-cols-5 gap-1">
                  {CONDITION_GRADES.map((grade) => (
                    <button
                      key={grade.value}
                      onClick={() => setFormData({ ...formData, condition_grade: grade.value })}
                      className={`py-2 text-xs rounded transition-colors ${
                        formData.condition_grade === grade.value
                          ? 'bg-emerald-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {grade.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Sale Price *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                  <Input
                    type="number"
                    value={formData.sale_price ?? ''}
                    onChange={(e) => handlePriceChange('sale_price', e.target.value)}
                    placeholder="Enter sale price"
                    className={`pl-7 ${priceErrors.sale_price ? 'border-red-500 focus:ring-red-500' : ''}`}
                  />
                </div>
                {priceErrors.sale_price && (
                  <p className="text-xs text-red-500 mt-1">{priceErrors.sale_price}</p>
                )}
                {!priceErrors.sale_price && item.cost_price && formData.sale_price && formData.sale_price > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Margin: ${(formData.sale_price - item.cost_price).toLocaleString()} ({Math.round(((formData.sale_price - item.cost_price) / item.cost_price) * 100)}%)
                  </p>
                )}
              </div>
            </div>

            {/* Margin Safety Warning for Demo Conversion */}
            {item.cost_price && formData.sale_price && formData.sale_price < item.cost_price * 1.2 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Low Margin Warning</p>
                  <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                    Below 20% margin floor. Min recommended: ${Math.round(item.cost_price * 1.2).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Convert Button */}
            <Button
              onClick={handleConvertToSale}
              isLoading={isConverting}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!formData.sale_price || !formData.condition_grade}
            >
              Convert to Sale Listing
            </Button>
            <p className="text-xs text-center text-zinc-500">
              This will make the item available for sync to Shopify
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Info */}
          <Card>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Product Information</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Brand</label>
                  <Input
                    value={formData.brand || ''}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Model</label>
                  <Input
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Serial Number</label>
                  <Input
                    value={formData.serial_number || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        serial_number: e.target.value,
                        ...(e.target.value.trim() ? { serial_capture_status: 'captured' } : {}),
                      })
                    }
                    placeholder="Optional"
                    disabled={formData.serial_capture_status === 'not_found' || formData.serial_capture_status === 'skipped'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Serial Status</label>
                  <select
                    value={formData.serial_capture_status || 'skipped'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        serial_capture_status: e.target.value as InventoryItem['serial_capture_status'],
                        ...(e.target.value !== 'captured' ? { serial_number: null } : {}),
                      })
                    }
                    className="w-full h-10 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="captured">Captured</option>
                    <option value="not_found">Not found</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">SKU</label>
                  <Input
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Condition (for pre-owned) */}
          {item.listing_type !== 'new' && (
            <Card>
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="font-semibold text-zinc-900 dark:text-white">Condition</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Grade</label>
                  <div className="flex gap-2">
                    {CONDITION_GRADES.map((grade) => (
                      <button
                        key={grade.value}
                        onClick={() => setFormData({ ...formData, condition_grade: grade.value })}
                        className={`flex-1 py-2 px-3 text-sm rounded-lg border-2 transition-colors ${
                          formData.condition_grade === grade.value
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        {grade.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Condition Notes</label>
                  <textarea
                    value={formData.condition_report || ''}
                    onChange={(e) => setFormData({ ...formData, condition_report: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Describe any wear, scratches, or issues..."
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Pricing */}
          <Card>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Pricing</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">RRP (AUD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <Input
                      type="number"
                      value={formData.rrp_aud || ''}
                      onChange={(e) => setFormData({ ...formData, rrp_aud: parseFloat(e.target.value) || undefined })}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Cost Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <Input
                      type="number"
                      value={formData.cost_price || ''}
                      onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || undefined })}
                      className="pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Sale Price *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <Input
                      type="number"
                      value={formData.sale_price ?? ''}
                      onChange={(e) => handlePriceChange('sale_price', e.target.value)}
                      className={`pl-7 ${priceErrors.sale_price ? 'border-red-500 focus:ring-red-500' : ''}`}
                    />
                  </div>
                  {priceErrors.sale_price && (
                    <p className="text-xs text-red-500 mt-1">{priceErrors.sale_price}</p>
                  )}
                </div>
              </div>
              {formData.rrp_aud && formData.sale_price && formData.sale_price < formData.rrp_aud && (
                <p className="mt-2 text-sm text-emerald-600">
                  {Math.round((1 - formData.sale_price / formData.rrp_aud) * 100)}% below RRP
                </p>
              )}

              {/* Margin Safety Warning */}
              {formData.cost_price && formData.sale_price && formData.sale_price < formData.cost_price * 1.2 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                      Low Margin Warning
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                      Sale price is below 20% margin floor. 
                      Current margin: {formData.cost_price > 0 ? Math.round(((formData.sale_price - formData.cost_price) / formData.cost_price) * 100) : 0}%
                      {formData.cost_price > 0 && (
                        <span className="block mt-1">
                          Minimum recommended: ${Math.round(formData.cost_price * 1.2).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card className="p-4">
            <div className="space-y-3">
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                className="w-full"
              >
                Save Changes
              </Button>
              
              {/* Only show sync button if not on_demo */}
              {item.listing_status !== 'on_demo' && (
                <Button
                  onClick={handleSync}
                  isLoading={isSyncing}
                  variant="secondary"
                  className="w-full"
                  disabled={item.sync_status === 'syncing'}
                >
                  {item.sync_status === 'synced' ? 'Re-Sync' : 'Sync to Platforms'}
                </Button>
              )}

              {/* Show note for demo items */}
              {item.listing_status === 'on_demo' && (
                <p className="text-xs text-center text-zinc-500 py-2">
                  Convert to sale first to enable sync
                </p>
              )}

              <Button
                onClick={handleDuplicate}
                isLoading={isDuplicating}
                variant="secondary"
                className="w-full"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                Duplicate Item
              </Button>

              <Button
                onClick={printLabelsDialog.open}
                variant="secondary"
                className="w-full"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Label
              </Button>

              <Button
                onClick={handleDelete}
                variant="ghost"
                className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Archive Item
              </Button>
            </div>
          </Card>

          {/* AI Tools */}
          {item.listing_type === 'new' && (
            <Card>
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="text-lg">✨</span> AI Tools
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <Button
                  onClick={handleGenerateContent}
                  isLoading={isGenerating}
                  variant="secondary"
                  className="w-full"
                >
                  {isGenerating ? 'Generating...' : 'Generate SEO Content'}
                </Button>
                <p className="text-xs text-zinc-500">
                  AI-generated title, meta description, and product copy
                </p>

                <Button
                  onClick={handleProcessImages}
                  isLoading={isProcessingImages}
                  variant="secondary"
                  className="w-full"
                >
                  {isProcessingImages ? 'Processing...' : 'Process Images'}
                </Button>
                <p className="text-xs text-zinc-500">
                  Convert to WebP, optimize, and upload to storage
                </p>

                {/* AI Result */}
                {aiResult && (
                  <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                      ✓ Content Generated
                    </p>
                    <div className="space-y-1 text-xs text-emerald-600 dark:text-emerald-500">
                      <p>Title: {aiResult.titleLength} chars</p>
                      <p>Meta: {aiResult.metaDescriptionLength} chars</p>
                    </div>
                  </div>
                )}

                {/* Image Result */}
                {imageResult && (
                  <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                      ✓ Images Processed
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500">
                      {imageResult.processed} processed, {imageResult.failed} failed
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Status */}
          <Card>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Sync Status</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Status</span>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  item.sync_status === 'synced' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : item.sync_status === 'error'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {item.sync_status}
                </span>
              </div>

              {item.shopify_product_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Shopify</span>
                  <a 
                    href={`https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN}/admin/products/${item.shopify_product_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:underline"
                  >
                    View →
                  </a>
                </div>
              )}

              {item.hubspot_deal_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">HubSpot</span>
                  <span className="text-sm text-emerald-600">Connected</span>
                </div>
              )}

              {item.notion_page_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Notion</span>
                  <span className="text-sm text-emerald-600">Connected</span>
                </div>
              )}

              {item.last_synced_at && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-500">
                    Last synced: {new Date(item.last_synced_at).toLocaleString()}
                  </p>
                </div>
              )}

              {item.sync_error && (
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-red-600">{item.sync_error}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Meta */}
          <Card>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Details</h2>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Created</span>
                <span className="text-zinc-900 dark:text-white">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Updated</span>
                <span className="text-zinc-900 dark:text-white">
                  {new Date(item.updated_at).toLocaleDateString()}
                </span>
              </div>
              {item.rrp_source && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">RRP Source</span>
                  <span className="text-zinc-900 dark:text-white">{item.rrp_source}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Print Labels Dialog */}
      {item && (
        <PrintLabelsDialog
          isOpen={printLabelsDialog.isOpen}
          onClose={printLabelsDialog.close}
          items={[item]}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog 
        isOpen={confirmOpen}
        onClose={confirmClose}
        onConfirm={confirmConfirm}
        {...confirmConfig}
      />
    </Shell>
  );
}

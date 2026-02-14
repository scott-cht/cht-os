'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RichTextEditor, HtmlViewer } from '@/components/ui/RichTextEditor';
import { notify } from '@/lib/store/app-store';
import { postJsonWithIdempotency } from '@/lib/utils/idempotency-client';
import type { 
  ShopifyProduct, 
  ShopifyProductSnapshot,
  ProductDiff,
  MatchSuggestion 
} from '@/types/shopify-products';

export default function ShopifyProductDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = use(params);
  
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [diffs, setDiffs] = useState<ProductDiff[]>([]);
  const [snapshots, setSnapshots] = useState<ShopifyProductSnapshot[]>([]);
  const [matchSuggestions, setMatchSuggestions] = useState<MatchSuggestion[]>([]);
  const [linkedItem, setLinkedItem] = useState<{ id: string; brand: string; model: string } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isReimporting, setIsReimporting] = useState(false);
  
  const [syncFields, setSyncFields] = useState({
    title: true,
    description: true,
    metaDescription: true,
  });
  
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  
  // Editing state for all enriched fields
  const [editedTitle, setEditedTitle] = useState<string>('');
  const [editedMetaDescription, setEditedMetaDescription] = useState<string>('');
  const [editedDescription, setEditedDescription] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize edited fields from product data
  const initializeEditedFields = (prod: ShopifyProduct) => {
    setEditedTitle(prod.enriched_title || prod.title || '');
    setEditedMetaDescription(prod.enriched_meta_description || '');
    setEditedDescription(prod.enriched_description_html || prod.description_html || '');
  };

  // Fetch product data
  useEffect(() => {
    async function fetchData() {
      try {
        const [productRes, matchRes] = await Promise.all([
          fetch(`/api/shopify/products/${id}`),
          fetch(`/api/shopify/products/${id}/match`),
        ]);

        if (!productRes.ok) {
          throw new Error('Product not found');
        }

        const productData = await productRes.json();
        setProduct(productData.product);
        setDiffs(productData.diffs);
        setSnapshots(productData.snapshots);
        setLinkedItem(productData.linkedItem);
        
        // Initialize edited fields
        initializeEditedFields(productData.product);

        if (matchRes.ok) {
          const matchData = await matchRes.json();
          setMatchSuggestions(matchData.suggestions);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        notify.error('Error', 'Failed to load product');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [id]);

  // Enrich with AI
  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      const { response } = await postJsonWithIdempotency(
        `/api/shopify/products/${id}/enrich`,
        {},
        `shopify-enrich-${id}`
      );

      const data = await response.json();

      if (data.success) {
        const replayed = response.headers.get('idempotency-replayed') === 'true';
        notify.success('Enrichment complete', `Title: ${data.generated.titleLength} chars, Meta: ${data.generated.metaDescriptionLength} chars`);
        if (replayed) {
          notify.info('Replayed result', 'Returned previous enrich response for same request key');
        }
        setProduct(data.product);
        // Update edited fields with new enriched content
        initializeEditedFields(data.product);
        // Refresh diffs
        const productRes = await fetch(`/api/shopify/products/${id}`);
        const productData = await productRes.json();
        setDiffs(productData.diffs);
      } else {
        if (response.status === 409 && typeof data.error === 'string') {
          notify.warning('Enrichment in progress', data.error);
          return;
        }
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Unknown error');
        notify.error('Enrichment failed', errorMsg);
        console.error('Enrichment error:', data);
      }
    } catch {
      notify.error('Enrichment failed', 'Network error');
    } finally {
      setIsEnriching(false);
    }
  };

  // Sync to Shopify
  const handleSync = async () => {
    if (!syncFields.title && !syncFields.description && !syncFields.metaDescription) {
      notify.warning('No fields selected', 'Please select at least one field to sync');
      return;
    }

    setIsSyncing(true);
    try {
      const { response } = await postJsonWithIdempotency(
        `/api/shopify/products/${id}/sync`,
        {
          fields: syncFields,
          createSnapshot: true,
        },
        `shopify-sync-${id}`
      );

      const data = await response.json();

      if (data.success) {
        const pushed = Array.isArray(data.pushedFields) ? data.pushedFields.join(', ') : '';
        const replayed = response.headers.get('idempotency-replayed') === 'true';
        notify.success(
          replayed ? 'Sync replayed' : 'Sync complete',
          pushed ? `Changes pushed to Shopify (${pushed})` : 'Changes pushed to Shopify'
        );
        setProduct(data.product);
        // Refresh snapshots
        const productRes = await fetch(`/api/shopify/products/${id}`);
        const productData = await productRes.json();
        setSnapshots(productData.snapshots);
        setDiffs(productData.diffs);
      } else {
        if (response.status === 409 && typeof data.error === 'string') {
          notify.warning('Sync in progress', data.error);
          return;
        }
        notify.error('Sync failed', data.error || 'Unknown error');
      }
    } catch {
      notify.error('Sync failed', 'Network error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Save all edited fields
  const handleSaveFields = async (fieldsToSave: {
    title?: boolean;
    metaDescription?: boolean;
    description?: boolean;
  }) => {
    if (!product) return;
    
    setIsSaving(true);
    try {
      const updateData: Record<string, string> = {};
      
      if (fieldsToSave.title) {
        updateData.enriched_title = editedTitle;
      }
      if (fieldsToSave.metaDescription) {
        updateData.enriched_meta_description = editedMetaDescription;
      }
      if (fieldsToSave.description) {
        updateData.enriched_description_html = editedDescription;
      }
      
      const response = await fetch(`/api/shopify/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updateData,
          enrichment_status: 'enriched',
        }),
      });

      const data = await response.json();

      if (data.success) {
        notify.success('Saved', 'Changes saved');
        setProduct(data.product);
        
        // Close editing modes
        if (fieldsToSave.title) setIsEditingTitle(false);
        if (fieldsToSave.metaDescription) setIsEditingMeta(false);
        if (fieldsToSave.description) setIsEditingDescription(false);
        
        // Refresh diffs
        const productRes = await fetch(`/api/shopify/products/${id}`);
        const productData = await productRes.json();
        setDiffs(productData.diffs);
      } else {
        notify.error('Save failed', data.error || 'Unknown error');
      }
    } catch {
      notify.error('Save failed', 'Network error');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing helpers
  const handleCancelTitleEdit = () => {
    setEditedTitle(product?.enriched_title || product?.title || '');
    setIsEditingTitle(false);
  };
  
  const handleCancelMetaEdit = () => {
    setEditedMetaDescription(product?.enriched_meta_description || '');
    setIsEditingMeta(false);
  };
  
  const handleCancelDescriptionEdit = () => {
    setEditedDescription(product?.enriched_description_html || product?.description_html || '');
    setIsEditingDescription(false);
  };

  // Re-import from Shopify
  const handleReimport = async () => {
    setIsReimporting(true);
    try {
      const response = await fetch(`/api/shopify/products/${id}/reimport`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        notify.success('Re-imported', 'Product data refreshed from Shopify');
        setProduct(data.product);
        // Update edited description with new content
        setEditedDescription(
          data.product.enriched_description_html || 
          data.product.description_html || 
          ''
        );
        // Refresh diffs
        const productRes = await fetch(`/api/shopify/products/${id}`);
        const productData = await productRes.json();
        setDiffs(productData.diffs);
      } else {
        notify.error('Re-import failed', data.error || 'Unknown error');
      }
    } catch {
      notify.error('Re-import failed', 'Network error');
    } finally {
      setIsReimporting(false);
    }
  };

  // Rollback to snapshot
  const handleRollback = async (snapshotId: string) => {
    setIsRollingBack(true);
    try {
      const response = await fetch(`/api/shopify/products/${id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotId,
          syncToShopify: false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        notify.success('Rollback complete', 'Product restored to snapshot');
        setProduct(data.product);
        // Refresh diffs
        const productRes = await fetch(`/api/shopify/products/${id}`);
        const productData = await productRes.json();
        setDiffs(productData.diffs);
      } else {
        notify.error('Rollback failed', data.error || 'Unknown error');
      }
    } catch {
      notify.error('Rollback failed', 'Network error');
    } finally {
      setIsRollingBack(false);
      setShowSnapshots(false);
    }
  };

  // Link to inventory item
  const handleLink = async (inventoryItemId: string) => {
    try {
      const response = await fetch(`/api/shopify/products/${id}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryItemId }),
      });

      const data = await response.json();

      if (data.success) {
        notify.success('Linked', `Product linked to ${data.linkedTo.brand} ${data.linkedTo.model}`);
        setLinkedItem(data.linkedTo);
        setShowMatches(false);
      } else {
        notify.error('Link failed', data.error || 'Unknown error');
      }
    } catch {
      notify.error('Link failed', 'Network error');
    }
  };

  // Unlink from inventory item
  const handleUnlink = async () => {
    try {
      const response = await fetch(`/api/shopify/products/${id}/match`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        notify.success('Unlinked', 'Product unlinked from pricelist');
        setLinkedItem(null);
      } else {
        notify.error('Unlink failed', data.error || 'Unknown error');
      }
    } catch {
      notify.error('Unlink failed', 'Network error');
    }
  };

  // Status badge
  const EnrichmentBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      pending: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
      enriched: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      synced: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || colors.pending}`}>
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      </Shell>
    );
  }

  if (!product) {
    return (
      <Shell>
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
            Product not found
          </h2>
          <Link href="/shopify">
            <Button variant="primary">Back to Products</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  const hasChanges = diffs.some(d => d.hasChanges);

  return (
    <Shell>
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/shopify" 
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-2 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {product.images[0] && (
              <Image
                src={product.images[0].url}
                alt=""
                width={80}
                height={80}
                className="w-20 h-20 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800"
              />
            )}
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
                {product.title}
              </h1>
              <p className="text-zinc-500 mt-1">
                {product.vendor} · {product.handle}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <EnrichmentBadge status={product.enrichment_status} />
                {linkedItem && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    Linked
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleReimport}
              isLoading={isReimporting}
              disabled={isReimporting}
              title="Pull latest data from Shopify"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-import
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowSnapshots(!showSnapshots)}
            >
              History ({snapshots.length})
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowMatches(!showMatches)}
            >
              Match
            </Button>
            <Button
              variant="primary"
              onClick={handleEnrich}
              isLoading={isEnriching}
              disabled={isEnriching}
            >
              {product.enrichment_status === 'pending' ? 'Enrich with AI' : 'Re-enrich'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Diff View */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title Diff */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-zinc-900 dark:text-white">Title</h3>
                {!isEditingTitle && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Button>
                )}
              </div>
              {(product.enriched_title || editedTitle !== product.title) && !isEditingTitle && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={syncFields.title}
                    onChange={(e) => setSyncFields(prev => ({ ...prev, title: e.target.checked }))}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-emerald-500"
                  />
                  Sync this field
                </label>
              )}
            </div>
            
            {isEditingTitle ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Edit Title</p>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    maxLength={60}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter SEO-optimized title..."
                  />
                  <p className={`text-xs mt-1 ${editedTitle.length > 60 ? 'text-red-500' : 'text-zinc-400'}`}>
                    {editedTitle.length}/60 characters
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={handleCancelTitleEdit} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={() => handleSaveFields({ title: true })}
                    isLoading={isSaving}
                  >
                    Save Title
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Original</p>
                  <p className="text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
                    {product.title}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">{product.title.length} characters</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Enriched</p>
                  {product.enriched_title ? (
                    <>
                      <p className={`text-zinc-900 dark:text-white p-3 rounded-lg ${
                        product.enriched_title !== product.title 
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' 
                          : 'bg-zinc-50 dark:bg-zinc-800'
                      }`}>
                        {product.enriched_title}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">{product.enriched_title.length} characters</p>
                    </>
                  ) : (
                    <p className="text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
                      Not enriched yet - click Edit to write manually
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Meta Description Diff */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-zinc-900 dark:text-white">Meta Description</h3>
                {!isEditingMeta && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingMeta(true)}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Button>
                )}
              </div>
              {product.enriched_meta_description && !isEditingMeta && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={syncFields.metaDescription}
                    onChange={(e) => setSyncFields(prev => ({ ...prev, metaDescription: e.target.checked }))}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-emerald-500"
                  />
                  Sync this field
                </label>
              )}
            </div>
            
            {isEditingMeta ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Edit Meta Description</p>
                  <textarea
                    value={editedMetaDescription}
                    onChange={(e) => setEditedMetaDescription(e.target.value)}
                    maxLength={160}
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                    placeholder="Enter meta description (150-155 chars, end with CTA)..."
                  />
                  <p className={`text-xs mt-1 ${
                    editedMetaDescription.length < 150 || editedMetaDescription.length > 155 
                      ? 'text-amber-500' 
                      : 'text-emerald-500'
                  }`}>
                    {editedMetaDescription.length}/155 characters {editedMetaDescription.length >= 150 && editedMetaDescription.length <= 155 ? '✓' : '(target: 150-155)'}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={handleCancelMetaEdit} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={() => handleSaveFields({ metaDescription: true })}
                    isLoading={isSaving}
                  >
                    Save Meta Description
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Original</p>
                  <p className="text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
                    Shopify products don&apos;t have meta descriptions
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Enriched</p>
                  {product.enriched_meta_description ? (
                    <>
                      <p className="text-zinc-900 dark:text-white bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg">
                        {product.enriched_meta_description}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">{product.enriched_meta_description.length} characters (target: 150-155)</p>
                    </>
                  ) : (
                    <p className="text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
                      Not enriched yet - click Edit to write manually
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Description Diff */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-zinc-900 dark:text-white">Description</h3>
                {!isEditingDescription && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingDescription(true)}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </Button>
                )}
              </div>
              {diffs.find(d => d.field === 'description_html')?.hasChanges && !isEditingDescription && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={syncFields.description}
                    onChange={(e) => setSyncFields(prev => ({ ...prev, description: e.target.checked }))}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-emerald-500"
                  />
                  Sync this field
                </label>
              )}
            </div>
            
            {isEditingDescription ? (
              // Edit mode - full width rich text editor
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                    Edit Description
                  </p>
                  <RichTextEditor
                    content={editedDescription}
                    onChange={setEditedDescription}
                    placeholder="Write your product description..."
                    className="min-h-[300px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleCancelDescriptionEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleSaveFields({ description: true })}
                    isLoading={isSaving}
                  >
                    Save Description
                  </Button>
                </div>
              </div>
            ) : (
              // View mode - side by side comparison
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Original (from Shopify)</p>
                  <HtmlViewer 
                    content={product.description_html || ''} 
                    className="max-h-80 overflow-y-auto"
                  />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                    Enriched {product.enriched_description_html && '(click Edit to modify)'}
                  </p>
                  {product.enriched_description_html ? (
                    <div className={`max-h-80 overflow-y-auto rounded-lg ${
                      product.enriched_description_html !== product.description_html
                        ? 'ring-2 ring-emerald-500/20'
                        : ''
                    }`}>
                      <HtmlViewer 
                        content={product.enriched_description_html} 
                        className={
                          product.enriched_description_html !== product.description_html
                            ? 'bg-emerald-50 dark:bg-emerald-900/20'
                            : ''
                        }
                      />
                    </div>
                  ) : (
                    <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg">
                      <p className="text-zinc-400 italic">Not enriched yet</p>
                      <p className="text-xs text-zinc-500 mt-2">
                        Click &quot;Enrich with AI&quot; to generate content, or &quot;Edit&quot; to write manually.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Sync Button */}
          {hasChanges && (
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="lg"
                onClick={handleSync}
                isLoading={isSyncing}
                disabled={isSyncing || !hasChanges}
              >
                Sync to Shopify
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Linked Item */}
          <Card className="p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Pricelist Link</h3>
            {linkedItem ? (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <p className="font-medium text-purple-900 dark:text-purple-100">
                  {linkedItem.brand} {linkedItem.model}
                </p>
                <Link 
                  href={`/inventory/${linkedItem.id}`}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  View in Inventory →
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={handleUnlink}
                >
                  Unlink
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-zinc-500 mb-3">
                  No pricelist item linked
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowMatches(true)}
                >
                  Find Matches
                </Button>
              </div>
            )}
          </Card>

          {/* Product Info */}
          <Card className="p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Product Info</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-zinc-500">Shopify ID</dt>
                <dd className="font-mono text-xs text-zinc-900 dark:text-white truncate">
                  {product.shopify_id}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Status</dt>
                <dd className="text-zinc-900 dark:text-white capitalize">{product.status}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Price</dt>
                <dd className="text-zinc-900 dark:text-white">
                  ${product.variants[0]?.price || '0.00'}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Last Imported</dt>
                <dd className="text-zinc-900 dark:text-white">
                  {new Date(product.last_imported_at).toLocaleString()}
                </dd>
              </div>
              {product.last_synced_at && (
                <div>
                  <dt className="text-zinc-500">Last Synced</dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {new Date(product.last_synced_at).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Images */}
          {product.images.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
                Images ({product.images.length})
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {product.images.slice(0, 6).map((image, index) => (
                  <Image
                    key={image.id || index}
                    src={image.url}
                    alt={image.altText || ''}
                    width={160}
                    height={160}
                    className="w-full aspect-square object-cover rounded-lg bg-zinc-100 dark:bg-zinc-800"
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Snapshots Modal */}
      {showSnapshots && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                Snapshot History
              </h3>
              <button
                onClick={() => setShowSnapshots(false)}
                className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              {snapshots.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">No snapshots available</p>
              ) : (
                <div className="space-y-3">
                  {snapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white capitalize">
                          {snapshot.snapshot_type.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {new Date(snapshot.created_at).toLocaleString()}
                        </p>
                        {snapshot.note && (
                          <p className="text-xs text-zinc-400 mt-1">{snapshot.note}</p>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRollback(snapshot.id)}
                        isLoading={isRollingBack}
                      >
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Match Suggestions Modal */}
      {showMatches && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                Match Suggestions
              </h3>
              <button
                onClick={() => setShowMatches(false)}
                className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              {matchSuggestions.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">No matching items found</p>
              ) : (
                <div className="space-y-3">
                  {matchSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.inventoryItem.id}
                      className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {suggestion.inventoryItem.brand} {suggestion.inventoryItem.model}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            suggestion.matchType === 'sku_exact' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : suggestion.matchType === 'brand_model_exact'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {suggestion.matchType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {suggestion.confidence}% confidence
                          </span>
                        </div>
                        {suggestion.inventoryItem.sku && (
                          <p className="text-xs text-zinc-400 mt-1">
                            SKU: {suggestion.inventoryItem.sku}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleLink(suggestion.inventoryItem.id)}
                      >
                        Link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </Shell>
  );
}

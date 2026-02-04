'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { PricingCalculator } from '@/components/products/PricingCalculator';
import { SpecificationsEditor, SpecificationsDisplay } from '@/components/products/SpecificationsEditor';
import { RawSpecsEditor } from '@/components/products/RawSpecsEditor';
import { ProductPreview } from '@/components/products/ProductPreview';
import type { ProductOnboarding, RawScrapedData, CategorizedSpecifications } from '@/types';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductPage({ params }: ProductPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<ProductOnboarding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<{
    hasJsonLd: boolean;
    imageCount: number;
    specCount: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<{
    title: string;
    titleLength: number;
    metaDescription: string;
    metaDescriptionLength: number;
  } | null>(null);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [imageProcessingResult, setImageProcessingResult] = useState<{
    processed: number;
    failed: number;
    total: number;
  } | null>(null);
  const [isPushingToShopify, setIsPushingToShopify] = useState(false);
  const [shopifyResult, setShopifyResult] = useState<{
    success: boolean;
    adminUrl?: string;
    error?: string;
  } | null>(null);
  const [isShopifyConfigured, setIsShopifyConfigured] = useState<boolean | null>(null);
  const [isCategorizingSpecs, setIsCategorizingSpecs] = useState(false);
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);
  const [isEditingRawSpecs, setIsEditingRawSpecs] = useState(false);
  const [isSavingSpecs, setIsSavingSpecs] = useState(false);
  const [deletedImages, setDeletedImages] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchProduct();
    checkShopifyConfig();
  }, [id]);

  const checkShopifyConfig = async () => {
    try {
      const response = await fetch('/api/shopify');
      const data = await response.json();
      setIsShopifyConfigured(data.configured);
    } catch {
      setIsShopifyConfigured(false);
    }
  };

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${id}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setProduct(data.product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrape = async () => {
    setIsScraping(true);
    setError(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Log debug info to console for troubleshooting
      if (data.debug) {
        console.log('=== SCRAPER DEBUG INFO ===');
        console.log('URL used:', data.debug.urlUsed);
        console.log('Tab clicked:', data.debug.tabClicked);
        console.log('Tabs found:', data.debug.tabsFound);
        console.log('Accordions found:', data.debug.accordionsFound);
        console.log('Tables found:', data.debug.tablesFound);
        console.log('DLs found:', data.debug.dlsFound);
        console.log('Spec elements found:', data.debug.specElementsFound);
        console.log('List items with specs:', data.debug.listItemsFound);
        console.log('Specs extracted:', data.debug.specsExtracted);
        console.log('Spec values:', data.debug.specValues);
        console.log('========================');
      }

      setProduct(data.product);
      setExtractionResult(data.extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scraping failed');
    } finally {
      setIsScraping(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setProduct(data.product);
      setGenerationResult(data.generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePricing = async (costPrice: number, salesPrice: number, discountPercent: number) => {
    setIsSavingPricing(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_price: costPrice,
          sales_price: salesPrice,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setProduct(data.product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing');
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleProcessImages = async () => {
    setIsProcessingImages(true);
    setError(null);

    try {
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setProduct(data.product);
      setImageProcessingResult({
        processed: data.results.processed,
        failed: data.results.failed,
        total: data.results.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image processing failed');
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleCategorizeSpecs = async () => {
    if (!product?.raw_scraped_json?.htmlParsed?.specifications) return;
    
    setIsCategorizingSpecs(true);
    try {
      const response = await fetch('/api/specifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: id,
          specifications: product.raw_scraped_json.htmlParsed.specifications,
          brand: product.brand,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Refresh product to get updated data
      await fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to categorize specifications');
    } finally {
      setIsCategorizingSpecs(false);
    }
  };

  const handleDeleteImage = (index: number) => {
    setDeletedImages(prev => new Set([...prev, index]));
  };

  const handleRestoreImage = (index: number) => {
    setDeletedImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const handleSaveImageChanges = async () => {
    if (!product?.raw_scraped_json?.htmlParsed?.images) return;
    
    const currentImages = product.raw_scraped_json.htmlParsed.images;
    const filteredImages = currentImages.filter((_, idx) => !deletedImages.has(idx));
    
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_scraped_json: {
            ...product.raw_scraped_json,
            htmlParsed: {
              ...product.raw_scraped_json.htmlParsed,
              images: filteredImages,
            },
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      
      await fetchProduct();
      setDeletedImages(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save image changes');
    }
  };

  const handleSaveRawSpecs = async (specs: Record<string, string>) => {
    if (!product?.raw_scraped_json) return;
    
    setIsSavingSpecs(true);
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_scraped_json: {
            ...product.raw_scraped_json,
            htmlParsed: {
              ...product.raw_scraped_json.htmlParsed,
              specifications: specs,
            },
            // Clear categorized specs when raw specs are edited
            categorizedSpecs: undefined,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      
      await fetchProduct();
      setIsEditingRawSpecs(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save specifications');
    } finally {
      setIsSavingSpecs(false);
    }
  };

  const handleSaveSpecs = async (specs: CategorizedSpecifications) => {
    setIsSavingSpecs(true);
    try {
      const response = await fetch('/api/specifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: id,
          categorizedSpecs: specs,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Refresh product and close editor
      await fetchProduct();
      setIsEditingSpecs(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save specifications');
    } finally {
      setIsSavingSpecs(false);
    }
  };

  const handlePushToShopify = async () => {
    setIsPushingToShopify(true);
    setError(null);
    setShopifyResult(null);

    try {
      const response = await fetch('/api/shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      });

      const data = await response.json();

      if (data.error) {
        setShopifyResult({ success: false, error: data.error });
        throw new Error(data.error);
      }

      setProduct(prev => prev ? { ...prev, status: 'synced', shopify_product_id: data.shopifyProduct.id } : null);
      setShopifyResult({ 
        success: true, 
        adminUrl: data.shopifyProduct.adminUrl 
      });
    } catch (err) {
      if (!shopifyResult?.error) {
        setError(err instanceof Error ? err.message : 'Failed to push to Shopify');
      }
    } finally {
      setIsPushingToShopify(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Product not found
          </h1>
          <Button onClick={() => router.push('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const rawData = product.raw_scraped_json as RawScrapedData | null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {product.brand} {product.model_number}
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Product Details</p>
              </div>
            </div>
            <StatusBadge status={product.status} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Phase 2: Extraction */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">2</span>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Extraction</h2>
          </div>

          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">Source URL</p>
                <a 
                  href={product.source_url || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline break-all"
                >
                  {product.source_url}
                </a>
              </div>
            </div>

            {!rawData ? (
              <Button
                onClick={handleScrape}
                isLoading={isScraping}
                size="lg"
                className="w-full"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isScraping ? 'Extracting Data...' : 'Extract Product Data'}
              </Button>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Data extracted successfully</span>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleScrape}
                  isLoading={isScraping}
                  size="sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Re-extract
                </Button>
              </div>
            )}
          </Card>

          {/* Extraction Results */}
          {extractionResult && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card className="text-center">
                <div className={`text-2xl font-bold ${extractionResult.hasJsonLd ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {extractionResult.hasJsonLd ? '✓' : '✗'}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">JSON-LD Found</p>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {extractionResult.imageCount}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Images Found</p>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {extractionResult.specCount}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Specifications</p>
              </Card>
            </div>
          )}
        </section>

        {/* Extracted Data Display */}
        {rawData && (
          <>
            {/* Basic Info */}
            <section className="mb-8">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Extracted Information
              </h3>
              
              <Card>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                      Product Title
                    </label>
                    <p className="text-zinc-900 dark:text-zinc-100 font-medium">
                      {product.title || 'Not found'}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        RRP (AUD)
                      </label>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {product.rrp_aud ? `$${product.rrp_aud.toLocaleString()}` : 'Not found'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        Brand / Model
                      </label>
                      <p className="text-zinc-900 dark:text-zinc-100">
                        {product.brand} {product.model_number}
                      </p>
                    </div>
                  </div>

                  {rawData.htmlParsed?.description && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                        Description
                      </label>
                      <p className="text-zinc-700 dark:text-zinc-300 text-sm line-clamp-4">
                        {rawData.htmlParsed.description}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </section>

            {/* Images */}
            {rawData.htmlParsed?.images && rawData.htmlParsed.images.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Product Images ({rawData.htmlParsed.images.length - deletedImages.size} of {rawData.htmlParsed.images.length})
                  </h3>
                  {deletedImages.size > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDeletedImages(new Set())}
                      >
                        Undo All
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveImageChanges}
                      >
                        Save Changes ({deletedImages.size} removed)
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {rawData.htmlParsed.images.map((src, index) => (
                    <div 
                      key={index} 
                      className={`relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 group ${
                        deletedImages.has(index) ? 'opacity-40 ring-2 ring-red-500' : ''
                      }`}
                    >
                      <img
                        src={src}
                        alt={`Product image ${index + 1}`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
                        }}
                      />
                      {/* Image number badge */}
                      <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        #{index + 1}
                      </span>
                      {/* Delete/Restore button */}
                      {deletedImages.has(index) ? (
                        <button
                          onClick={() => handleRestoreImage(index)}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
                        >
                          <span className="bg-emerald-600 px-3 py-1 rounded text-sm font-medium">
                            Click to Restore
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeleteImage(index)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                  Hover over images and click the X to remove unwanted images. Changes are saved when you click "Save Changes".
                </p>
              </section>
            )}

            {/* Specifications - Phase 2.5: Edit & Optionally Categorize */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold">2.5</span>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Specifications 
                    {rawData.htmlParsed?.specifications && Object.keys(rawData.htmlParsed.specifications).length > 0 
                      ? ` (${Object.keys(rawData.htmlParsed.specifications).length} items)`
                      : ' (none found)'}
                  </h3>
                </div>
                <div className="flex gap-2">
                  {/* Edit raw specs button - always show if there are specs and not already editing */}
                  {rawData.htmlParsed?.specifications && Object.keys(rawData.htmlParsed.specifications).length > 0 && !rawData.categorizedSpecs && !isEditingRawSpecs && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditingRawSpecs(true)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Specs
                    </Button>
                  )}
                  {/* Auto-categorize button - optional */}
                  {rawData.htmlParsed?.specifications && Object.keys(rawData.htmlParsed.specifications).length > 0 && !rawData.categorizedSpecs && !isEditingRawSpecs && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCategorizeSpecs}
                      isLoading={isCategorizingSpecs}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      {isCategorizingSpecs ? 'Categorizing...' : 'Auto-Categorize (AI)'}
                    </Button>
                  )}
                  {rawData.categorizedSpecs && !isEditingSpecs && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditingSpecs(true)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Categories
                    </Button>
                  )}
                </div>
              </div>

              {/* No specifications found */}
              {(!rawData.htmlParsed?.specifications || Object.keys(rawData.htmlParsed.specifications).length === 0) && !rawData.categorizedSpecs && !isEditingRawSpecs && (
                <Card className="border-dashed border-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="text-center py-6">
                    <svg className="w-12 h-12 mx-auto text-zinc-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-zinc-600 dark:text-zinc-400 font-medium">No specifications found on this page</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                      Try re-extracting or add specs manually
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => setIsEditingRawSpecs(true)}
                    >
                      Add Specifications Manually
                    </Button>
                  </div>
                </Card>
              )}

              {/* Raw Specs Editor */}
              {isEditingRawSpecs && (
                <Card>
                  <RawSpecsEditor
                    specifications={rawData.htmlParsed?.specifications || {}}
                    onSave={handleSaveRawSpecs}
                    onCancel={() => setIsEditingRawSpecs(false)}
                    isLoading={isSavingSpecs}
                  />
                </Card>
              )}

              {/* Categorized Specifications Display */}
              {rawData.categorizedSpecs && !isEditingSpecs && (
                <Card>
                  <SpecificationsDisplay specifications={rawData.categorizedSpecs} />
                </Card>
              )}
              
              {/* Categorized Specifications Editor */}
              {rawData.categorizedSpecs && isEditingSpecs && (
                <Card>
                  <SpecificationsEditor
                    specifications={rawData.categorizedSpecs}
                    onSave={handleSaveSpecs}
                    onCancel={() => setIsEditingSpecs(false)}
                    isLoading={isSavingSpecs}
                  />
                </Card>
              )}
              
              {/* Raw specifications display (table format) */}
              {rawData.htmlParsed?.specifications && Object.keys(rawData.htmlParsed.specifications).length > 0 && !rawData.categorizedSpecs && !isEditingRawSpecs && (
                <Card className="overflow-hidden p-0">
                  <table className="specifications-table">
                    <thead>
                      <tr>
                        <th colSpan={2}>Specifications</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(rawData.htmlParsed.specifications).map(([key, value]) => (
                        <tr key={key}>
                          <th>{key}</th>
                          <td>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </section>

            {/* JSON-LD Raw Data */}
            {rawData.jsonLd && (
              <section className="mb-8">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  JSON-LD Data (Source of Truth)
                </h3>
                <Card>
                  <pre className="text-xs text-zinc-700 dark:text-zinc-300 overflow-x-auto max-h-64">
                    {JSON.stringify(rawData.jsonLd, null, 2)}
                  </pre>
                </Card>
              </section>
            )}

            {/* Phase 3: AI Copywriting */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">3</span>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI Copywriting</h2>
              </div>

              {!rawData.aiGenerated ? (
                <Card>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                        Generate SEO Content
                      </h4>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Create unique, SEO-optimized title, meta description, and product content using AI.
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerate}
                      isLoading={isGenerating}
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {isGenerating ? 'Generating...' : 'Generate Content'}
                    </Button>
                  </div>
                </Card>
              ) : (
                <>
                  {/* Generation Stats */}
                  {generationResult && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <Card className="text-center">
                        <div className={`text-2xl font-bold ${generationResult.titleLength <= 60 ? 'text-emerald-600' : 'text-amber-500'}`}>
                          {generationResult.titleLength}/60
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Title Length</p>
                      </Card>
                      <Card className="text-center">
                        <div className={`text-2xl font-bold ${generationResult.metaDescriptionLength >= 150 && generationResult.metaDescriptionLength <= 160 ? 'text-emerald-600' : 'text-amber-500'}`}>
                          {generationResult.metaDescriptionLength}/155
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Meta Description</p>
                      </Card>
                    </div>
                  )}

                  {/* Generated Title */}
                  <Card className="mb-4">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                            SEO Title
                          </label>
                          <span className={`text-xs ${rawData.aiGenerated.title.length <= 60 ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {rawData.aiGenerated.title.length} characters
                          </span>
                        </div>
                        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                          {rawData.aiGenerated.title}
                        </p>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                            Meta Description
                          </label>
                          <span className={`text-xs ${rawData.aiGenerated.metaDescription.length >= 150 && rawData.aiGenerated.metaDescription.length <= 160 ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {rawData.aiGenerated.metaDescription.length} characters
                          </span>
                        </div>
                        <p className="text-zinc-700 dark:text-zinc-300">
                          {rawData.aiGenerated.metaDescription}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Generated Description */}
                  <Card className="mb-4">
                    <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
                      Product Description
                    </label>
                    <div 
                      className="product-description-content prose-product text-zinc-700 dark:text-zinc-300"
                      dangerouslySetInnerHTML={{ __html: rawData.aiGenerated.descriptionHtml }}
                    />
                  </Card>

                  {/* Alt Texts */}
                  {rawData.aiGenerated.altTexts && rawData.aiGenerated.altTexts.length > 0 && (
                    <Card>
                      <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                        Image Alt Texts ({rawData.aiGenerated.altTexts.length})
                      </label>
                      <ul className="space-y-2">
                        {rawData.aiGenerated.altTexts.map((alt, index) => (
                          <li key={index} className="text-sm text-zinc-700 dark:text-zinc-300 flex items-start gap-2">
                            <span className="text-zinc-400 font-mono">{index + 1}.</span>
                            {alt}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {/* Regenerate Button */}
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={handleGenerate}
                      isLoading={isGenerating}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </Button>
                  </div>
                </>
              )}
            </section>

            {/* Phase 4: Retail Math */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">4</span>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Retail Math & Pricing</h2>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Calculate your sales price using Australian retail standards. Sales price must be a whole dollar amount.
              </p>
              
              <PricingCalculator
                rrpAud={product.rrp_aud}
                initialCostPrice={product.cost_price}
                initialSalesPrice={product.sales_price}
                onSave={handleSavePricing}
                isSaving={isSavingPricing}
              />

              {/* Saved Pricing Display */}
              {product.cost_price && product.sales_price && (
                <Card className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Pricing saved</span>
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">
                      Cost: ${product.cost_price} | Sales: ${product.sales_price}
                    </span>
                  </div>
                </Card>
              )}
            </section>

            {/* Phase 5: Media Pipeline */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">5</span>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Media Pipeline</h2>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Convert images to WebP format and upload to Supabase Storage with SEO-friendly filenames.
              </p>

              {!rawData.processedImages || rawData.processedImages.length === 0 ? (
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                        Process Product Images
                      </h4>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {rawData.htmlParsed?.images?.length || 0} images found. Convert to WebP and upload to storage.
                      </p>
                    </div>
                  </div>
                  
                  {rawData.htmlParsed?.images && rawData.htmlParsed.images.length > 0 ? (
                    <Button
                      onClick={handleProcessImages}
                      isLoading={isProcessingImages}
                      size="lg"
                      className="w-full"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {isProcessingImages ? 'Processing Images...' : 'Process & Upload Images'}
                    </Button>
                  ) : (
                    <p className="text-amber-600 dark:text-amber-400 text-sm">
                      No images available. Extract product data first.
                    </p>
                  )}
                </Card>
              ) : (
                <>
                  {/* Processing Results */}
                  {imageProcessingResult && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <Card className="text-center">
                        <div className="text-2xl font-bold text-emerald-600">
                          {imageProcessingResult.processed}
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Processed</p>
                      </Card>
                      <Card className="text-center">
                        <div className={`text-2xl font-bold ${imageProcessingResult.failed > 0 ? 'text-amber-500' : 'text-zinc-400'}`}>
                          {imageProcessingResult.failed}
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Failed</p>
                      </Card>
                      <Card className="text-center">
                        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                          {imageProcessingResult.total}
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Total</p>
                      </Card>
                    </div>
                  )}

                  {/* Processed Images Grid */}
                  <Card className="mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                        Processed Images ({rawData.processedImages.length})
                      </h4>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">
                        WebP Format
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {rawData.processedImages.map((img, index) => (
                        <div key={index} className="space-y-2">
                          <div className="aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                            <img
                              src={img.publicUrl}
                              alt={img.altText}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate" title={img.filename}>
                              {img.filename}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {img.width}×{img.height}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Reprocess Button */}
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={handleProcessImages}
                      isLoading={isProcessingImages}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reprocess Images
                    </Button>
                  </div>
                </>
              )}
            </section>

            {/* Preview Section */}
            {rawData?.aiGenerated && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </span>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Preview</h2>
                </div>
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                        Review Before Publishing
                      </h4>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        See exactly how your product will appear on Shopify
                      </p>
                    </div>
                    <Button onClick={() => setShowPreview(true)}>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Open Preview
                    </Button>
                  </div>
                </Card>
              </section>
            )}

            {/* Phase 6: Shopify Push */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">6</span>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Shopify Push</h2>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Create the product as a DRAFT in your Shopify store for final review before publishing.
              </p>

              {/* Already synced */}
              {product.shopify_product_id ? (
                <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                        <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-emerald-900 dark:text-emerald-100">
                          Synced to Shopify
                        </h4>
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                          Product created as DRAFT. Review and publish in Shopify Admin.
                        </p>
                      </div>
                    </div>
                    {shopifyResult?.adminUrl && (
                      <a
                        href={shopifyResult.adminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        View in Shopify
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </Card>
              ) : isShopifyConfigured === false ? (
                /* Shopify not configured */
                <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-900 dark:text-amber-100">
                        Shopify Not Configured
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Add SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN to .env.local
                      </p>
                    </div>
                  </div>
                </Card>
              ) : (
                /* Ready to push */
                <Card>
                  <div className="space-y-4">
                    {/* Pre-push checklist */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        {product.title ? (
                          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">Title</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {product.description_html ? (
                          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">Description</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {product.sales_price ? (
                          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">Price</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rawData?.processedImages?.length ? (
                          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                          </svg>
                        )}
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">Images</span>
                      </div>
                    </div>

                    {/* Error display */}
                    {shopifyResult?.error && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-300">{shopifyResult.error}</p>
                      </div>
                    )}

                    {/* Push button */}
                    <Button
                      onClick={handlePushToShopify}
                      isLoading={isPushingToShopify}
                      disabled={!product.title || !product.sales_price || isPushingToShopify}
                      size="lg"
                      className="w-full"
                    >
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.337 3.416c-.194-.066-.488.009-.637.159-.149.15-.252.47-.252.47l-.927 2.836s-1.078-.198-1.553-.198c-1.301 0-1.382 1.146-1.382 1.146l-.006 5.573c0 .19.155.342.346.342h.694c.19 0 .345-.153.345-.342v-3.03h.866v3.03c0 .19.155.342.345.342h.694c.19 0 .345-.153.345-.342v-3.03h.866v3.03c0 .19.155.342.345.342h.694c.19 0 .346-.153.346-.342V7.83s-.082-1.146-1.383-1.146c-.475 0-1.553.198-1.553.198l.928-2.836s.103-.32-.117-.63z"/>
                      </svg>
                      {isPushingToShopify ? 'Creating Draft...' : 'Push to Shopify as DRAFT'}
                    </Button>

                    <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
                      Product will be created as DRAFT. Review and publish manually in Shopify Admin.
                    </p>
                  </div>
                </Card>
              )}
            </section>
          </>
        )}
      </main>

      {/* Product Preview Modal */}
      {showPreview && product && (
        <ProductPreview
          product={product}
          onClose={() => setShowPreview(false)}
          onPushToShopify={handlePushToShopify}
          isPushing={isPushingToShopify}
          isShopifyConfigured={isShopifyConfigured || false}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    processing: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    reviewed: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    synced: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    error: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

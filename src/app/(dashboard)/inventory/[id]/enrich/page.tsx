'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { notify } from '@/lib/store/app-store';
import type { InventoryItem, SearchResult } from '@/types';

interface ScrapedData {
  brand?: string;
  title?: string;
  description?: string;
  images: string[];
  specifications: Record<string, string>;
  rrp?: number;
}

/**
 * Enrichment Page
 * 
 * Allows users to search for a product online and scrape data
 * to enrich a pending inventory item with images and descriptions.
 */
export default function EnrichmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  // Scrape state
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);

  // Fetch item on load
  useEffect(() => {
    async function fetchItem() {
      try {
        const response = await fetch(`/api/inventory/${id}`);
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
        } else {
          setItem(data.item);
          // Pre-fill search query with brand + model
          const query = `${data.item.brand || ''} ${data.item.model || ''}`.trim();
          setSearchQuery(query);
        }
      } catch {
        setError('Failed to load item');
      } finally {
        setIsLoading(false);
      }
    }

    fetchItem();
  }, [id]);

  // Search for products
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setScrapedData(null);
    setSelectedUrl(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Search failed', data.error);
      } else {
        setSearchResults(data.results || []);
        if (data.results?.length === 0) {
          notify.warning('No results', 'Try a different search query');
        }
      }
    } catch {
      setError('Search failed');
      notify.error('Search failed', 'Please try again');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Scrape selected URL
  const handleScrape = useCallback(async (url: string) => {
    setIsScraping(true);
    setSelectedUrl(url);
    setError(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Scrape failed', data.error);
        setSelectedUrl(null);
      } else {
        // Extract scraped data
        const scraped: ScrapedData = {
          brand: data.extracted?.brand || data.jsonLd?.brand,
          title: data.extracted?.title || data.jsonLd?.name,
          description: data.htmlParsed?.descriptionHtml || data.jsonLd?.description || data.htmlParsed?.description,
          images: data.htmlParsed?.images || [],
          specifications: data.htmlParsed?.specifications || {},
          rrp: data.extracted?.rrp || data.jsonLd?.offers?.price,
        };
        
        setScrapedData(scraped);
        notify.success('Data scraped', `Found ${scraped.images.length} images`);
      }
    } catch {
      setError('Scrape failed');
      notify.error('Scrape failed', 'Please try a different URL');
      setSelectedUrl(null);
    } finally {
      setIsScraping(false);
    }
  }, []);

  // Save enriched data to item
  const handleSave = useCallback(async () => {
    if (!scrapedData || !item) return;

    setIsSaving(true);
    setError(null);

    try {
      // Prepare update data
      const updateData: Partial<InventoryItem> = {
        listing_status: 'ready_to_sell',
        source_url: selectedUrl,
      };

      // Add images if found
      if (scrapedData.images.length > 0) {
        updateData.image_urls = scrapedData.images.slice(0, 10); // Max 10 images
      }

      // Add description if found
      if (scrapedData.description) {
        updateData.description_html = scrapedData.description;
      }

      // Add title if not already set
      if (scrapedData.title && !item.title) {
        updateData.title = scrapedData.title;
      }

      // Add specifications
      if (Object.keys(scrapedData.specifications).length > 0) {
        updateData.specifications = {
          ...item.specifications,
          ...scrapedData.specifications,
        };
      }

      // Update RRP if found and not already set
      if (scrapedData.rrp && !item.rrp_aud) {
        updateData.rrp_aud = scrapedData.rrp;
        updateData.rrp_source = selectedUrl || undefined;
      }

      const response = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Save failed', data.error);
      } else {
        notify.success('Item enriched', 'Product data has been updated');
        router.push(`/inventory/${id}`);
      }
    } catch {
      setError('Failed to save');
      notify.error('Save failed', 'Please try again');
    } finally {
      setIsSaving(false);
    }
  }, [id, item, scrapedData, selectedUrl, router]);

  const formatPrice = (price: number | undefined | null) => {
    if (!price) return '-';
    return `$${price.toLocaleString('en-AU')}`;
  };

  if (isLoading) {
    return (
      <Shell title="Loading..." subtitle="">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      </Shell>
    );
  }

  if (error && !item) {
    return (
      <Shell title="Error" subtitle="">
        <Card className="p-8 text-center">
          <p className="text-red-600">{error}</p>
          <Button className="mt-4" onClick={() => router.back()}>
            Go Back
          </Button>
        </Card>
      </Shell>
    );
  }

  if (!item) {
    return (
      <Shell title="Not Found" subtitle="">
        <Card className="p-8 text-center">
          <p className="text-zinc-500">Item not found</p>
          <Button className="mt-4" onClick={() => router.push('/inventory')}>
            Back to Inventory
          </Button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell 
      title={`Enrich: ${item.brand} ${item.model}`}
      subtitle="Search and scrape product information from Australian retailers"
    >
      <div className="max-w-4xl mx-auto py-6 space-y-6">
        {/* Back Link */}
        <Link 
          href={`/inventory/${id}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Item
        </Link>

        {/* Item Info Card */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900 dark:text-white">
                {item.brand} {item.model}
              </h2>
              <div className="flex gap-4 text-sm text-zinc-500">
                {item.sku && <span>SKU: {item.sku}</span>}
                <span>Cost: {formatPrice(item.cost_price)}</span>
                <span>RRP: {formatPrice(item.rrp_aud)}</span>
                <span>Sale: {formatPrice(item.sale_price)}</span>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              Pending Enrichment
            </div>
          </div>
        </Card>

        {/* Search Section */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            Search for Product Information
          </h3>
          
          <div className="flex gap-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brand, model..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button 
              onClick={handleSearch}
              isLoading={isSearching}
              disabled={!searchQuery.trim()}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search AU Retailers
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Search Results
              </h4>
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-700">
                {searchResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-4 ${selectedUrl === result.url ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-zinc-900 dark:text-white truncate">
                          {result.title}
                        </h5>
                        <p className="text-sm text-zinc-500 truncate">
                          {result.domain}
                        </p>
                        {result.snippet && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                            {result.snippet}
                          </p>
                        )}
                      </div>
                      <Button
                        variant={selectedUrl === result.url ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => handleScrape(result.url)}
                        isLoading={isScraping && selectedUrl === result.url}
                        disabled={isScraping}
                      >
                        {selectedUrl === result.url && scrapedData ? 'Selected' : 'Select & Scrape'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Scraped Data Preview */}
        {scrapedData && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Scraped Data Preview
              </h3>
              <Button
                onClick={handleSave}
                isLoading={isSaving}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save & Complete Enrichment
              </Button>
            </div>

            {/* Images */}
            {scrapedData.images.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Images ({scrapedData.images.length})
                </h4>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {scrapedData.images.slice(0, 10).map((url, index) => (
                    <div 
                      key={index}
                      className="w-20 h-20 flex-shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-zinc-100 dark:bg-zinc-800"
                    >
                      { }
                      <img 
                        src={url} 
                        alt={`Product ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {scrapedData.description && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Description
                </h4>
                <div 
                  className="text-sm text-zinc-600 dark:text-zinc-400 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg max-h-40 overflow-y-auto"
                  dangerouslySetInnerHTML={{ 
                    __html: scrapedData.description.substring(0, 500) + (scrapedData.description.length > 500 ? '...' : '')
                  }}
                />
              </div>
            )}

            {/* Specifications */}
            {Object.keys(scrapedData.specifications).length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Specifications ({Object.keys(scrapedData.specifications).length})
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm max-h-48 overflow-y-auto">
                  {Object.entries(scrapedData.specifications).slice(0, 20).map(([key, value]) => (
                    <div key={key} className="flex gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{key}:</span>
                      <span className="text-zinc-600 dark:text-zinc-400 truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RRP */}
            {scrapedData.rrp && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  RRP Found: {formatPrice(scrapedData.rrp)}
                </span>
              </div>
            )}

            {/* No data warning */}
            {!scrapedData.images.length && !scrapedData.description && Object.keys(scrapedData.specifications).length === 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                <p className="text-amber-700 dark:text-amber-400">
                  Limited data extracted. Try a different retailer for better results.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    </Shell>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { notify } from '@/lib/store/app-store';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
  isAustralian?: boolean;
}

export default function NewRetailListerPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<'search' | 'scrape' | 'review'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search for products
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setSearchResults([]);

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
        if (data.results?.length > 0) {
          notify.success('Search complete', `Found ${data.results.length} results`);
        } else {
          notify.info('No results', 'Try a different search query');
        }
      }
    } catch (err) {
      setError('Search failed. Please try again.');
      notify.error('Search failed', 'Please try again');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Scrape selected URL
  const handleScrape = useCallback(async (url: string) => {
    setSelectedUrl(url);
    setIsScraping(true);
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
        notify.error('Scraping failed', data.error);
        setIsScraping(false);
      } else {
        setScrapedData(data);
        // Update selectedUrl to the actual product page URL (if we followed a search result)
        if (data.scrapedUrl && data.scrapedUrl !== url) {
          setSelectedUrl(data.scrapedUrl);
          notify.info('Followed to product', 'Found product page from search results');
        }
        setStep('review');
        notify.success('Data scraped', 'Product data extracted successfully');
        setIsScraping(false);
      }
    } catch (err) {
      setError('Scraping failed. Please try again.');
      notify.error('Scraping failed', 'Please try again');
      setIsScraping(false);
    }
  }, []);

  // Create inventory item from scraped data
  const handleCreate = useCallback(async () => {
    if (!scrapedData) return;

    try {
      const rawData = scrapedData as {
        extracted?: { brand?: string; model?: string; title?: string; price?: number; description?: string };
        scrapedUrl?: string;
        jsonLd?: { brand?: unknown; name?: unknown; sku?: string; description?: string; offers?: { price?: string } };
        htmlParsed?: { 
          brand?: string; 
          title?: string; 
          price?: string; 
          description?: string; 
          sku?: string;
          images?: string[];
          specifications?: Record<string, string>;
        };
      };

      // Helper to extract string from potentially complex JSON-LD values
      const extractString = (value: unknown): string | null => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (typeof value === 'object' && value !== null) {
          const obj = value as Record<string, unknown>;
          if (obj.name && typeof obj.name === 'string') return obj.name;
        }
        return null;
      };

      // Use extracted data first (already processed by API), fallback to jsonLd/htmlParsed
      const brand = rawData.extracted?.brand || extractString(rawData.jsonLd?.brand) || rawData.htmlParsed?.brand || 'Unknown';
      // Use model (title with brand removed) if available, otherwise use full title
      const model = rawData.extracted?.model || rawData.extracted?.title || extractString(rawData.jsonLd?.name) || rawData.htmlParsed?.title || 'Unknown';
      const price = rawData.extracted?.price || parseFloat(rawData.jsonLd?.offers?.price || rawData.htmlParsed?.price || '0') || 0;
      const description = rawData.extracted?.description || rawData.htmlParsed?.description || rawData.jsonLd?.description || null;
      const sku = rawData.jsonLd?.sku || rawData.htmlParsed?.sku || null;
      // Use the actual scraped URL (may be different from selectedUrl if we followed a search result)
      const sourceUrl = rawData.scrapedUrl || selectedUrl;
      // Get scraped images and specifications
      const imageUrls = rawData.htmlParsed?.images || [];
      const specifications = rawData.htmlParsed?.specifications || {};

      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_type: 'new',
          brand,
          model,
          sku,
          rrp_aud: price || null,
          sale_price: price || 0,
          source_url: sourceUrl,
          description_html: description,
          image_urls: imageUrls,
          specifications: specifications,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Create failed', data.error);
      } else {
        notify.success('Listing created', 'Redirecting to inventory item...');
        router.push(`/inventory/${data.item.id}`);
      }
    } catch (err) {
      setError('Failed to create listing.');
      notify.error('Create failed', 'Failed to create listing');
    }
  }, [scrapedData, selectedUrl, router]);

  return (
    <Shell 
      title="New Retail Product" 
      subtitle="Search and scrape product data"
    >
      <div className="max-w-4xl mx-auto">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {['Search', 'Select Source', 'Review'].map((label, i) => {
            const stepNum = i + 1;
            const currentStep = step === 'search' ? 1 : step === 'scrape' ? 2 : 3;
            const isActive = stepNum === currentStep;
            const isComplete = stepNum < currentStep;

            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete 
                    ? 'bg-emerald-500 text-white'
                    : isActive
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                }`}>
                  {isComplete ? '✓' : stepNum}
                </div>
                <span className={`text-sm ${isActive ? 'text-zinc-900 dark:text-white font-medium' : 'text-zinc-500'}`}>
                  {label}
                </span>
                {i < 2 && (
                  <div className={`w-12 h-0.5 ${isComplete ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Step 1: Search */}
        {step === 'search' && (
          <div className="space-y-6">
            {/* Direct URL Input - Primary Option */}
            <Card className="p-6 border-2 border-emerald-500/50">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
                    Paste Product URL
                  </h2>
                  <p className="text-sm text-zinc-500 mb-4">
                    Paste a direct link to the product page (manufacturer site, retailer, etc.)
                  </p>
                  <div className="flex gap-3">
                    <Input
                      value={selectedUrl}
                      onChange={(e) => setSelectedUrl(e.target.value)}
                      placeholder="https://www.marantz.com/en-au/product/..."
                      className="flex-1"
                    />
                    <Button
                      onClick={() => selectedUrl && handleScrape(selectedUrl)}
                      isLoading={isScraping}
                      disabled={!selectedUrl || !selectedUrl.startsWith('http')}
                    >
                      Scrape URL
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              <span className="text-sm text-zinc-500">or search for a product</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            </div>

            {/* Search - Secondary Option */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                Search for Product
              </h2>
              <form onSubmit={handleSearch} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Product Name
                  </label>
                  <div className="flex gap-3">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g., Marantz AV30"
                      className="flex-1"
                    />
                    <Button type="submit" isLoading={isSearching} variant="secondary">
                      Search
                    </Button>
                  </div>
                </div>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Select a source to scrape:
                  </h3>
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => handleScrape(result.url)}
                      disabled={isScraping}
                      className="w-full p-4 text-left bg-zinc-50 dark:bg-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-white">
                            {result.title}
                          </p>
                          <p className="text-sm text-zinc-500 mt-1">
                            {result.snippet}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm text-emerald-600 font-medium">
                            {result.domain}
                          </p>
                          {result.isAustralian && (
                            <span className="text-xs text-zinc-500">🇦🇺 AU</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && scrapedData && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Review Scraped Data
            </h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <p className="text-sm text-zinc-500 mb-1">Source</p>
                <p className="text-zinc-900 dark:text-white truncate">{selectedUrl}</p>
              </div>

              {(() => {
                const data = scrapedData as {
                  extracted?: { brand?: string; model?: string; title?: string; price?: number; description?: string; hasJsonLd?: boolean; imageCount?: number; specCount?: number };
                  scrapedUrl?: string;
                  followedSearchResult?: boolean;
                  jsonLd?: { brand?: unknown; name?: unknown };
                  htmlParsed?: { brand?: string; title?: string };
                };
                
                // Use the pre-extracted values from the API
                const brand = data.extracted?.brand;
                const model = data.extracted?.model || data.extracted?.title;
                const price = data.extracted?.price;

                return (
                  <>
                    {data.followedSearchResult && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-400">
                          ℹ️ Automatically navigated from search results to product page
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <p className="text-sm text-zinc-500 mb-1">Brand</p>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {brand || 'Not found'}
                        </p>
                      </div>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <p className="text-sm text-zinc-500 mb-1">Model</p>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {model || 'Not found'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <p className="text-sm text-zinc-500 mb-1">RRP</p>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {price ? `$${price.toLocaleString()}` : 'Not found'}
                        </p>
                      </div>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <p className="text-sm text-zinc-500 mb-1">Images</p>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {data.extracted?.imageCount || 0} found
                        </p>
                      </div>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        <p className="text-sm text-zinc-500 mb-1">Specs</p>
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {data.extracted?.specCount || 0} items
                        </p>
                      </div>
                    </div>

                    {data.extracted?.hasJsonLd && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">
                          ✓ Structured data (JSON-LD) found - high accuracy extraction
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setStep('search')}>
                  Back to Search
                </Button>
                <Button onClick={handleCreate} className="flex-1">
                  Create Listing
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Shell>
  );
}

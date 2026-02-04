'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ProductOnboarding, RawScrapedData } from '@/types';

interface ProductPreviewProps {
  product: ProductOnboarding;
  onClose: () => void;
  onPushToShopify?: () => void;
  isPushing?: boolean;
  isShopifyConfigured?: boolean;
}

export function ProductPreview({
  product,
  onClose,
  onPushToShopify,
  isPushing = false,
  isShopifyConfigured = false,
}: ProductPreviewProps) {
  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>('desktop');
  const rawData = product.raw_scraped_json as RawScrapedData | null;
  
  const title = rawData?.aiGenerated?.title || product.title || `${product.brand} ${product.model_number}`;
  const description = rawData?.aiGenerated?.descriptionHtml || '';
  const metaDescription = rawData?.aiGenerated?.metaDescription || '';
  const images = rawData?.processedImages || rawData?.htmlParsed?.images?.map((url, i) => ({
    publicUrl: url,
    altText: rawData?.aiGenerated?.altTexts?.[i] || `${product.brand} ${product.model_number} image ${i + 1}`,
  })) || [];
  const specifications = rawData?.htmlParsed?.specifications || {};
  const salesPrice = product.sales_price;
  const rrp = product.rrp_aud;

  // Generate specs table HTML
  const specsTableHtml = Object.keys(specifications).length > 0 
    ? `<div class="specifications-section">
        <h3>Technical Specifications</h3>
        <table class="specifications-table">
          <tbody>
            ${Object.entries(specifications).map(([key, value]) => 
              `<tr><th>${key}</th><td>${value}</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </div>`
    : '';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-4 md:inset-8 lg:inset-12 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Product Preview
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              See how your product will appear on Shopify
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Device toggle */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('desktop')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'desktop' 
                    ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-100' 
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Desktop
              </button>
              <button
                onClick={() => setActiveTab('mobile')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'mobile' 
                    ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-100' 
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Mobile
              </button>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Preview Content */}
        <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-800 p-6">
          <div 
            className={`mx-auto bg-white dark:bg-zinc-900 rounded-lg shadow-lg overflow-hidden transition-all ${
              activeTab === 'mobile' ? 'max-w-sm' : 'max-w-5xl'
            }`}
          >
            {/* Simulated browser chrome */}
            <div className="bg-zinc-200 dark:bg-zinc-700 px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white dark:bg-zinc-800 rounded px-3 py-1 text-xs text-zinc-500 truncate">
                yourstore.myshopify.com/products/{product.brand.toLowerCase()}-{product.model_number.toLowerCase()}
              </div>
            </div>
            
            {/* Product page content */}
            <div className={`p-6 ${activeTab === 'mobile' ? '' : 'grid grid-cols-2 gap-8'}`}>
              {/* Images */}
              <div className={activeTab === 'mobile' ? 'mb-6' : ''}>
                {images.length > 0 ? (
                  <div className="space-y-4">
                    <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
                      <img
                        src={images[0].publicUrl}
                        alt={images[0].altText}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {images.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {images.slice(0, 4).map((img, i) => (
                          <div key={i} className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                            <img
                              src={img.publicUrl}
                              alt={img.altText}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                    <span className="text-zinc-400">No images</span>
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                  {product.brand}
                </p>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                  {title}
                </h1>
                
                {/* Price */}
                <div className="mb-6">
                  {salesPrice && (
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-bold text-emerald-600">
                        ${salesPrice.toLocaleString()}
                      </span>
                      {rrp && rrp > salesPrice && (
                        <span className="text-lg text-zinc-400 line-through">
                          ${rrp.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-zinc-500 mt-1">Inc. GST</p>
                </div>
                
                {/* Add to cart button (simulated) */}
                <div className="flex gap-3 mb-6">
                  <button className="flex-1 bg-emerald-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                    Add to Cart
                  </button>
                  <button className="p-3 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
                
                {/* SKU */}
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                  SKU: {product.model_number}
                </p>
                
                {/* Meta description preview */}
                {metaDescription && (
                  <Card className="bg-zinc-50 dark:bg-zinc-800/50 mb-6">
                    <p className="text-xs text-zinc-500 mb-1">Meta Description (SEO)</p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{metaDescription}</p>
                    <p className="text-xs text-zinc-400 mt-1">{metaDescription.length} characters</p>
                  </Card>
                )}
              </div>
            </div>
            
            {/* Description section */}
            <div className="px-6 pb-6">
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Description
                </h2>
                <div 
                  className="product-description-content prose-product text-zinc-700 dark:text-zinc-300"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              </div>
              
              {/* Specifications */}
              {Object.keys(specifications).length > 0 && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6 mt-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                    Technical Specifications
                  </h2>
                  <table className="specifications-table w-full">
                    <tbody>
                      {Object.entries(specifications).map(([key, value]) => (
                        <tr key={key}>
                          <th className="text-left py-2 pr-4 text-zinc-600 dark:text-zinc-400 font-medium w-1/3">{key}</th>
                          <td className="py-2 text-zinc-900 dark:text-zinc-100">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Status:</span>{' '}
            {product.shopify_product_id ? (
              <span className="text-emerald-600">Synced to Shopify</span>
            ) : (
              <span className="text-amber-600">Draft - Not published</span>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Close Preview
            </Button>
            {onPushToShopify && (
              <Button 
                onClick={onPushToShopify}
                isLoading={isPushing}
                disabled={!isShopifyConfigured || isPushing}
              >
                {!isShopifyConfigured ? (
                  'Shopify Not Configured'
                ) : product.shopify_product_id ? (
                  'Update on Shopify'
                ) : (
                  'Push to Shopify'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

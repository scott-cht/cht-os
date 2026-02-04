'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CameraCapture } from '@/components/lister/CameraCapture';
import type { VisionAIResponse, RRPSearchResult, ConditionGrade } from '@/types';

const DEFAULT_DISCOUNT = 0.25; // 25% off for ex-demo (less than trade-in)

const CONDITION_GRADES: { value: ConditionGrade; label: string; description: string }[] = [
  { value: 'mint', label: 'Mint', description: 'Like new' },
  { value: 'excellent', label: 'Excellent', description: 'Minor wear' },
  { value: 'good', label: 'Good', description: 'Normal wear' },
  { value: 'fair', label: 'Fair', description: 'Visible wear' },
  { value: 'poor', label: 'Poor', description: 'Heavy wear' },
];

export default function ExDemoListerPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<'capture' | 'details' | 'review'>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [visionResult, setVisionResult] = useState<VisionAIResponse | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isFetchingRRP, setIsFetchingRRP] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [conditionGrade, setConditionGrade] = useState<ConditionGrade | null>('excellent'); // Ex-demo defaults to excellent
  const [conditionReport, setConditionReport] = useState('Former demonstration unit.');
  const [rrpAud, setRrpAud] = useState<number | null>(null);
  const [rrpSource, setRrpSource] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState<number | null>(null);

  // Handle camera capture
  const handleCapture = useCallback(async (imageData: string) => {
    setCapturedImage(imageData);
    setIsIdentifying(true);
    setError(null);

    try {
      const response = await fetch('/api/vision/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });

      const result = await response.json();

      if (result.success) {
        setVisionResult(result);
        setBrand(result.brand || '');
        setModel(result.model || '');
        setSerialNumber(result.serial_number || '');

        if (result.brand && result.model) {
          fetchRRP(result.brand, result.model);
        }
      }

      setStep('details');
    } catch (err) {
      setError('Failed to identify product');
      setStep('details');
    } finally {
      setIsIdentifying(false);
    }
  }, []);

  // Fetch RRP
  const fetchRRP = useCallback(async (b: string, m: string) => {
    setIsFetchingRRP(true);

    try {
      const response = await fetch('/api/rrp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: b, model: m }),
      });

      const result: RRPSearchResult = await response.json();

      if (result.rrp_aud) {
        setRrpAud(result.rrp_aud);
        setRrpSource(result.source);
        setSalePrice(Math.round(result.rrp_aud * (1 - DEFAULT_DISCOUNT)));
      }
    } catch (err) {
      console.error('RRP fetch error:', err);
    } finally {
      setIsFetchingRRP(false);
    }
  }, []);

  const handleRRPChange = useCallback((value: number) => {
    setRrpAud(value);
    setRrpSource('manual');
    setSalePrice(Math.round(value * (1 - DEFAULT_DISCOUNT)));
  }, []);

  const handleSkipCamera = useCallback(() => {
    setStep('details');
  }, []);

  const handleCreate = useCallback(async () => {
    if (!brand || !model || !salePrice) {
      setError('Brand, model, and sale price are required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_type: 'ex_demo',
          brand,
          model,
          serial_number: serialNumber || null,
          rrp_aud: rrpAud,
          sale_price: salePrice,
          condition_grade: conditionGrade,
          condition_report: conditionReport || null,
          image_urls: capturedImage ? [capturedImage] : [],
          vision_ai_response: visionResult,
          rrp_source: rrpSource,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        router.push(`/inventory/${data.item.id}`);
      }
    } catch (err) {
      setError('Failed to create listing');
    } finally {
      setIsCreating(false);
    }
  }, [brand, model, serialNumber, rrpAud, salePrice, conditionGrade, conditionReport, capturedImage, visionResult, rrpSource, router]);

  return (
    <Shell 
      title="Ex-Demo Listing" 
      subtitle="Former demonstration unit"
      noPadding={step === 'capture'}
      fullWidth={step === 'capture'}
    >
      {/* Step 1: Camera */}
      {step === 'capture' && (
        <div className="h-[calc(100vh-4rem)]">
          <CameraCapture
            onCapture={handleCapture}
            onCancel={handleSkipCamera}
            isProcessing={isIdentifying}
          />
        </div>
      )}

      {/* Step 2: Details */}
      {step === 'details' && (
        <div className="max-w-2xl mx-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Ex-Demo Banner */}
          <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏷️</span>
              <div>
                <p className="font-medium text-purple-700 dark:text-purple-400">Ex-Demonstration Unit</p>
                <p className="text-sm text-purple-600 dark:text-purple-500">
                  Default 25% below RRP • Excellent condition assumed
                </p>
              </div>
            </div>
          </div>

          {capturedImage && (
            <Card className="mb-6 p-0 overflow-hidden">
              <img src={capturedImage} alt="Captured" className="w-full h-48 object-cover" />
              {visionResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">
                    AI identified: {visionResult.brand} {visionResult.model}
                  </span>
                </div>
              )}
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">
              Product Details
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Brand *</label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g., Marantz" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Model *</label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g., AV30" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Serial Number <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="If available" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Condition Grade</label>
                <div className="grid grid-cols-5 gap-2">
                  {CONDITION_GRADES.map((grade) => (
                    <button
                      key={grade.value}
                      onClick={() => setConditionGrade(grade.value)}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        conditionGrade === grade.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <span className="block text-sm font-medium">{grade.label}</span>
                      <span className="block text-xs text-zinc-500">{grade.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Condition Notes</label>
                <textarea
                  value={conditionReport}
                  onChange={(e) => setConditionReport(e.target.value)}
                  rows={2}
                  placeholder="Any additional notes..."
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
                <h3 className="font-medium text-zinc-900 dark:text-white mb-4">Pricing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">RRP (AUD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                      <Input
                        type="number"
                        value={rrpAud || ''}
                        onChange={(e) => handleRRPChange(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="pl-7"
                      />
                    </div>
                    {rrpSource && rrpSource !== 'manual' && (
                      <p className="text-xs text-zinc-500 mt-1">Found at {rrpSource}</p>
                    )}
                    {!rrpAud && brand && model && (
                      <Button variant="ghost" size="sm" onClick={() => fetchRRP(brand, model)} isLoading={isFetchingRRP} className="mt-2">
                        Search for RRP
                      </Button>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Sale Price (AUD) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                      <Input
                        type="number"
                        value={salePrice || ''}
                        onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="pl-7"
                      />
                    </div>
                    {rrpAud && salePrice && (
                      <p className="text-xs text-purple-600 mt-1">{Math.round((1 - salePrice / rrpAud) * 100)}% below RRP</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setStep('capture')}>Retake Photo</Button>
                <Button onClick={() => setStep('review')} className="flex-1" disabled={!brand || !model || !salePrice}>
                  Continue to Review
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div className="max-w-2xl mx-auto p-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">Review Ex-Demo Listing</h2>

            {capturedImage && (
              <img src={capturedImage} alt="Product" className="w-full h-48 object-cover rounded-lg mb-6" />
            )}

            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Type</span>
                <span className="font-medium text-purple-600">Ex-Demo</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Brand</span>
                <span className="font-medium">{brand}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Model</span>
                <span className="font-medium">{model}</span>
              </div>
              {serialNumber && (
                <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">Serial #</span>
                  <span className="font-medium">{serialNumber}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Condition</span>
                <span className="font-medium capitalize">{conditionGrade}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">RRP</span>
                <span className="text-zinc-400 line-through">${rrpAud?.toLocaleString() || '—'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Sale Price</span>
                <span className="text-2xl font-bold text-purple-600">${salePrice?.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Will sync to:</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Shopify (DRAFT + ex-demo tag)
                </span>
                <span className="px-2 py-1 text-xs rounded bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                  Notion
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setStep('details')}>Back</Button>
              <Button onClick={handleCreate} isLoading={isCreating} className="flex-1">Create Listing</Button>
            </div>
          </Card>
        </div>
      )}
    </Shell>
  );
}

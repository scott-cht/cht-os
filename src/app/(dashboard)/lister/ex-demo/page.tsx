'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CameraCapture } from '@/components/lister/CameraCapture';
import { notify } from '@/lib/store/app-store';
import type { VisionAIResponse } from '@/types';

export default function RegisterDemoPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<'choice' | 'capture' | 'details' | 'review'>('choice');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [visionResult, setVisionResult] = useState<VisionAIResponse | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [costPrice, setCostPrice] = useState<number | null>(null);
  const [demoStartDate, setDemoStartDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [demoLocation, setDemoLocation] = useState('');

  // Handle camera capture (for AI identification)
  const handleCapture = useCallback(async (imageData: string, allImages?: string[]) => {
    setCapturedImages(allImages || [imageData]);
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
        notify.success('Product identified', `${result.brand} ${result.model}`);
      } else {
        notify.warning('Identification uncertain', 'Please verify product details');
      }

      setStep('details');
    } catch {
      setError('Failed to identify product');
      notify.error('Identification failed', 'Please enter details manually');
      setStep('details');
    } finally {
      setIsIdentifying(false);
    }
  }, []);

  const handleManualEntry = useCallback(() => {
    setStep('details');
  }, []);

  // Create demo registration (NOT for sale)
  const handleCreate = useCallback(async () => {
    if (!brand || !model) {
      setError('Brand and model are required');
      return;
    }

    if (!costPrice || costPrice <= 0) {
      setError('Cost price is required');
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
          listing_status: 'on_demo', // NOT for sale yet
          brand,
          model,
          serial_number: serialNumber || null,
          cost_price: costPrice,
          sale_price: 0, // No sale price yet - not for sale
          demo_start_date: demoStartDate,
          demo_location: demoLocation || null,
          registration_images: capturedImages, // Store as registration photos
          image_urls: [], // No selling images yet
          vision_ai_response: visionResult,
          sync_status: 'pending', // Won't sync until ready to sell
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        notify.error('Registration failed', data.error);
      } else {
        notify.success('Demo registered', `${brand} ${model} added to demo inventory`);
        router.push('/demo-inventory?registered=true');
      }
    } catch {
      setError('Failed to register demo unit');
      notify.error('Registration failed', 'Failed to register demo unit');
    } finally {
      setIsCreating(false);
    }
  }, [brand, model, serialNumber, costPrice, demoStartDate, demoLocation, capturedImages, visionResult, router]);

  return (
    <Shell 
      title="Register Demo Unit" 
      subtitle="Track demonstration stock before selling"
      noPadding={step === 'capture'}
      fullWidth={step === 'capture'}
    >
      {/* Step 0: Choose method */}
      {step === 'choice' && (
        <div className="max-w-2xl mx-auto p-6">
          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-400">Demo Registration</p>
                <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                  Record demo units when they go on display. You&apos;ll be able to convert them to a listing when you&apos;re ready to sell.
                </p>
              </div>
            </div>
          </div>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">
              How would you like to register the demo unit?
            </h2>

            <div className="grid gap-4">
              <button
                onClick={() => setStep('capture')}
                className="p-6 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-600 text-left transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">Take Photo for AI Identification</p>
                    <p className="text-sm text-zinc-500">Snap a photo of the product label and we&apos;ll auto-fill the details</p>
                  </div>
                </div>
              </button>

              <button
                onClick={handleManualEntry}
                className="p-6 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-600 text-left transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <svg className="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">Enter Details Manually</p>
                    <p className="text-sm text-zinc-500">Type in the brand, model, and serial number yourself</p>
                  </div>
                </div>
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Step 1: Camera Capture */}
      {step === 'capture' && (
        <div className="h-[calc(100vh-4rem)]">
          <CameraCapture
            onCapture={handleCapture}
            onCancel={() => setStep('choice')}
            isProcessing={isIdentifying}
            multiple={true}
            maxPhotos={5}
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

          {/* Demo Registration Banner */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏷️</span>
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-400">Demo Registration</p>
                <p className="text-sm text-blue-600 dark:text-blue-500">
                  This unit will be tracked as &quot;On Demo&quot; until you&apos;re ready to sell
                </p>
              </div>
            </div>
          </div>

          {/* Captured Images Preview */}
          {capturedImages.length > 0 && (
            <Card className="mb-6 p-0 overflow-hidden">
              { }
              <img src={capturedImages[0]} alt="Demo Unit" className="w-full h-48 object-cover" />
              {capturedImages.length > 1 && (
                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 flex gap-2 overflow-x-auto">
                  {capturedImages.map((img, idx) => (
                     
                    <img 
                      key={idx} 
                      src={img} 
                      alt={`Photo ${idx + 1}`} 
                      className={`w-12 h-12 object-cover rounded ${idx === 0 ? 'ring-2 ring-blue-500' : ''}`}
                    />
                  ))}
                </div>
              )}
              {visionResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">
                    AI identified: {visionResult.brand} {visionResult.model}
                    <span className="text-emerald-600/70 ml-1">
                      ({Math.round(visionResult.confidence * 100)}% confident)
                    </span>
                  </span>
                </div>
              )}
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">
              Demo Unit Details
            </h2>

            <div className="space-y-6">
              {/* Brand & Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Brand *
                  </label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g., Marantz"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Model *
                  </label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g., AV30"
                  />
                </div>
              </div>

              {/* Serial Number */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Serial Number <span className="text-zinc-400 font-normal">(recommended)</span>
                </label>
                <Input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Enter serial number"
                />
              </div>

              {/* Demo Date */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Demo Start Date *
                </label>
                <Input
                  type="date"
                  value={demoStartDate}
                  onChange={(e) => setDemoStartDate(e.target.value)}
                />
                <p className="text-xs text-zinc-500 mt-1">When did this unit go on demonstration?</p>
              </div>

              {/* Demo Location (optional, for future) */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Demo Location <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <Input
                  value={demoLocation}
                  onChange={(e) => setDemoLocation(e.target.value)}
                  placeholder="e.g., Showroom 1, Front Display"
                />
              </div>

              {/* Cost Price */}
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
                <h3 className="font-medium text-zinc-900 dark:text-white mb-4">Cost Information</h3>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Cost Price (AUD) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <Input
                      type="number"
                      value={costPrice || ''}
                      onChange={(e) => setCostPrice(parseFloat(e.target.value) || null)}
                      placeholder="What did we pay for this demo?"
                      className="pl-7"
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    The cost price you paid for this demo unit (including any demo allowance)
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setStep('choice')}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep('review')}
                  className="flex-1"
                  disabled={!brand || !model || !costPrice}
                >
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
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">
              Review Demo Registration
            </h2>

            {capturedImages.length > 0 && (
              <div className="mb-6">
                { }
                <img src={capturedImages[0]} alt="Demo Unit" className="w-full h-48 object-cover rounded-lg" />
                {capturedImages.length > 1 && (
                  <p className="text-xs text-zinc-500 text-center mt-2">
                    +{capturedImages.length - 1} more photo{capturedImages.length > 2 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Status</span>
                <span className="font-medium text-blue-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  On Demo (Not for Sale)
                </span>
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
                  <span className="font-medium font-mono">{serialNumber}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Demo Start Date</span>
                <span className="font-medium">
                  {new Date(demoStartDate).toLocaleDateString('en-AU', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </span>
              </div>
              {demoLocation && (
                <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">Location</span>
                  <span className="font-medium">{demoLocation}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Cost Price</span>
                <span className="text-xl font-bold text-zinc-900 dark:text-white">
                  ${costPrice?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Info about next steps */}
            <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">What happens next?</p>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  This demo unit will appear in your Demo Inventory
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  It will NOT be pushed to Shopify until you&apos;re ready to sell
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  You can convert it to a listing when you decide to sell
                </li>
              </ul>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setStep('details')}>
                Back
              </Button>
              <Button onClick={handleCreate} isLoading={isCreating} className="flex-1">
                Register Demo Unit
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Shell>
  );
}

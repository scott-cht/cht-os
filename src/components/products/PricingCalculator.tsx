'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { calculatePricing, formatAUD } from '@/lib/utils/pricing';

interface PricingCalculatorProps {
  rrpAud: number | null;
  initialCostPrice?: number | null;
  initialSalesPrice?: number | null;
  onSave: (costPrice: number, salesPrice: number, discountPercent: number) => Promise<void>;
  isSaving?: boolean;
}

export function PricingCalculator({
  rrpAud,
  initialCostPrice,
  initialSalesPrice,
  onSave,
  isSaving,
}: PricingCalculatorProps) {
  const [costPrice, setCostPrice] = useState<string>(initialCostPrice?.toString() || '');
  const [discountPercent, setDiscountPercent] = useState<string>('');

  const initialDiscountPercent = useMemo(() => {
    if (rrpAud && initialSalesPrice) {
      const calculatedDiscount = ((rrpAud - initialSalesPrice) / rrpAud) * 100;
      return Math.round(calculatedDiscount).toString();
    }
    return '0';
  }, [rrpAud, initialSalesPrice]);

  const activeDiscountPercent = discountPercent === '' ? initialDiscountPercent : discountPercent;

  const pricing = useMemo(() => {
    if (!rrpAud) return null;
    const cost = parseFloat(costPrice) || 0;
    const discount = parseFloat(activeDiscountPercent) || 0;
    return calculatePricing(rrpAud, discount, cost);
  }, [rrpAud, costPrice, activeDiscountPercent]);

  const handleSave = async () => {
    if (pricing) {
      await onSave(
        parseFloat(costPrice) || 0,
        pricing.salesPrice,
        parseFloat(activeDiscountPercent) || 0
      );
    }
  };

  if (!rrpAud) {
    return (
      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <p className="text-amber-800 dark:text-amber-200 text-sm">
          RRP not available. Please extract product data first to calculate pricing.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* RRP Display */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Recommended Retail Price (RRP)
            </p>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatAUD(rrpAud)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Inc. GST
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Australian Dollars
            </p>
          </div>
        </div>
      </Card>

      {/* Input Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Input
            id="costPrice"
            label="Cost Price (AUD)"
            type="number"
            min="0"
            step="0.01"
            placeholder="Enter your cost price"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Your wholesale/supplier cost
          </p>
        </div>
        <div>
          <Input
            id="discountPercent"
            label="Discount from RRP (%)"
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="e.g., 15"
            value={activeDiscountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Percentage off RRP
          </p>
        </div>
      </div>

      {/* Discount Slider */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Quick Discount: {activeDiscountPercent}%
        </label>
        <input
          type="range"
          min="0"
          max="50"
          step="5"
          value={activeDiscountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex justify-between text-xs text-zinc-500 mt-1">
          <span>0%</span>
          <span>10%</span>
          <span>20%</span>
          <span>30%</span>
          <span>40%</span>
          <span>50%</span>
        </div>
      </div>

      {/* Calculated Sales Price */}
      {pricing && (
        <Card className={pricing.isBelowSafetyThreshold 
          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' 
          : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800'
        }>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Calculated Sales Price
              </p>
              <p className={`text-4xl font-bold ${
                pricing.isBelowSafetyThreshold 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {formatAUD(pricing.salesPrice)}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Whole AUD (no cents) as per AU standards
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Savings</p>
              <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {formatAUD(rrpAud - pricing.salesPrice)}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                ({discountPercent}% off)
              </p>
            </div>
          </div>

          {/* Margin Info */}
          {parseFloat(costPrice) > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Profit</p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatAUD(pricing.salesPrice - pricing.costPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Margin</p>
                  <p className={`text-lg font-semibold ${
                    pricing.isBelowSafetyThreshold 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {pricing.marginPercent.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Markup</p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {((pricing.salesPrice / pricing.costPrice - 1) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Safety Warning */}
          {pricing.isBelowSafetyThreshold && parseFloat(costPrice) > 0 && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  Below 20% Margin Safety Floor
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Sales price is less than cost × 1.2. Consider increasing the price or reducing costs.
                  Minimum safe price: {formatAUD(Math.ceil(pricing.costPrice * 1.2))}
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        isLoading={isSaving}
        disabled={!pricing || isSaving}
        size="lg"
        className="w-full"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Save Pricing
      </Button>
    </div>
  );
}

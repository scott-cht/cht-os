import type { PricingCalculation } from '@/types';

/**
 * Calculate retail pricing following AU standards from PRD
 * Sales Price = round(RRP * (1 - Discount%), 0)
 * Must be a whole Australian Dollar (no cents)
 */
export function calculatePricing(
  rrpAud: number,
  discountPercent: number,
  costPrice: number
): PricingCalculation {
  // Apply discount and round to whole dollar
  const salesPrice = Math.round(rrpAud * (1 - discountPercent / 100));
  
  // Calculate margin
  const marginPercent = costPrice > 0 
    ? ((salesPrice - costPrice) / costPrice) * 100 
    : 0;
  
  // Safety check: warn if below 20% margin floor
  const isBelowSafetyThreshold = salesPrice < costPrice * 1.2;
  
  return {
    rrpAud,
    discountPercent,
    salesPrice,
    costPrice,
    marginPercent,
    isBelowSafetyThreshold,
  };
}

/**
 * Format price as Australian currency
 */
export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parse price string to number (handles $, AUD, commas)
 */
export function parseAUDPrice(priceString: string): number {
  const cleaned = priceString
    .replace(/[AUD$,\s]/gi, '')
    .replace(/\.00$/, '');
  
  return parseFloat(cleaned) || 0;
}

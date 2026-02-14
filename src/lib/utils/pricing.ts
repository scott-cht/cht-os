import type { PricingCalculation } from '@/types';

/**
 * Unified Pricing Utilities for Australian Currency
 * 
 * Consolidates all price formatting and parsing functions.
 * Per PRD: "Ensure all currency handling is explicitly AUD (including GST)"
 */

// ============================================
// Price Parsing Functions
// ============================================

/**
 * Safely parse price string to number
 * Returns null if the input is invalid (preferred for validation)
 * 
 * @example
 * parsePrice('$1,234.56') // 1234.56
 * parsePrice('AUD 99') // 99
 * parsePrice('invalid') // null
 */
export function parsePrice(value: string | undefined | null): number | null {
  if (!value) return null;
  
  // Remove currency symbols, commas, and whitespace
  const cleaned = value.toString()
    .replace(/[AUD$,\s]/gi, '')
    .replace(/\.00$/, '')
    .trim();
  
  if (!cleaned) return null;
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse price string to number, returning 0 on invalid input
 * Use this for backwards compatibility where 0 is acceptable for invalid input
 * 
 * @deprecated Prefer parsePrice() for better error handling
 */
export function parseAUDPrice(priceString: string): number {
  return parsePrice(priceString) ?? 0;
}

// ============================================
// Price Formatting Functions
// ============================================

export interface FormatPriceOptions {
  /** Include cents (default: false for whole dollars) */
  includeCents?: boolean;
  /** Include currency symbol (default: true) */
  includeSymbol?: boolean;
  /** Show "inc GST" label (default: false) */
  showGstLabel?: boolean;
  /** Is price inclusive of GST (for label, default: true) */
  isIncGst?: boolean;
}

/**
 * Format number as Australian currency
 * Per PRD: Final prices must be whole Australian Dollars
 * 
 * @example
 * formatAUD(1234) // "$1,234"
 * formatAUD(1234.56, { includeCents: true }) // "$1,234.56"
 * formatAUD(1234, { showGstLabel: true }) // "$1,234 inc GST"
 */
export function formatAUD(
  amount: number | null | undefined,
  options: FormatPriceOptions = {}
): string {
  const {
    includeCents = false,
    includeSymbol = true,
    showGstLabel = false,
    isIncGst = true,
  } = options;
  
  if (amount === null || amount === undefined) {
    return includeSymbol ? '$0' : '0';
  }
  
  const formatted = new Intl.NumberFormat('en-AU', {
    style: includeSymbol ? 'currency' : 'decimal',
    currency: 'AUD',
    minimumFractionDigits: includeCents ? 2 : 0,
    maximumFractionDigits: includeCents ? 2 : 0,
  }).format(amount);
  
  if (showGstLabel) {
    return `${formatted} ${isIncGst ? 'inc GST' : 'ex GST'}`;
  }
  
  return formatted;
}

/**
 * Format currency for export (simple format without GST label)
 * Handles null values gracefully
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return formatAUD(value, { includeCents: true });
}

// ============================================
// Price Calculations
// ============================================

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
 * Calculate sales price from RRP with discount
 * Per PRD: "Sales Price = round(RRP * (1 - Discount%), 0)"
 */
export function calculateSalesPrice(
  rrpIncGst: number,
  discountPercent: number
): number {
  const discountedPrice = rrpIncGst * (1 - discountPercent / 100);
  return Math.round(discountedPrice);
}

/**
 * Round to whole dollars (per PRD requirement for sales price)
 */
export function roundToWholeDollars(value: number): number {
  return Math.round(value);
}

// ============================================
// Margin Calculations
// ============================================

/**
 * Calculate margin percentage
 * Per PRD: "UI Warning if Sales Price < (Cost Price * 1.2)" (20% margin floor)
 */
export function calculateMarginPercent(
  salePrice: number,
  costPrice: number
): number {
  if (costPrice <= 0) return 0;
  return ((salePrice - costPrice) / costPrice) * 100;
}

/**
 * Check if margin is above safety threshold (20%)
 */
export function isMarginAboveThreshold(
  salePrice: number,
  costPrice: number,
  threshold: number = 1.2
): boolean {
  return salePrice >= costPrice * threshold;
}

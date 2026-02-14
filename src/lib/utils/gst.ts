/**
 * Australian GST (Goods and Services Tax) Utilities
 * 
 * Per PRD: "Ensure all currency handling is explicitly AUD (including GST)"
 * 
 * Australian GST is 10% and applies to most goods and services.
 */

// GST rate in Australia
export const GST_RATE = 0.10;

// ============================================
// Price Calculations
// ============================================

export interface GSTBreakdown {
  /** Original input price */
  inputPrice: number;
  /** Price excluding GST */
  priceExGst: number;
  /** GST component */
  gstAmount: number;
  /** Price including GST */
  priceIncGst: number;
  /** Whether input was inclusive of GST */
  inputWasInclusive: boolean;
}

/**
 * Calculate GST breakdown from a GST-inclusive price
 * This is the standard case for Australian retail prices
 */
export function calculateFromIncGst(priceIncGst: number): GSTBreakdown {
  const priceExGst = priceIncGst / (1 + GST_RATE);
  const gstAmount = priceIncGst - priceExGst;
  
  return {
    inputPrice: priceIncGst,
    priceExGst: roundCurrency(priceExGst),
    gstAmount: roundCurrency(gstAmount),
    priceIncGst: roundCurrency(priceIncGst),
    inputWasInclusive: true,
  };
}

/**
 * Calculate GST breakdown from a GST-exclusive price
 */
export function calculateFromExGst(priceExGst: number): GSTBreakdown {
  const gstAmount = priceExGst * GST_RATE;
  const priceIncGst = priceExGst + gstAmount;
  
  return {
    inputPrice: priceExGst,
    priceExGst: roundCurrency(priceExGst),
    gstAmount: roundCurrency(gstAmount),
    priceIncGst: roundCurrency(priceIncGst),
    inputWasInclusive: false,
  };
}

/**
 * Add GST to a price
 */
export function addGst(priceExGst: number): number {
  return roundCurrency(priceExGst * (1 + GST_RATE));
}

/**
 * Remove GST from a price
 */
export function removeGst(priceIncGst: number): number {
  return roundCurrency(priceIncGst / (1 + GST_RATE));
}

/**
 * Get just the GST amount from an inclusive price
 */
export function getGstAmount(priceIncGst: number): number {
  return roundCurrency(priceIncGst - removeGst(priceIncGst));
}

// ============================================
// Formatting Functions
// ============================================

export interface FormatOptions {
  /** Show "inc GST" or "ex GST" label */
  showLabel?: boolean;
  /** Currency symbol (default: $) */
  symbol?: string;
  /** Decimal places (default: 2, use 0 for whole dollars) */
  decimals?: number;
  /** Show GST breakdown in tooltip format */
  breakdown?: boolean;
}

/**
 * Format price in Australian Dollars with GST indication
 */
export function formatAUD(
  price: number,
  isIncGst: boolean = true,
  options: FormatOptions = {}
): string {
  const {
    showLabel = true,
    symbol = '$',
    decimals = 2,
  } = options;
  
  const formatted = `${symbol}${price.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
  
  if (showLabel) {
    return `${formatted} ${isIncGst ? 'inc GST' : 'ex GST'}`;
  }
  
  return formatted;
}

/**
 * Format price with full GST breakdown
 * Returns multi-line string suitable for display
 */
export function formatWithBreakdown(priceIncGst: number): string {
  const breakdown = calculateFromIncGst(priceIncGst);
  
  return [
    `Price: ${formatAUD(breakdown.priceIncGst, true, { showLabel: false })} inc GST`,
    `GST: ${formatAUD(breakdown.gstAmount, true, { showLabel: false })}`,
    `Ex GST: ${formatAUD(breakdown.priceExGst, false, { showLabel: false })}`,
  ].join('\n');
}

/**
 * Format as compact string "Price (inc. $XX GST)"
 */
export function formatCompact(priceIncGst: number): string {
  const gst = getGstAmount(priceIncGst);
  return `$${priceIncGst.toLocaleString('en-AU', { maximumFractionDigits: 0 })} (inc. $${gst.toLocaleString('en-AU', { maximumFractionDigits: 0 })} GST)`;
}

// ============================================
// Margin Calculations with GST
// ============================================

export interface MarginAnalysis {
  /** Cost price (assumed ex GST for business) */
  costPriceExGst: number;
  /** Sale price (assumed inc GST for retail) */
  salePriceIncGst: number;
  /** Sale price ex GST (for margin calculation) */
  salePriceExGst: number;
  /** Gross profit (ex GST) */
  grossProfit: number;
  /** Margin percentage */
  marginPercent: number;
  /** Is margin above 20% safety threshold */
  isAboveSafetyThreshold: boolean;
}

/**
 * Calculate margin analysis
 * Per PRD: "UI Warning if Sales Price < (Cost Price * 1.2)" (20% margin floor)
 */
export function analyzeMargin(
  costPriceExGst: number,
  salePriceIncGst: number
): MarginAnalysis {
  const salePriceExGst = removeGst(salePriceIncGst);
  const grossProfit = salePriceExGst - costPriceExGst;
  const marginPercent = costPriceExGst > 0 
    ? (grossProfit / costPriceExGst) * 100 
    : 0;
  
  // 20% margin floor check (salesPrice >= costPrice * 1.2)
  const isAboveSafetyThreshold = salePriceIncGst >= costPriceExGst * 1.2;
  
  return {
    costPriceExGst: roundCurrency(costPriceExGst),
    salePriceIncGst: roundCurrency(salePriceIncGst),
    salePriceExGst: roundCurrency(salePriceExGst),
    grossProfit: roundCurrency(grossProfit),
    marginPercent: Math.round(marginPercent * 10) / 10, // 1 decimal
    isAboveSafetyThreshold,
  };
}

// ============================================
// Invoice/Receipt Helpers
// ============================================

export interface TaxInvoiceData {
  subtotal: number;
  gst: number;
  total: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPriceExGst: number;
    gst: number;
    totalIncGst: number;
  }>;
}

/**
 * Generate tax invoice data from line items
 */
export function generateTaxInvoice(
  items: Array<{ description: string; quantity: number; priceIncGst: number }>
): TaxInvoiceData {
  const processedItems = items.map(item => {
    const totalIncGst = item.quantity * item.priceIncGst;
    const breakdown = calculateFromIncGst(totalIncGst);
    
    return {
      description: item.description,
      quantity: item.quantity,
      unitPriceExGst: roundCurrency(removeGst(item.priceIncGst)),
      gst: breakdown.gstAmount,
      totalIncGst: breakdown.priceIncGst,
    };
  });
  
  const subtotal = processedItems.reduce((sum, item) => sum + (item.unitPriceExGst * item.quantity), 0);
  const gst = processedItems.reduce((sum, item) => sum + item.gst, 0);
  const total = processedItems.reduce((sum, item) => sum + item.totalIncGst, 0);
  
  return {
    subtotal: roundCurrency(subtotal),
    gst: roundCurrency(gst),
    total: roundCurrency(total),
    items: processedItems,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Round to 2 decimal places for currency
 */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

// Re-export shared pricing functions for convenience
export { 
  roundToWholeDollars, 
  calculateSalesPrice 
} from '@/lib/utils/pricing';

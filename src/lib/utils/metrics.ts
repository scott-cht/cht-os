/**
 * Australian Metric Normalization Utilities
 * 
 * Per PRD: "All measurements (mm, cm, kg, L) normalized to Australian Metric standards"
 * 
 * Converts imperial/non-standard measurements to metric equivalents.
 */

// ============================================
// Length Conversions (to millimeters base)
// ============================================

const LENGTH_TO_MM: Record<string, number> = {
  // Metric
  mm: 1,
  millimeter: 1,
  millimeters: 1,
  millimetre: 1,
  millimetres: 1,
  cm: 10,
  centimeter: 10,
  centimeters: 10,
  centimetre: 10,
  centimetres: 10,
  m: 1000,
  meter: 1000,
  meters: 1000,
  metre: 1000,
  metres: 1000,
  // Imperial
  in: 25.4,
  inch: 25.4,
  inches: 25.4,
  '"': 25.4,
  ft: 304.8,
  foot: 304.8,
  feet: 304.8,
  "'": 304.8,
  yd: 914.4,
  yard: 914.4,
  yards: 914.4,
};

// ============================================
// Weight Conversions (to grams base)
// ============================================

const WEIGHT_TO_GRAMS: Record<string, number> = {
  // Metric
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  // Imperial
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

// ============================================
// Volume Conversions (to milliliters base)
// ============================================

const VOLUME_TO_ML: Record<string, number> = {
  // Metric
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  L: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  // Imperial
  'fl oz': 29.5735,
  'fluid ounce': 29.5735,
  'fluid ounces': 29.5735,
  cup: 236.588,
  cups: 236.588,
  pt: 473.176,
  pint: 473.176,
  pints: 473.176,
  qt: 946.353,
  quart: 946.353,
  quarts: 946.353,
  gal: 3785.41,
  gallon: 3785.41,
  gallons: 3785.41,
  // Cubic
  'cu ft': 28316.8,
  'cubic foot': 28316.8,
  'cubic feet': 28316.8,
};

// ============================================
// Parsing Functions
// ============================================

interface ParsedMeasurement {
  value: number;
  unit: string;
  originalText: string;
}

/**
 * Parse a measurement string like "45.5 cm" or "18 inches"
 */
export function parseMeasurement(text: string): ParsedMeasurement | null {
  // Match number (with optional decimal) followed by optional unit
  const match = text.trim().match(/^([\d,.]+)\s*([a-zA-Z'"]+.*)?$/);
  
  if (!match) return null;
  
  const value = parseFloat(match[1].replace(',', '.'));
  const unit = (match[2] || '').toLowerCase().trim();
  
  if (isNaN(value)) return null;
  
  return {
    value,
    unit,
    originalText: text,
  };
}

// ============================================
// Conversion Functions
// ============================================

export interface NormalizedLength {
  mm: number;
  cm: number;
  m: number;
  display: string; // Best unit for display
}

/**
 * Convert any length measurement to metric
 */
export function normalizeLength(text: string): NormalizedLength | null {
  const parsed = parseMeasurement(text);
  if (!parsed) return null;
  
  const conversionFactor = LENGTH_TO_MM[parsed.unit];
  if (!conversionFactor) return null;
  
  const mm = parsed.value * conversionFactor;
  const cm = mm / 10;
  const m = mm / 1000;
  
  // Choose best display unit
  let display: string;
  if (m >= 1) {
    display = `${roundTo(m, 2)}m`;
  } else if (cm >= 1) {
    display = `${roundTo(cm, 1)}cm`;
  } else {
    display = `${roundTo(mm, 0)}mm`;
  }
  
  return { mm, cm, m, display };
}

export interface NormalizedWeight {
  g: number;
  kg: number;
  display: string;
}

/**
 * Convert any weight measurement to metric
 */
export function normalizeWeight(text: string): NormalizedWeight | null {
  const parsed = parseMeasurement(text);
  if (!parsed) return null;
  
  const conversionFactor = WEIGHT_TO_GRAMS[parsed.unit];
  if (!conversionFactor) return null;
  
  const g = parsed.value * conversionFactor;
  const kg = g / 1000;
  
  // Choose best display unit
  let display: string;
  if (kg >= 1) {
    display = `${roundTo(kg, 2)}kg`;
  } else {
    display = `${roundTo(g, 0)}g`;
  }
  
  return { g, kg, display };
}

export interface NormalizedVolume {
  ml: number;
  l: number;
  display: string;
}

/**
 * Convert any volume measurement to metric
 */
export function normalizeVolume(text: string): NormalizedVolume | null {
  const parsed = parseMeasurement(text);
  if (!parsed) return null;
  
  const conversionFactor = VOLUME_TO_ML[parsed.unit];
  if (!conversionFactor) return null;
  
  const ml = parsed.value * conversionFactor;
  const l = ml / 1000;
  
  // Choose best display unit
  let display: string;
  if (l >= 1) {
    display = `${roundTo(l, 1)}L`;
  } else {
    display = `${roundTo(ml, 0)}mL`;
  }
  
  return { ml, l, display };
}

// ============================================
// Dimension Parsing (e.g., "100 x 50 x 30 cm")
// ============================================

export interface NormalizedDimensions {
  width: NormalizedLength;
  height: NormalizedLength;
  depth: NormalizedLength;
  display: string;
}

/**
 * Parse dimension string like "100 x 50 x 30 cm" or "40"x24"x18""
 */
export function normalizeDimensions(text: string): NormalizedDimensions | null {
  // Split by x, ×, or by
  const parts = text.split(/\s*[x×]\s*|\s+by\s+/i);
  
  if (parts.length < 3) return null;
  
  // Try to extract unit from last part
  let unit = '';
  const lastPart = parts[parts.length - 1];
  const unitMatch = lastPart.match(/[a-zA-Z'"]+$/);
  if (unitMatch) {
    unit = unitMatch[0];
  }
  
  // Parse each dimension
  const dimensions = parts.map((part, i) => {
    // Add unit if not present
    if (!part.match(/[a-zA-Z'"]+$/) && unit) {
      part = part.trim() + ' ' + unit;
    }
    return normalizeLength(part);
  });
  
  if (dimensions.some(d => d === null)) return null;
  
  const [width, height, depth] = dimensions as NormalizedLength[];
  
  return {
    width,
    height,
    depth,
    display: `${width.display} × ${height.display} × ${depth.display}`,
  };
}

// ============================================
// Auto-Detect and Normalize
// ============================================

export type MeasurementType = 'length' | 'weight' | 'volume' | 'dimensions' | 'unknown';

export interface NormalizedMeasurement {
  type: MeasurementType;
  original: string;
  normalized: NormalizedLength | NormalizedWeight | NormalizedVolume | NormalizedDimensions | null;
  display: string;
}

/**
 * Auto-detect measurement type and normalize
 */
export function normalizeMeasurement(text: string): NormalizedMeasurement {
  // Try dimensions first (most specific)
  if (text.includes('x') || text.includes('×') || text.toLowerCase().includes(' by ')) {
    const dims = normalizeDimensions(text);
    if (dims) {
      return {
        type: 'dimensions',
        original: text,
        normalized: dims,
        display: dims.display,
      };
    }
  }
  
  // Try length
  const length = normalizeLength(text);
  if (length) {
    return {
      type: 'length',
      original: text,
      normalized: length,
      display: length.display,
    };
  }
  
  // Try weight
  const weight = normalizeWeight(text);
  if (weight) {
    return {
      type: 'weight',
      original: text,
      normalized: weight,
      display: weight.display,
    };
  }
  
  // Try volume
  const volume = normalizeVolume(text);
  if (volume) {
    return {
      type: 'volume',
      original: text,
      normalized: volume,
      display: volume.display,
    };
  }
  
  // Unknown
  return {
    type: 'unknown',
    original: text,
    normalized: null,
    display: text,
  };
}

/**
 * Normalize all measurements in a specifications object
 */
export function normalizeSpecifications(
  specs: Record<string, string>
): Record<string, string> {
  const normalized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(specs)) {
    // Try to normalize if it looks like a measurement
    if (typeof value === 'string' && value.match(/[\d,.]+\s*[a-zA-Z'"]+/)) {
      const result = normalizeMeasurement(value);
      normalized[key] = result.display;
    } else {
      normalized[key] = value;
    }
  }
  
  return normalized;
}

// ============================================
// Helper Functions
// ============================================

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

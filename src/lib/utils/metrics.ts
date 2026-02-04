/**
 * Metric normalization utilities
 * Ensures all physical specifications use Australian Metric standards
 */

type Unit = 'mm' | 'cm' | 'm' | 'inch' | 'ft' | 'g' | 'kg' | 'lb' | 'oz' | 'ml' | 'L' | 'gal';

interface ParsedMeasurement {
  value: number;
  unit: Unit;
  normalized: {
    value: number;
    unit: string;
  };
}

/**
 * Parse and normalize a measurement string to metric units
 */
export function normalizeMeasurement(input: string): ParsedMeasurement | null {
  const regex = /(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|inches|in|ft|feet|g|kg|lb|lbs|oz|ml|mL|L|litre|liter|gal|gallon)/i;
  const match = input.match(regex);
  
  if (!match) return null;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  // Normalize to metric
  let normalizedValue: number;
  let normalizedUnit: string;
  
  switch (unit) {
    // Length conversions
    case 'inch':
    case 'inches':
    case 'in':
      normalizedValue = value * 25.4;
      normalizedUnit = 'mm';
      break;
    case 'ft':
    case 'feet':
      normalizedValue = value * 304.8;
      normalizedUnit = 'mm';
      break;
    case 'm':
      normalizedValue = value * 1000;
      normalizedUnit = 'mm';
      break;
    case 'cm':
      normalizedValue = value * 10;
      normalizedUnit = 'mm';
      break;
    case 'mm':
      normalizedValue = value;
      normalizedUnit = 'mm';
      break;
      
    // Weight conversions
    case 'lb':
    case 'lbs':
      normalizedValue = value * 0.453592;
      normalizedUnit = 'kg';
      break;
    case 'oz':
      normalizedValue = value * 28.3495;
      normalizedUnit = 'g';
      break;
    case 'g':
      normalizedValue = value;
      normalizedUnit = 'g';
      break;
    case 'kg':
      normalizedValue = value;
      normalizedUnit = 'kg';
      break;
      
    // Volume conversions
    case 'gal':
    case 'gallon':
      normalizedValue = value * 3.78541;
      normalizedUnit = 'L';
      break;
    case 'ml':
      normalizedValue = value / 1000;
      normalizedUnit = 'L';
      break;
    case 'l':
    case 'litre':
    case 'liter':
      normalizedValue = value;
      normalizedUnit = 'L';
      break;
      
    default:
      normalizedValue = value;
      normalizedUnit = unit;
  }
  
  return {
    value,
    unit: unit as Unit,
    normalized: {
      value: Math.round(normalizedValue * 100) / 100, // Round to 2 decimal places
      unit: normalizedUnit,
    },
  };
}

/**
 * Format dimensions string (W x D x H)
 */
export function formatDimensions(
  width: number,
  depth: number,
  height: number,
  unit: string = 'mm'
): string {
  return `${width} x ${depth} x ${height} ${unit} (W x D x H)`;
}

/**
 * Normalize all measurements in a specifications object
 */
export function normalizeSpecifications(
  specs: Record<string, string>
): Record<string, string> {
  const normalized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(specs)) {
    const measurement = normalizeMeasurement(value);
    if (measurement) {
      normalized[key] = `${measurement.normalized.value} ${measurement.normalized.unit}`;
    } else {
      normalized[key] = value;
    }
  }
  
  return normalized;
}

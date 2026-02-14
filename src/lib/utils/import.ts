/**
 * CSV Import Utilities
 * 
 * Utilities for parsing and validating CSV imports for inventory.
 */

import type { InventoryItem, ListingType, ConditionGrade, SyncStatus, ListingStatus } from '@/types';
import { parsePrice } from '@/lib/utils/pricing';

export interface CSVImportRow {
  brand?: string;
  model?: string;
  sku?: string;
  serial_number?: string;
  listing_type?: string;
  condition_grade?: string;
  cost_price?: string;
  rrp_aud?: string;
  sale_price?: string;
  description_html?: string;
  [key: string]: string | undefined;
}

export interface ParsedImportRow {
  data: Partial<InventoryItem>;
  errors: string[];
  warnings: string[];
  rowNumber: number;
}

export interface ImportValidationResult {
  valid: ParsedImportRow[];
  invalid: ParsedImportRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  warnings: string[];
}

/**
 * Parse CSV string into array of rows
 */
export function parseCSV(csvText: string): CSVImportRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }
  
  // Parse header row
  const headers = parseCSVLine(lines[0]).map(h => normalizeHeader(h));
  
  // Parse data rows
  const rows: CSVImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: CSVImportRow = {};
    
    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        row[header] = values[index].trim();
      }
    });
    
    // Skip completely empty rows
    if (Object.values(row).some(v => v && v.trim())) {
      rows.push(row);
    }
  }
  
  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Normalize header names to match expected fields
 */
function normalizeHeader(header: string): string {
  const normalized = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  
  // Map common variations to standard field names
  const headerMap: Record<string, string> = {
    'brand_name': 'brand',
    'product_brand': 'brand',
    'model_name': 'model',
    'product_model': 'model',
    'product_name': 'model',
    'serial': 'serial_number',
    's_n': 'serial_number',
    'sn': 'serial_number',
    'type': 'listing_type',
    'condition': 'condition_grade',
    'cost': 'cost_price',
    'rrp': 'rrp_aud',
    'price': 'sale_price',
    'sale': 'sale_price',
    'selling_price': 'sale_price',
    'description': 'description_html',
  };
  
  return headerMap[normalized] || normalized;
}

/**
 * Validate and transform a single import row
 */
function validateRow(row: CSVImportRow, rowNumber: number): ParsedImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: Partial<InventoryItem> = {};
  
  // Required fields
  if (!row.brand?.trim()) {
    errors.push('Brand is required');
  } else {
    data.brand = row.brand.trim();
  }
  
  if (!row.model?.trim()) {
    errors.push('Model is required');
  } else {
    data.model = row.model.trim();
  }
  
  // Optional fields with validation
  if (row.sku) {
    data.sku = row.sku.trim();
  }
  
  if (row.serial_number) {
    data.serial_number = row.serial_number.trim();
  }
  
  // Listing type
  if (row.listing_type) {
    const type = row.listing_type.toLowerCase().trim();
    const validTypes: ListingType[] = ['new', 'trade_in', 'ex_demo'];
    const typeMap: Record<string, ListingType> = {
      'new': 'new',
      'trade-in': 'trade_in',
      'trade_in': 'trade_in',
      'tradein': 'trade_in',
      'ex-demo': 'ex_demo',
      'ex_demo': 'ex_demo',
      'exdemo': 'ex_demo',
      'demo': 'ex_demo',
    };
    
    const mappedType = typeMap[type];
    if (mappedType) {
      data.listing_type = mappedType;
    } else if (validTypes.includes(type as ListingType)) {
      data.listing_type = type as ListingType;
    } else {
      errors.push(`Invalid listing type: ${row.listing_type}`);
    }
  } else {
    data.listing_type = 'new'; // Default
  }
  
  // Condition grade
  if (row.condition_grade) {
    const condition = row.condition_grade.toLowerCase().trim();
    const validGrades: ConditionGrade[] = ['mint', 'excellent', 'good', 'fair', 'poor'];
    
    if (validGrades.includes(condition as ConditionGrade)) {
      data.condition_grade = condition as ConditionGrade;
    } else {
      warnings.push(`Invalid condition grade: ${row.condition_grade}, will be ignored`);
    }
  }
  
  // Prices
  if (row.cost_price) {
    const cost = parsePrice(row.cost_price);
    if (cost !== null) {
      data.cost_price = cost;
    } else {
      warnings.push(`Invalid cost price: ${row.cost_price}`);
    }
  }
  
  if (row.rrp_aud) {
    const rrp = parsePrice(row.rrp_aud);
    if (rrp !== null) {
      data.rrp_aud = rrp;
    } else {
      warnings.push(`Invalid RRP: ${row.rrp_aud}`);
    }
  }
  
  if (row.sale_price) {
    const sale = parsePrice(row.sale_price);
    if (sale !== null) {
      data.sale_price = sale;
    } else {
      errors.push(`Invalid sale price: ${row.sale_price}`);
    }
  } else if (!errors.length) {
    // Sale price is required for valid rows
    warnings.push('No sale price provided, will need to be set manually');
    data.sale_price = 0;
  }
  
  // Description
  if (row.description_html) {
    data.description_html = row.description_html;
  }
  
  // Set defaults for new imports
  data.sync_status = 'pending' as SyncStatus;
  data.listing_status = 'draft' as ListingStatus;
  
  return { data, errors, warnings, rowNumber };
}

// parsePrice is imported from @/lib/utils/pricing

/**
 * Validate all rows from CSV import
 */
export function validateImport(rows: CSVImportRow[]): ImportValidationResult {
  const valid: ParsedImportRow[] = [];
  const invalid: ParsedImportRow[] = [];
  const warnings: string[] = [];
  
  rows.forEach((row, index) => {
    const result = validateRow(row, index + 2); // +2 because row 1 is header, index is 0-based
    
    if (result.errors.length === 0) {
      valid.push(result);
    } else {
      invalid.push(result);
    }
    
    result.warnings.forEach(w => warnings.push(`Row ${result.rowNumber}: ${w}`));
  });
  
  return {
    valid,
    invalid,
    totalRows: rows.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    warnings,
  };
}

/**
 * Get sample CSV template
 */
export function getCSVTemplate(): string {
  const headers = [
    'brand',
    'model',
    'sku',
    'serial_number',
    'listing_type',
    'condition_grade',
    'cost_price',
    'rrp_aud',
    'sale_price',
    'description_html',
  ];
  
  const sampleRow = [
    'Marantz',
    'AV30',
    'MAR-AV30-BLK',
    '',
    'new',
    '',
    '3500',
    '4999',
    '4499',
    'Premium 11.4 channel AV receiver',
  ];
  
  return [
    headers.join(','),
    sampleRow.join(','),
  ].join('\n');
}

/**
 * Download sample CSV template
 */
export function downloadCSVTemplate(): void {
  const template = getCSVTemplate();
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + template], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', 'inventory-import-template.csv');
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

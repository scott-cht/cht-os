/**
 * Label Templates
 * Pre-defined label sizes and configurations for common label sheets
 */

export interface LabelTemplate {
  id: string;
  name: string;
  description: string;
  pageSize: 'A4' | 'Letter';
  labelsPerSheet: number;
  labelWidth: number;  // mm
  labelHeight: number; // mm
  columns: number;
  rows: number;
  marginTop: number;   // mm
  marginLeft: number;  // mm
  gapX: number;        // mm
  gapY: number;        // mm
}

export interface LabelContent {
  showBrand: boolean;
  showModel: boolean;
  showSku: boolean;
  showPrice: boolean;
  showRrp: boolean;
  showDiscount: boolean;
  showQrCode: boolean;
  qrCodeSize: 'small' | 'medium' | 'large';
  customText?: string;
}

// Pre-defined label templates
export const LABEL_TEMPLATES: Record<string, LabelTemplate> = {
  // Standard shipping label - good for price tags
  standard: {
    id: 'standard',
    name: 'Standard Label',
    description: '100mm × 60mm - Single large label',
    pageSize: 'A4',
    labelsPerSheet: 1,
    labelWidth: 100,
    labelHeight: 60,
    columns: 1,
    rows: 1,
    marginTop: 10,
    marginLeft: 10,
    gapX: 0,
    gapY: 0,
  },
  // Avery 5160 equivalent - 30 labels per sheet
  avery30: {
    id: 'avery30',
    name: 'Address Labels (30/sheet)',
    description: '66mm × 25mm - Avery 5160 compatible',
    pageSize: 'A4',
    labelsPerSheet: 30,
    labelWidth: 66,
    labelHeight: 25,
    columns: 3,
    rows: 10,
    marginTop: 15,
    marginLeft: 7,
    gapX: 3,
    gapY: 0,
  },
  // Product labels - 10 per sheet
  product10: {
    id: 'product10',
    name: 'Product Labels (10/sheet)',
    description: '99mm × 57mm - Large product labels',
    pageSize: 'A4',
    labelsPerSheet: 10,
    labelWidth: 99,
    labelHeight: 57,
    columns: 2,
    rows: 5,
    marginTop: 13,
    marginLeft: 5,
    gapX: 3,
    gapY: 0,
  },
  // Square labels - good for shelf tags
  square6: {
    id: 'square6',
    name: 'Square Labels (6/sheet)',
    description: '95mm × 95mm - Shelf/display tags',
    pageSize: 'A4',
    labelsPerSheet: 6,
    labelWidth: 95,
    labelHeight: 95,
    columns: 2,
    rows: 3,
    marginTop: 8,
    marginLeft: 10,
    gapX: 5,
    gapY: 5,
  },
  // Price gun style - small price tags
  priceTag: {
    id: 'priceTag',
    name: 'Price Tags (40/sheet)',
    description: '50mm × 30mm - Small price tags',
    pageSize: 'A4',
    labelsPerSheet: 40,
    labelWidth: 50,
    labelHeight: 30,
    columns: 4,
    rows: 10,
    marginTop: 5,
    marginLeft: 5,
    gapX: 2,
    gapY: 0,
  },
};

export const DEFAULT_LABEL_CONTENT: LabelContent = {
  showBrand: true,
  showModel: true,
  showSku: true,
  showPrice: true,
  showRrp: true,
  showDiscount: true,
  showQrCode: true,
  qrCodeSize: 'medium',
};

// QR code size in mm based on setting
export const QR_CODE_SIZES: Record<LabelContent['qrCodeSize'], number> = {
  small: 15,
  medium: 25,
  large: 40,
};

// Get available templates as array
export function getTemplateList(): LabelTemplate[] {
  return Object.values(LABEL_TEMPLATES);
}

// Get template by ID
export function getTemplate(id: string): LabelTemplate | undefined {
  return LABEL_TEMPLATES[id];
}

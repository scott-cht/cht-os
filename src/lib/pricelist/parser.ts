/**
 * PDF Pricelist Parser Utilities
 * 
 * Utilities for extracting product data from supplier PDF pricelists
 * using AI vision capabilities.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/config';

// Types for pricelist parsing
export interface PricelistItem {
  sku: string;
  product_name: string;
  cost_price: number;
  rrp_aud?: number;
  brand?: string;
  model?: string;
  category?: string;
}

export interface ParsedPricelistPage {
  pageNumber: number;
  items: PricelistItem[];
  warnings: string[];
}

export interface PricelistParseResult {
  success: boolean;
  items: PricelistItem[];
  pageCount: number;
  warnings: string[];
  error?: string;
}

// Lazy-load Anthropic client
let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

const PRICELIST_EXTRACTION_PROMPT = `You are an expert at extracting product data from supplier pricelists.

Analyze this pricelist page image and extract all product rows. For each product, identify:

1. **sku** - Product code/SKU (e.g., "MAR-AV30-BK", "DEN-X6700H")
2. **product_name** - Full product name including brand and model
3. **cost_price** - Dealer/wholesale price in AUD (the lower price, what the dealer pays)
4. **rrp_aud** - Retail/RRP price in AUD if shown (the higher price customers pay)
5. **brand** - Manufacturer brand if identifiable
6. **model** - Model number/name if identifiable
7. **category** - Product category if shown (e.g., "Amplifiers", "Speakers")

Important rules:
- Skip header rows, totals, and non-product rows
- Parse prices as numbers (remove $ symbols, commas)
- If a row has no SKU, still include it if it has product name and price
- Dealer/cost price is typically the lower price, RRP is the higher price
- If only one price column exists, assume it's cost_price
- If you can't determine brand/model from product_name, set them to null

Respond with ONLY valid JSON in this exact format:
{
  "items": [
    {
      "sku": "string",
      "product_name": "string",
      "cost_price": number,
      "rrp_aud": number or null,
      "brand": "string or null",
      "model": "string or null",
      "category": "string or null"
    }
  ],
  "warnings": ["string array of any issues encountered"]
}`;

/**
 * Parse a single page image using Claude Vision
 */
export async function parsePageWithVision(
  imageBase64: string,
  pageNumber: number
): Promise<ParsedPricelistPage> {
  const anthropic = getAnthropic();

  // Determine media type
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
  let base64Data = imageBase64;

  if (imageBase64.startsWith('data:')) {
    const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      mediaType = matches[1] as typeof mediaType;
      base64Data = matches[2];
    }
  }

  try {
    const response = await anthropic.messages.create({
      model: config.ai.visionModel,
      max_tokens: config.ai.maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: PRICELIST_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in AI response');
    }

    // Parse JSON from response
    let jsonStr = textContent.text;
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Validate and clean items
    const items: PricelistItem[] = (parsed.items || [])
      .filter((item: Partial<PricelistItem>) => {
        // Must have at least product_name and cost_price
        return item.product_name && typeof item.cost_price === 'number' && item.cost_price > 0;
      })
      .map((item: Partial<PricelistItem>) => ({
        sku: item.sku || '',
        product_name: item.product_name || '',
        cost_price: Math.round((item.cost_price || 0) * 100) / 100,
        rrp_aud: item.rrp_aud ? Math.round(item.rrp_aud * 100) / 100 : undefined,
        brand: item.brand || undefined,
        model: item.model || undefined,
        category: item.category || undefined,
      }));

    return {
      pageNumber,
      items,
      warnings: parsed.warnings || [],
    };
  } catch (error) {
    console.error(`Error parsing page ${pageNumber}:`, error);
    return {
      pageNumber,
      items: [],
      warnings: [`Failed to parse page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Try to extract brand and model from product name
 */
export function extractBrandModel(productName: string): { brand?: string; model?: string } {
  // Common audio/video brands
  const knownBrands = [
    'Marantz', 'Denon', 'Sony', 'Samsung', 'LG', 'Yamaha', 'Onkyo', 'Pioneer',
    'Bose', 'Sonos', 'KEF', 'Bowers & Wilkins', 'B&W', 'Bang & Olufsen', 'B&O',
    'JBL', 'Harman Kardon', 'Klipsch', 'Focal', 'Dynaudio', 'Monitor Audio',
    'SVS', 'REL', 'Anthem', 'NAD', 'Rotel', 'Cambridge Audio', 'Arcam',
    'Audiolab', 'Musical Fidelity', 'Naim', 'Linn', 'Rega', 'Pro-Ject',
    'McIntosh', 'Mark Levinson', 'Krell', 'Classe', 'Meridian', 'Primare',
    'Hegel', 'Parasound', 'Emotiva', 'Topping', 'SMSL', 'FiiO', 'iFi',
    'Schiit', 'Chord', 'Astell&Kern', 'WiiM', 'Bluesound', 'Technics',
    'Panasonic', 'Epson', 'BenQ', 'Optoma', 'JVC', 'ViewSonic', 'Hisense',
    'TCL', 'Vizio', 'Philips', 'Sharp', 'Toshiba', 'Apple', 'Google', 'Amazon',
  ];

  const normalizedName = productName.trim();
  
  for (const brand of knownBrands) {
    const brandRegex = new RegExp(`^${brand}\\s+`, 'i');
    if (brandRegex.test(normalizedName)) {
      const model = normalizedName.replace(brandRegex, '').trim();
      return { brand, model: model || undefined };
    }
  }

  // Try to extract brand from first word if it looks like a brand (capitalized)
  const words = normalizedName.split(/\s+/);
  if (words.length >= 2 && /^[A-Z]/.test(words[0])) {
    return {
      brand: words[0],
      model: words.slice(1).join(' '),
    };
  }

  return {};
}

/**
 * Validate a pricelist item
 */
export function validatePricelistItem(item: PricelistItem): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!item.product_name?.trim()) {
    errors.push('Product name is required');
  }

  if (!item.cost_price || item.cost_price <= 0) {
    errors.push('Cost price must be greater than 0');
  }

  if (item.rrp_aud !== undefined && item.rrp_aud <= 0) {
    errors.push('RRP must be greater than 0 if provided');
  }

  if (item.rrp_aud && item.cost_price && item.rrp_aud < item.cost_price) {
    errors.push('RRP should be greater than or equal to cost price');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Process a pricelist item to extract brand/model if not provided
 */
export function enrichPricelistItem(item: PricelistItem): PricelistItem {
  if (item.brand && item.model) {
    return item;
  }

  const extracted = extractBrandModel(item.product_name);
  
  return {
    ...item,
    brand: item.brand || extracted.brand,
    model: item.model || extracted.model,
  };
}

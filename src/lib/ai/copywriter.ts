import Anthropic from '@anthropic-ai/sdk';
import type { AIGeneratedContent, RawScrapedData, CategorizedSpecifications } from '@/types';
import { normalizeSpecifications } from '@/lib/utils/metrics';
import { config } from '@/config';

// Lazy-load Anthropic client to avoid build-time errors
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

/**
 * System prompt for Australian e-commerce copywriting
 */
const SYSTEM_PROMPT = `You are an expert Australian e-commerce copywriter specializing in creating SEO-optimized product content for Shopify stores.

Your writing must:
- Be 100% unique and not plagiarize source material
- Use Australian English spelling (colour, metre, litre)
- Include GST-inclusive pricing references when relevant
- Focus on customer benefits, not just features
- Be professional yet approachable in tone

CRITICAL CONSTRAINTS:
- Product titles MUST be under 60 characters
- Meta descriptions MUST be exactly 150-155 characters with a call-to-action
- All measurements must use metric units (mm, cm, kg, L)
- Never use superlatives like "best" or "cheapest" without evidence

You must respond with valid JSON only, no markdown or code blocks.`;

interface CopywriterInput {
  brand: string;
  modelNumber: string;
  rawData: RawScrapedData;
  rrpAud?: number;
}

/**
 * Generate SEO-optimized product content using Claude
 */
export async function generateProductContent(input: CopywriterInput): Promise<AIGeneratedContent> {
  const { brand, modelNumber, rawData, rrpAud } = input;
  
  // Extract and normalize specifications
  const specs = rawData.htmlParsed?.specifications || {};
  const normalizedSpecs = normalizeSpecifications(specs);
  
  // Build context from scraped data
  const sourceTitle = rawData.jsonLd?.name || rawData.htmlParsed?.title || '';
  const sourceDescription = rawData.jsonLd?.description || rawData.htmlParsed?.description || '';
  const specsList = Object.entries(normalizedSpecs)
    .slice(0, 10)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const imageCount = rawData.htmlParsed?.images?.length || 0;

  // Build specifications table HTML if we have specs
  const specsTableHtml = Object.keys(normalizedSpecs).length > 0
    ? `<table class="specifications-table">
<thead><tr><th colspan="2">Technical Specifications</th></tr></thead>
<tbody>
${Object.entries(normalizedSpecs).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('\n')}
</tbody>
</table>`
    : '';

  const userPrompt = `Generate SEO-optimized product content for this Australian e-commerce listing:

PRODUCT INFO:
- Brand: ${brand}
- Model: ${modelNumber}
- RRP: ${rrpAud ? `$${rrpAud.toLocaleString()} AUD` : 'Not specified'}

SOURCE DATA (rewrite completely - do not copy):
Title: ${sourceTitle}
Description: ${sourceDescription}

SPECIFICATIONS (use metric units):
${specsList || 'No specifications available'}

IMAGES: ${imageCount} product images available

REQUIRED OUTPUT (respond with JSON only, no markdown):
{
  "title": "SEO title under 60 chars: [Brand] [Model] [Category] - [Key Feature]",
  "metaDescription": "Exactly 150-155 chars with CTA. End with 'Shop now' or 'Order today'",
  "descriptionHtml": "Create rich HTML content with this EXACT structure:
    1. Opening <div class='product-intro'> with 2-3 compelling sentences about benefits
    2. <h3>Key Features</h3> followed by <ul class='feature-list'> with 4-6 benefit-focused bullet points
    3. <h3>Why Choose ${brand}?</h3> with a short paragraph about brand quality
    4. Include the specifications table: ${specsTableHtml ? 'INCLUDE THIS EXACT TABLE IN YOUR OUTPUT: ' + specsTableHtml.replace(/"/g, '\\"').replace(/\n/g, '') : 'Skip specifications section if none available'}
    Make it comprehensive, at least 300 words total.",
  "altTexts": ["Alt text for image 1", "Alt text for image 2", "etc - generate ${imageCount} alt texts"]
}

CRITICAL REQUIREMENTS:
- Title MUST be under 60 characters
- Meta description MUST be 150-155 characters
- Description MUST be comprehensive (300+ words) with proper HTML structure
- Include the specifications table if provided above
- Content must be 100% unique - completely rewrite, don't copy
- Use Australian English (colour, metre, litre)
- Return valid JSON only, no markdown code blocks`;

  const response = await getAnthropic().messages.create({
    model: config.ai.model,
    max_tokens: 1500,
    messages: [
      { 
        role: 'user', 
        content: userPrompt 
      }
    ],
    system: SYSTEM_PROMPT,
  });

  // Extract text content from response
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in AI response');
  }

  const content = textContent.text;
  
  // Parse JSON from response (handle potential markdown wrapping)
  let jsonStr = content;
  if (content.includes('```json')) {
    jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (content.includes('```')) {
    jsonStr = content.replace(/```\n?/g, '');
  }
  
  const parsed = JSON.parse(jsonStr.trim()) as AIGeneratedContent;
  
  // Validate constraints
  if (parsed.title.length > 60) {
    // Truncate and add ellipsis if needed
    parsed.title = parsed.title.substring(0, 57) + '...';
  }
  
  if (parsed.metaDescription.length < 150 || parsed.metaDescription.length > 160) {
    // AI should handle this, but log if it doesn't
    console.warn(`Meta description length: ${parsed.metaDescription.length} (target: 150-155)`);
  }

  // Ensure altTexts is an array
  if (!Array.isArray(parsed.altTexts)) {
    parsed.altTexts = [];
  }

  return parsed;
}

/**
 * Generate alt texts for product images
 */
export async function generateImageAltTexts(
  brand: string,
  modelNumber: string,
  imageCount: number,
  productCategory?: string
): Promise<string[]> {
  if (imageCount === 0) return [];
  
  const response = await getAnthropic().messages.create({
    model: config.ai.model,
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Generate ${imageCount} unique, SEO-friendly alt texts for ${brand} ${modelNumber} ${productCategory || 'product'} images. Keep each under 125 characters. Be specific and include brand/model.

Return as JSON: {"altTexts": ["alt 1", "alt 2", ...]}`,
      },
    ],
    system: 'Generate SEO-friendly, descriptive alt texts for product images. Respond with JSON only.',
  });

  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') return [];

  try {
    let jsonStr = textContent.text;
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    const parsed = JSON.parse(jsonStr.trim());
    return Array.isArray(parsed.altTexts) ? parsed.altTexts : [];
  } catch {
    return [];
  }
}

/**
 * Categorize raw specifications into logical groups using AI
 */
export async function categorizeSpecifications(
  specs: Record<string, string>,
  brand: string,
  productType?: string
): Promise<CategorizedSpecifications> {
  if (Object.keys(specs).length === 0) {
    return { categories: [] };
  }

  // Normalize specs first (metric units)
  const normalizedSpecs = normalizeSpecifications(specs);
  
  const specsList = Object.entries(normalizedSpecs)
    .map(([key, value]) => `"${key}": "${value}"`)
    .join(',\n');

  const response = await getAnthropic().messages.create({
    model: config.ai.model,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Categorize these product specifications into logical groups for a ${productType || 'product'} by ${brand}.

RAW SPECIFICATIONS:
${specsList}

REQUIREMENTS:
1. Group related specs into categories like: Dimensions, Weight, Electrical, Performance, Materials, Connectivity, Compatibility, etc.
2. Use category names appropriate for this product type
3. Extract units from values where possible (e.g., "100mm" → value: "100", unit: "mm")
4. Clean up key names to be human-readable (e.g., "max_power_output" → "Maximum Power Output")
5. Keep original values but normalize to metric (Australian standard)
6. Assign appropriate icons to each category (use emoji)

Return JSON in this EXACT format:
{
  "categories": [
    {
      "name": "Dimensions",
      "icon": "📐",
      "items": [
        { "key": "Width", "value": "500", "unit": "mm" },
        { "key": "Height", "value": "300", "unit": "mm" }
      ]
    },
    {
      "name": "Electrical",
      "icon": "⚡",
      "items": [
        { "key": "Voltage", "value": "240", "unit": "V" }
      ]
    }
  ],
  "uncategorized": []
}

IMPORTANT:
- Every spec must be placed in a category or uncategorized
- Use clear, professional category names
- Return valid JSON only, no markdown`
      }
    ],
    system: 'You are a product data specialist. Organize specifications into logical categories. Always respond with valid JSON only.',
  });

  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    // Fallback: return uncategorized specs
    return {
      categories: [],
      uncategorized: Object.entries(normalizedSpecs).map(([key, value]) => ({
        key,
        value,
      })),
    };
  }

  try {
    let jsonStr = textContent.text;
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    const parsed = JSON.parse(jsonStr.trim()) as CategorizedSpecifications;
    
    // Validate structure
    if (!parsed.categories || !Array.isArray(parsed.categories)) {
      throw new Error('Invalid categories structure');
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to parse categorized specs:', error);
    // Fallback: return uncategorized specs
    return {
      categories: [],
      uncategorized: Object.entries(normalizedSpecs).map(([key, value]) => ({
        key,
        value,
      })),
    };
  }
}

/**
 * Generate HTML for categorized specifications (accordion style)
 */
export function generateSpecificationsHtml(specs: CategorizedSpecifications): string {
  if (!specs.categories.length && !specs.uncategorized?.length) {
    return '';
  }

  let html = '<div class="specifications-accordion">';

  for (const category of specs.categories) {
    html += `
      <details class="spec-category" open>
        <summary class="spec-category-header">
          <span class="spec-icon">${category.icon || '📋'}</span>
          <span class="spec-category-name">${category.name}</span>
          <span class="spec-count">${category.items.length} specs</span>
        </summary>
        <table class="spec-table">
          <tbody>
            ${category.items.map(item => `
              <tr>
                <th>${item.key}</th>
                <td>${item.value}${item.unit ? ` <span class="spec-unit">${item.unit}</span>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </details>
    `;
  }

  // Add uncategorized specs if any
  if (specs.uncategorized && specs.uncategorized.length > 0) {
    html += `
      <details class="spec-category" open>
        <summary class="spec-category-header">
          <span class="spec-icon">📋</span>
          <span class="spec-category-name">Other Specifications</span>
          <span class="spec-count">${specs.uncategorized.length} specs</span>
        </summary>
        <table class="spec-table">
          <tbody>
            ${specs.uncategorized.map(item => `
              <tr>
                <th>${item.key}</th>
                <td>${item.value}${item.unit ? ` <span class="spec-unit">${item.unit}</span>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </details>
    `;
  }

  html += '</div>';
  return html;
}

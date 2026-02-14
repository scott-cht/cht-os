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
- ALWAYS use Australian English spelling: colour (not color), metre (not meter), litre (not liter), optimised (not optimized), organised (not organized), centre (not center), analyse (not analyze), favour (not favor), behaviour (not behavior)
- Include GST-inclusive pricing references when relevant
- Focus on customer benefits, not just features
- Be professional yet approachable in tone

CRITICAL CONSTRAINTS:
- Product titles MUST be under 60 characters
- Meta descriptions MUST be exactly 150-155 characters with a call-to-action
- SPEAKER/SUBWOOFER DRIVER SIZES: Keep in inches (e.g., 13" driver, 12" woofer) - do NOT convert to mm
- PRODUCT DIMENSIONS: Convert to metric (mm, cm, kg, L) - e.g., cabinet dimensions, weight
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
  
  const hasSpecs = Object.keys(normalizedSpecs).length > 0;

  const userPrompt = `Generate SEO-optimized product content for this Australian e-commerce listing:

PRODUCT INFO:
- Brand: ${brand}
- Model: ${modelNumber}
- RRP: ${rrpAud ? `$${rrpAud.toLocaleString()} AUD` : 'Not specified'}

SOURCE DATA (rewrite completely - do not copy):
Title: ${sourceTitle}
Description: ${sourceDescription}

SPECIFICATIONS:
${specsList || 'No specifications available'}

IMAGES: ${imageCount} product images available

Generate a JSON response with these fields:

1. "title": SEO-optimized product title under 60 characters. Format: [Brand] [Model] [Category] - [Key Benefit]

2. "metaDescription": Exactly 150-155 characters with a call-to-action ending like "Shop now" or "Order today"

3. "descriptionHtml": Create compelling HTML product description with this structure:
   - Opening paragraph (2-3 sentences) about the product benefits wrapped in <p> tags
   - <h3>Key Features</h3> section with <ul> containing 4-6 benefit-focused <li> items
   - <h3>Why Choose ${brand}?</h3> with a paragraph about brand quality/reputation
   ${hasSpecs ? `- <h3>Technical Specifications</h3> followed by a properly formatted HTML table. IMPORTANT: Use this EXACT format:
     <table class="specifications-table">
       <tbody>
         <tr><th>Driver Size</th><td>13" High-Excursion SVS</td></tr>
         <tr><th>Power Output</th><td>800W RMS / 2,500W Peak</td></tr>
       </tbody>
     </table>
     Each specification MUST be in its own <tr> row with <th> for the label and <td> for the value. Do NOT concatenate specs together.` : ''}
   - Make content comprehensive (300+ words minimum)

4. "altTexts": Array of ${imageCount} descriptive alt texts for product images

CRITICAL RULES:
- AUSTRALIAN ENGLISH ONLY: Use colour, metre, litre, optimised, centre (NOT American spellings)
- SPEAKER DRIVERS: Keep sizes in inches (13", 12", 10" etc.) - do NOT convert to mm
- PRODUCT DIMENSIONS: Convert to metric (mm for size, kg for weight)
- Content must be 100% unique - completely rewrite source material
- Return ONLY valid JSON, no markdown code blocks or backticks`;

  const response = await getAnthropic().messages.create({
    model: config.ai.model,
    max_tokens: 2500,
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
  
  // Parse JSON from response (handle potential markdown wrapping and malformed JSON)
  let jsonStr = content;
  
  // Remove markdown code blocks
  if (content.includes('```json')) {
    jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (content.includes('```')) {
    jsonStr = content.replace(/```\n?/g, '');
  }
  
  // Try to extract JSON object if there's extra content
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }
  
  let parsed: AIGeneratedContent;
  try {
    parsed = JSON.parse(jsonStr.trim()) as AIGeneratedContent;
  } catch (parseError) {
    // Try to fix common JSON issues
    console.error('Initial JSON parse failed, attempting repair...');
    
    // Try a more careful approach: find each field's value
    try {
      // Extract title - simple string field
      const titleMatch = jsonStr.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const title = titleMatch ? titleMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ') : '';
      
      // Extract metaDescription - simple string field
      const metaMatch = jsonStr.match(/"metaDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const metaDescription = metaMatch ? metaMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ') : '';
      
      // Extract descriptionHtml - this is the tricky one with HTML content
      // Find the start of descriptionHtml value
      const descStartIdx = jsonStr.indexOf('"descriptionHtml"');
      let descriptionHtml = '';
      
      if (descStartIdx !== -1) {
        // Find the opening quote after the colon
        const colonIdx = jsonStr.indexOf(':', descStartIdx);
        const openQuoteIdx = jsonStr.indexOf('"', colonIdx);
        
        if (openQuoteIdx !== -1) {
          // Find the closing quote - need to handle escaped quotes
          let closeQuoteIdx = openQuoteIdx + 1;
          let escaped = false;
          
          while (closeQuoteIdx < jsonStr.length) {
            const char = jsonStr[closeQuoteIdx];
            if (escaped) {
              escaped = false;
            } else if (char === '\\') {
              escaped = true;
            } else if (char === '"') {
              break;
            }
            closeQuoteIdx++;
          }
          
          if (closeQuoteIdx < jsonStr.length) {
            descriptionHtml = jsonStr
              .substring(openQuoteIdx + 1, closeQuoteIdx)
              .replace(/\\"/g, '"')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '')
              .replace(/\\t/g, '  ');
          }
        }
      }
      
      if (!title || !metaDescription) {
        throw new Error('Could not extract required fields');
      }
      
      parsed = {
        title,
        metaDescription,
        descriptionHtml,
        altTexts: [],
      };
      
      console.log('Successfully extracted fields manually');
    } catch (extractError) {
      console.error('Field extraction failed:', extractError);
      throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
    }
  }
  
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

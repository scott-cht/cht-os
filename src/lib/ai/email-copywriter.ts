/**
 * AI Email Copywriter - Generate marketing email copy from inventory and style guides
 * Phase 2: Klaviyo Marketing Engine
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/config';
import type { GeneratedEmail, InventoryItemForEmail } from '@/types/klaviyo';

export interface SectionTag {
  type: string;
  description?: string;
}

export interface StyleGuideSample {
  subject?: string | null;
  html?: string;
  plainText?: string | null;
  /** Free-form instructions: where to put products, category links, CTA, etc. */
  layoutNotes?: string | null;
  /** Structured sections e.g. [{ type: 'products', description: 'Main grid' }, { type: 'category_links', description: 'Footer' }] */
  sectionTags?: SectionTag[];
}

export interface GenerateEmailFromInventoryInput {
  inventoryItems: InventoryItemForEmail[];
  styleGuideSamples: StyleGuideSample[];
  /** Pre-extracted <style> content from the first style guide (full HTML). Use this so we don't lose styles when truncating sample HTML. */
  injectedStyleBlock?: string | null;
  intent: string;
  audience?: string;
}

const EMAIL_SYSTEM_PROMPT = `You are an expert Australian e-commerce email copywriter for CHT (Custom Home Theatre). Your job is to produce a new marketing email that looks and reads like the example CHT emails provided.

CRITICAL - STYLING:
- Your htmlBody MUST preserve the exact visual styling of the example: same inline style="..." attributes, same class names, same table/cell structure, same fonts and colours.
- Copy the example's HTML structure and markup patterns. Only replace: headline/body text, product names/prices/images/links, and CTA copy. Do NOT strip styles or simplify to plain HTML.
- If the example uses tables for layout, use the same table structure. If it uses styled divs or sections, replicate that structure. Preserve all style= and class= attributes.

Rules:
- Use Australian English only: colour, metre, litre, optimised, centre, favour, behaviour
- All prices in AUD, GST-inclusive where relevant
- Match the voice and tone of the example (subject style, opening, CTAs, sign-off)
- Output valid JSON only: no markdown, no code blocks, no backticks`;

// Keep prompt under model context limit (~200k tokens). Placeholder URLs keep prompt small so we can show more structure.
const MAX_HTML_SAMPLE = 6000; // enough for model to see table structure, class names, inline styles
const MAX_STYLE_BLOCK = 16000; // used only for server-side prepend (full styles from guide)
const MAX_INVENTORY_IN_PROMPT = 12;

const IMAGE_URL_PLACEHOLDER_PREFIX = '___IMG_';
const PRODUCT_URL_PLACEHOLDER_PREFIX = '___LINK_';

/** Extract <style>...</style> from HTML for reuse in generated email */
function extractStyleBlock(html: string): string | null {
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match ? match[1].trim() : null;
}

export async function generateEmailFromInventory(
  input: GenerateEmailFromInventoryInput
): Promise<GeneratedEmail> {
  const { inventoryItems, styleGuideSamples, injectedStyleBlock, intent, audience } = input;

  // Use pre-extracted style block if provided (from full HTML in API); else extract from first sample (may be truncated)
  const primary = styleGuideSamples[0];
  const primaryHtml = primary?.html ?? '';
  const styleBlock =
    injectedStyleBlock != null && injectedStyleBlock !== ''
      ? injectedStyleBlock
      : primaryHtml
        ? extractStyleBlock(primaryHtml)
        : null;

  // Use only the first style guide in the prompt; hard-cap length so we never exceed token limit
  const sample = styleGuideSamples[0];
  const rawBodySrc = sample?.html ?? sample?.plainText ?? '';
  const rawBody = typeof rawBodySrc === 'string' ? rawBodySrc : '';
  const trimmedBody = rawBody.replace(/\s+/g, ' ').trim();
  const body = trimmedBody.length > MAX_HTML_SAMPLE
    ? trimmedBody.slice(0, MAX_HTML_SAMPLE) + '...[truncated]'
    : trimmedBody;
  const parts: string[] = [];
  if (sample?.subject) parts.push(`Subject: ${sample.subject}`);
  if (body) parts.push(`Body (HTML - preserve this structure and styling):\n${body}`);
  if (sample?.layoutNotes) parts.push(`Layout notes: ${sample.layoutNotes}`);
  if (sample?.sectionTags?.length) {
    parts.push(
      `Section tags: ${sample.sectionTags.map((t) => `${t.type}${t.description ? ` (${t.description})` : ''}`).join('; ')}`
    );
  }
  const examplesBlock = `--- Example ---\n${parts.join('\n')}`;

  const styleInstruction = styleBlock
    ? `\nSTYLING: The example email uses a <style> block (we will inject it server-side). You MUST output body markup that matches the example: same root element (e.g. table or div), same class names, same inline style= attributes, same table/cell structure. Copy the example HTML structure exactly—only replace headline text, body copy, product names/prices, image src and link href (use the placeholders). Do NOT output a minimal or generic layout; replicate the example's structure so the injected styles apply.\n`
    : `\nSTYLING: Your htmlBody MUST use the same HTML structure, inline style= attributes, and class names as the example. Copy the example's markup patterns (tables, cells, fonts, colours). Only replace headline/body text and product details. Do not output plain or unstyled HTML.\n`;

  const layoutBlock =
    (sample?.layoutNotes || (sample?.sectionTags?.length ?? 0) > 0)
      ? `\nLAYOUT: Follow any "Layout notes" and "Section tags" above. Put product blocks, category links, and CTAs in the sections indicated.\n`
      : '';

  // Use placeholder URLs in the prompt to avoid long URLs blowing the token limit; we replace them in the output
  const itemsForPrompt = inventoryItems.slice(0, MAX_INVENTORY_IN_PROMPT);
  const urlReplacements: { placeholder: string; value: string }[] = [];
  const inventoryBlock = itemsForPrompt
    .map((item, index) => {
      const i = index + 1;
      const imgPlaceholder = `${IMAGE_URL_PLACEHOLDER_PREFIX}${i}___`;
      const linkPlaceholder = `${PRODUCT_URL_PLACEHOLDER_PREFIX}${i}___`;
      const firstImage = item.image_urls?.[0] ?? '';
      const productUrl = item.product_url ?? '';
      if (firstImage) urlReplacements.push({ placeholder: imgPlaceholder, value: firstImage });
      if (productUrl) urlReplacements.push({ placeholder: linkPlaceholder, value: productUrl });
      const lineParts = [
        `[${i}] ${item.brand} ${item.model}: ${item.title ?? `${item.brand} ${item.model}`} | $${item.sale_price} AUD | ${item.listing_type}`,
      ];
      if (firstImage) lineParts.push(`image_url: ${imgPlaceholder}`);
      if (productUrl) lineParts.push(`product_url: ${linkPlaceholder}`);
      return lineParts.join(' | ');
    })
    .join('\n');
  const extraItemsNote =
    inventoryItems.length > MAX_INVENTORY_IN_PROMPT
      ? `\n(Only the first ${MAX_INVENTORY_IN_PROMPT} products are listed above; feature these in the email.)\n`
      : '';

  const urlInstruction = urlReplacements.length > 0
    ? `\nCRITICAL - USE PLACEHOLDERS: In your htmlBody use the exact placeholders above for URLs (e.g. ___IMG_1___ for product 1 image src, ___LINK_1___ for product 1 link href). Do not modify these placeholders; they will be replaced with real URLs.\n`
    : '';

  const userPrompt = `Generate one marketing email that looks and reads like the CHT example below, but promotes the given inventory.

EXAMPLE EMAIL (copy its structure and styling exactly; only change the content):
${examplesBlock}
${styleInstruction}
${layoutBlock}

INVENTORY TO PROMOTE (use the exact image_url and product_url for each item):
${inventoryBlock}
${extraItemsNote}
${urlInstruction}

INTENT: ${intent}
${audience ? `TARGET AUDIENCE: ${audience}` : ''}

Return a JSON object with:
- "subject": string (email subject line, in the same style as the example)
- "preheader": string (optional preview text)
- "htmlBody": string (FULL HTML for the email body. MUST preserve the example's styling: same <style> if present, same table/layout structure, same inline styles and class names. Use the exact image_url and product_url from the inventory list for each product's image and link. Only change: headline, body copy, product names/prices, CTA text. Output complete HTML that will render like the example.)
- "plainText": string (optional)

Use Australian English and AUD pricing. Return only the JSON object.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await anthropic.messages.create({
    model: config.ai.model,
    max_tokens: 8192,
    temperature: 0.3,
    system: EMAIL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text in AI response');
  }

  let raw = textBlock.text.trim();
  if (raw.includes('```')) {
    raw = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) raw = match[0];

  let parsed: { subject?: string; preheader?: string; htmlBody?: string; plainText?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error('AI response was not valid JSON');
  }

  const subject = parsed.subject ?? 'New arrivals from CHT';
  let htmlBody = parsed.htmlBody ?? '';
  if (!htmlBody) {
    throw new Error('AI did not return htmlBody');
  }

  // Replace placeholder URLs with real URLs (we used placeholders in the prompt to save tokens)
  for (const { placeholder, value } of urlReplacements) {
    htmlBody = htmlBody.split(placeholder).join(value);
  }

  // If the style guide had a <style> block and the model didn't include it, prepend it so styling is preserved
  if (styleBlock && !/^\s*<style[\s>]/i.test(htmlBody.trim())) {
    htmlBody = `<style>${styleBlock.slice(0, MAX_STYLE_BLOCK)}</style>\n${htmlBody}`;
  }

  return {
    subject,
    preheader: parsed.preheader ?? null,
    htmlBody,
    plainText: parsed.plainText ?? null,
  };
}

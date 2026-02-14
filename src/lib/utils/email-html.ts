/**
 * Extract and replace key text in email HTML for inline editing (headline, body, CTA).
 * Runs in the browser (uses DOM).
 */

export interface EmailKeyText {
  headline: string;
  body: string;
  cta: string;
}

/**
 * Extract first heading, first substantial paragraph, and first CTA link text from email HTML.
 */
export function extractKeyText(html: string): EmailKeyText {
  if (typeof document === 'undefined') {
    return { headline: '', body: '', cta: '' };
  }
  const div = document.createElement('div');
  div.innerHTML = html;

  const headline =
    div.querySelector('h1')?.textContent?.trim() ||
    div.querySelector('h2')?.textContent?.trim() ||
    div.querySelector('[style*="font-size"]')?.textContent?.trim() ||
    '';

  const firstP = div.querySelector('p');
  const body = firstP?.textContent?.trim() || '';

  const ctaLink =
    div.querySelector('a[class*="button"], a[class*="cta"], a[class*="btn"]') ||
    div.querySelector('table a[href]');
  const cta = ctaLink?.textContent?.trim() || '';

  return { headline, body, cta };
}

/**
 * Replace headline, body, and/or CTA text in email HTML. Preserves structure; only updates text content of first matching nodes.
 */
export function replaceKeyText(
  html: string,
  replacements: Partial<EmailKeyText>
): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;

  if (replacements.headline !== undefined) {
    const el = div.querySelector('h1') || div.querySelector('h2') || div.querySelector('[style*="font-size"]');
    if (el) el.textContent = replacements.headline;
  }
  if (replacements.body !== undefined) {
    const el = div.querySelector('p');
    if (el) el.textContent = replacements.body;
  }
  if (replacements.cta !== undefined) {
    const el =
      div.querySelector('a[class*="button"], a[class*="cta"], a[class*="btn"]') ||
      div.querySelector('table a[href]');
    if (el) el.textContent = replacements.cta;
  }

  return div.innerHTML;
}

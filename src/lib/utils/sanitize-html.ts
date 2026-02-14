/**
 * Lightweight HTML sanitizer for untrusted template/AI HTML.
 * Removes scripts, inline event handlers, and javascript: URLs.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  if (typeof window === 'undefined') {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('script').forEach((node) => node.remove());

  const allElements = template.content.querySelectorAll('*');
  allElements.forEach((element) => {
    const attrs = Array.from(element.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();

      if (name.startsWith('on')) {
        element.removeAttribute(attr.name);
        continue;
      }

      if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
        element.setAttribute(attr.name, '#');
      }
    }
  });

  return template.innerHTML;
}

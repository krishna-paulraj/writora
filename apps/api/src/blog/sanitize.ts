import sanitizeHtml from 'sanitize-html';

export const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'em',
    'u',
    's',
    'code',
    'mark',
    'sub',
    'sup',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'a',
    'img',
    'span',
    'div',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'class'],
    img: ['src', 'alt', 'title', 'class', 'width', 'height'],
    code: ['class'],
    pre: ['class'],
    span: ['class', 'style'],
    div: ['class'],
    '*': ['data-*'],
  },
  // `data:` is NOT allowed globally (a clickable <a href="data:text/html,…">
  // is a phishing/XSS vector); it's permitted only on <img> for inline image
  // previews via allowedSchemesByTag below.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  // Constrain inline styles to a safe allowlist so stored content can't use
  // e.g. `position:fixed` full-page overlays for defacement/clickjacking.
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      color: [
        /^#(0x)?[0-9a-f]+$/i,
        /^rgb\(\s*\d{1,3}(\s*,\s*\d{1,3}){2}\s*\)$/,
      ],
      'background-color': [
        /^#(0x)?[0-9a-f]+$/i,
        /^rgb\(\s*\d{1,3}(\s*,\s*\d{1,3}){2}\s*\)$/,
      ],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'font-style': [/^(normal|italic)$/],
      'text-decoration': [/^(none|underline|line-through)$/],
    },
  },
  // Drop anything dangerous outright instead of escaping it
  disallowedTagsMode: 'discard',
  // Strip <script>, <style>, and their contents entirely
  nonTextTags: ['style', 'script', 'textarea', 'option'],
};

export function sanitizeContent(content: string): string {
  return sanitizeHtml(content, SANITIZE_OPTIONS);
}

const WORDS_PER_MINUTE = 200;

export function computeReadTime(html: string): number {
  if (!html) return 1;
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 1;
  const words = text.split(' ').length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

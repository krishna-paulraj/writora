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
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
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

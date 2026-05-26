import { sanitizeContent, computeReadTime } from './sanitize';

describe('sanitizeContent', () => {
  it('strips script tags entirely (content removed too)', () => {
    const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const out = sanitizeContent(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert');
    expect(out).toContain('<p>Hello</p>');
    expect(out).toContain('<p>World</p>');
  });

  it('strips style blocks entirely', () => {
    const input = '<style>body { display: none }</style><p>Hi</p>';
    const out = sanitizeContent(input);
    expect(out).not.toContain('<style');
    expect(out).not.toContain('display: none');
    expect(out).toContain('<p>Hi</p>');
  });

  it('drops on* event handlers from allowed tags', () => {
    const input = '<a href="https://example.com" onclick="alert(1)">click</a>';
    const out = sanitizeContent(input);
    expect(out).not.toContain('onclick');
    expect(out).toContain('href="https://example.com"');
  });

  it('drops javascript: URLs in href', () => {
    const input = '<a href="javascript:alert(1)">x</a>';
    const out = sanitizeContent(input);
    expect(out).not.toContain('javascript:');
  });

  it('drops javascript: URLs in img src', () => {
    const input = '<img src="javascript:alert(1)" />';
    const out = sanitizeContent(input);
    expect(out).not.toContain('javascript:');
  });

  it('allows safe inline content', () => {
    const input =
      '<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>';
    expect(sanitizeContent(input)).toBe(input);
  });

  it('allows data-* attributes on any element', () => {
    const input = '<div data-id="42">x</div>';
    expect(sanitizeContent(input)).toContain('data-id="42"');
  });

  it('drops iframe entirely', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    expect(sanitizeContent(input)).not.toContain('iframe');
  });

  it('drops object/embed entirely', () => {
    const input = '<object data="x.swf"></object><embed src="x.swf" />';
    const out = sanitizeContent(input);
    expect(out).not.toContain('<object');
    expect(out).not.toContain('<embed');
  });

  it('preserves http and https img src', () => {
    const a = '<img src="https://cdn.example.com/x.png" alt="x" />';
    expect(sanitizeContent(a)).toContain('src="https://cdn.example.com/x.png"');
    const b = '<img src="http://cdn.example.com/x.png" alt="x" />';
    expect(sanitizeContent(b)).toContain('src="http://cdn.example.com/x.png"');
  });

  it('allows data: image URIs (used by the editor for inline previews)', () => {
    const input = '<img src="data:image/png;base64,iVBORw0KGgo=" alt="x" />';
    expect(sanitizeContent(input)).toContain('data:image/png;base64,');
  });
});

describe('computeReadTime', () => {
  it('returns 1 minute for empty content', () => {
    expect(computeReadTime('')).toBe(1);
    expect(computeReadTime('<p></p>')).toBe(1);
  });

  it('returns 1 minute for short content', () => {
    expect(computeReadTime('<p>Hello world</p>')).toBe(1);
  });

  it('rounds up at 200 words per minute', () => {
    const words = Array(400).fill('word').join(' ');
    expect(computeReadTime(`<p>${words}</p>`)).toBe(2);
  });

  it('ignores HTML when counting words', () => {
    const tagSoup = '<div><p><strong>one</strong></p><p><em>two</em></p></div>';
    expect(computeReadTime(tagSoup)).toBe(1);
  });
});

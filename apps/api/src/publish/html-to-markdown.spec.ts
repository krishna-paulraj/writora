import { htmlToMarkdown } from './html-to-markdown';

describe('htmlToMarkdown', () => {
  it('converts headings', () => {
    expect(htmlToMarkdown('<h2>Title</h2>')).toBe('## Title');
    expect(htmlToMarkdown('<h3>Sub</h3>')).toBe('### Sub');
  });

  it('converts paragraphs with inline marks and links', () => {
    const html =
      '<p>Some <strong>bold</strong> and <em>italic</em> and a <a href="https://x.com">link</a>.</p>';
    expect(htmlToMarkdown(html)).toBe(
      'Some **bold** and _italic_ and a [link](https://x.com).',
    );
  });

  it('converts unordered and ordered lists', () => {
    expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe(
      '- one\n- two',
    );
    expect(htmlToMarkdown('<ol><li>one</li><li>two</li></ol>')).toBe(
      '1. one\n2. two',
    );
  });

  it('converts blockquotes', () => {
    expect(htmlToMarkdown('<blockquote>quoted</blockquote>')).toBe('> quoted');
  });

  it('separates blocks with a blank line and preserves order', () => {
    const html = '<h2>H</h2><p>para</p><ul><li>x</li></ul>';
    expect(htmlToMarkdown(html)).toBe('## H\n\npara\n\n- x');
  });

  it('decodes HTML entities', () => {
    expect(htmlToMarkdown('<p>Tom &amp; Jerry &lt;3</p>')).toBe(
      'Tom & Jerry <3',
    );
  });

  it('strips unknown tags rather than emitting raw HTML', () => {
    expect(htmlToMarkdown('<p>hi <span class="x">there</span></p>')).toBe(
      'hi there',
    );
  });

  it('returns empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
    expect(htmlToMarkdown('   ')).toBe('');
  });

  it('converts images to markdown (no data loss)', () => {
    expect(
      htmlToMarkdown(
        '<p>Look <img src="https://x.com/a.png" alt="cat"> here</p>',
      ),
    ).toBe('Look ![cat](https://x.com/a.png) here');
  });

  it('preserves inline formatting inside links', () => {
    expect(
      htmlToMarkdown(
        '<p>see <a href="https://x.com"><strong>this</strong></a></p>',
      ),
    ).toBe('see [**this**](https://x.com)');
  });

  it('maps all heading levels', () => {
    expect(htmlToMarkdown('<h1>A</h1><h4>B</h4>')).toBe('# A\n\n#### B');
  });

  it('fences code blocks and preserves whitespace', () => {
    expect(htmlToMarkdown('<pre><code>line 1\n  line 2</code></pre>')).toBe(
      '```\nline 1\n  line 2\n```',
    );
  });

  it('converts inline code', () => {
    expect(htmlToMarkdown('<p>run <code>npm i</code> now</p>')).toBe(
      'run `npm i` now',
    );
  });

  it('indents nested lists', () => {
    expect(
      htmlToMarkdown('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>'),
    ).toBe('- a\n  - b\n- c');
  });

  it('quotes every line of a blockquote with block children', () => {
    expect(
      htmlToMarkdown('<blockquote><p>one</p><p>two</p></blockquote>'),
    ).toBe('> one\n>\n> two');
  });

  it('renders tables as GFM', () => {
    expect(
      htmlToMarkdown(
        '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
      ),
    ).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });
});

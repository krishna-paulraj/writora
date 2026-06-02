// HTML→Markdown converter for cross-posting to markdown-only platforms (Dev.to).
// Tuned for blog content — the AI writer's tag subset plus what the editor can
// add (images, code blocks, tables, all heading levels, nested lists). Uses
// depth-aware tokenizers for block/list containers so nested structures are
// preserved rather than flattened. Not a general-purpose converter.

const BLOCK_TAGS = 'h1|h2|h3|h4|h5|h6|p|blockquote|ul|ol|pre|table';

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&'); // last, so we don't double-decode
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : '';
}

/** Converts inline markup within a block to markdown, flattening to text. */
function inlineToMd(html: string): string {
  let s = html;
  // Images can appear inline; convert before stripping tags.
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = attr(tag, 'src');
    return src ? `![${attr(tag, 'alt')}](${src})` : '';
  });
  // Marks BEFORE links so formatting inside a link (<a><strong>x</strong></a>)
  // survives.
  s = s.replace(
    /<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _t, i: string) => `**${stripTags(i).trim()}**`,
  );
  s = s.replace(
    /<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _t, i: string) => `_${stripTags(i).trim()}_`,
  );
  s = s.replace(
    /<code\b[^>]*>([\s\S]*?)<\/code>/gi,
    (_m, i: string) => `\`${decodeEntities(stripTags(i)).trim()}\``,
  );
  s = s.replace(
    /<a\b[^>]*\bhref=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, text: string) => `[${stripTags(text).trim()}](${href})`,
  );
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = decodeEntities(stripTags(s));
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** Splits HTML into top-level block containers, honouring nesting via a stack. */
function splitBlocks(html: string): { tag: string; inner: string }[] {
  const tagRe = new RegExp(`<(/?)(${BLOCK_TAGS})\\b[^>]*>`, 'gi');
  const blocks: { tag: string; inner: string }[] = [];
  let depth = 0;
  let topTag = '';
  let start = -1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const closing = m[1] === '/';
    if (!closing) {
      if (depth === 0) {
        topTag = m[2].toLowerCase();
        start = m.index + m[0].length;
      }
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        blocks.push({ tag: topTag, inner: html.slice(start, m.index) });
        start = -1;
      }
    }
  }
  return blocks;
}

/** Returns the inner HTML of each top-level <li>, skipping nested list items. */
function topLevelListItems(inner: string): string[] {
  const items: string[] = [];
  const tagRe = /<(\/?)(li|ul|ol)\b[^>]*>/gi;
  let depth = 0; // nested ul/ol depth within the current top-level li
  let liStart = -1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(inner)) !== null) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (tag === 'li') {
      if (!closing && liStart === -1 && depth === 0) {
        liStart = m.index + m[0].length;
      } else if (closing && depth === 0 && liStart !== -1) {
        items.push(inner.slice(liStart, m.index));
        liStart = -1;
      }
    } else if (liStart !== -1) {
      if (!closing) depth++;
      else if (depth > 0) depth--;
    }
  }
  if (liStart !== -1) items.push(inner.slice(liStart));
  return items;
}

interface NestedList {
  inner: string;
  ordered: boolean;
}

/** Separates a list item's own content from any nested lists it contains. */
function splitNested(li: string): { own: string; nested: NestedList[] } {
  const nested: NestedList[] = [];
  const tagRe = /<(\/?)(ul|ol)\b[^>]*>/gi;
  let depth = 0;
  let start = -1;
  let ordered = false;
  let firstStart = -1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(li)) !== null) {
    const closing = m[1] === '/';
    if (!closing) {
      if (depth === 0) {
        start = m.index + m[0].length;
        ordered = m[2].toLowerCase() === 'ol';
        if (firstStart === -1) firstStart = m.index;
      }
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        nested.push({ inner: li.slice(start, m.index), ordered });
        start = -1;
      }
    }
  }
  return { own: firstStart === -1 ? li : li.slice(0, firstStart), nested };
}

function convertList(inner: string, ordered: boolean, indent: string): string {
  const lines: string[] = [];
  let n = 1;
  for (const li of topLevelListItems(inner)) {
    const { own, nested } = splitNested(li);
    const bullet = ordered ? `${n++}.` : '-';
    lines.push(`${indent}${bullet} ${inlineToMd(own)}`.replace(/\s+$/, ''));
    for (const sub of nested) {
      const subMd = convertList(sub.inner, sub.ordered, indent + '  ');
      if (subMd) lines.push(subMd);
    }
  }
  return lines.join('\n');
}

function convertPre(inner: string): string {
  const code = decodeEntities(
    stripTags(
      inner.replace(/^\s*<code\b[^>]*>/i, '').replace(/<\/code>\s*$/i, ''),
    ),
  ).replace(/\n+$/, '');
  return '```\n' + code + '\n```';
}

function convertBlockquote(inner: string): string {
  const body = htmlToMarkdown(inner) || inlineToMd(inner);
  return body
    .split('\n')
    .map((l) => (l ? `> ${l}` : '>'))
    .join('\n');
}

function convertTable(inner: string): string {
  const rows: string[][] = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(inner)) !== null) {
    const cells: string[] = [];
    const cellRe = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(tr[1])) !== null) {
      cells.push(inlineToMd(c[2]).replace(/\|/g, '\\|').replace(/\n/g, ' '));
    }
    if (cells.length) rows.push(cells);
  }
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => {
    const out = r.slice();
    while (out.length < width) out.push('');
    return out;
  };
  const out = [
    `| ${pad(rows[0]).join(' | ')} |`,
    `| ${pad(rows[0])
      .map(() => '---')
      .join(' | ')} |`,
  ];
  for (const r of rows.slice(1)) out.push(`| ${pad(r).join(' | ')} |`);
  return out.join('\n');
}

export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';

  const blocks = splitBlocks(html);
  if (blocks.length === 0) return inlineToMd(html);

  const out: string[] = [];
  for (const { tag, inner } of blocks) {
    if (/^h[1-6]$/.test(tag)) {
      out.push(`${'#'.repeat(Number(tag[1]))} ${inlineToMd(inner)}`);
    } else if (tag === 'p') {
      const t = inlineToMd(inner);
      if (t) out.push(t);
    } else if (tag === 'blockquote') {
      out.push(convertBlockquote(inner));
    } else if (tag === 'pre') {
      out.push(convertPre(inner));
    } else if (tag === 'table') {
      const t = convertTable(inner);
      if (t) out.push(t);
    } else {
      const t = convertList(inner, tag === 'ol', '');
      if (t) out.push(t);
    }
  }
  return out.join('\n\n');
}

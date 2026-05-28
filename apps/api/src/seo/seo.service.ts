import { Injectable } from '@nestjs/common';
import { ScoreSeoDto } from './dto/score-seo.dto';

export interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface SeoScoreResult {
  score: number;
  checks: SeoCheck[];
  wordCount: number;
  keywordDensity: number;
}

const WORD_COUNT_TARGET: Record<string, number> = {
  short: 600,
  medium: 1200,
  long: 2200,
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchHeadings(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  return [...html.matchAll(re)].map((m) => stripHtml(m[1] ?? ''));
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g);
  let n = groups ? groups.length : 0;
  if (w.endsWith('e') && n > 1) n -= 1; // crude silent-e adjustment
  return Math.max(1, n);
}

@Injectable()
export class SeoService {
  score(input: ScoreSeoDto): SeoScoreResult {
    const title = (input.title ?? '').trim();
    const description = (input.description ?? '').trim();
    const html = input.contentHtml ?? '';
    const kw = (input.targetKeyword ?? '').trim().toLowerCase();
    const length = input.length ?? 'medium';
    const hasKw = kw.length > 0;
    const noKw = 'Set a target keyword';

    const text = stripHtml(html);
    const words = text ? text.split(' ').filter(Boolean) : [];
    const wordCount = words.length;

    const h2s = matchHeadings(html, 'h2');
    const headingCount =
      h2s.length +
      matchHeadings(html, 'h3').length +
      matchHeadings(html, 'h4').length;
    const firstParaMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const firstPara = firstParaMatch
      ? stripHtml(firstParaMatch[1] ?? '').toLowerCase()
      : '';

    // Keyword density via word-boundary matches (avoids 'art' inside 'start').
    let density = 0;
    if (hasKw && wordCount > 0) {
      const kwWords = kw.split(/\s+/).filter(Boolean).length || 1;
      const matches = text
        .toLowerCase()
        .match(new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'g'));
      const count = matches ? matches.length : 0;
      density = ((count * kwWords) / wordCount) * 100;
    }

    // Basic Flesch Reading Ease.
    const sentences = (text.match(/[.!?]+/g) ?? []).length || 1;
    const syllables = words.reduce((acc, w) => acc + countSyllables(w), 0);
    const flesch =
      wordCount > 0
        ? 206.835 -
          1.015 * (wordCount / sentences) -
          84.6 * (syllables / wordCount)
        : 0;

    const target = WORD_COUNT_TARGET[length] ?? 1200;

    const checks: SeoCheck[] = [
      {
        id: 'keyword-in-title',
        label: 'Keyword in title',
        passed: hasKw && title.toLowerCase().includes(kw),
        detail: !hasKw ? noKw : title ? 'Checked the title' : 'Title is empty',
      },
      {
        id: 'keyword-in-meta',
        label: 'Keyword in meta description',
        passed: hasKw && description.toLowerCase().includes(kw),
        detail: !hasKw
          ? noKw
          : description
            ? 'Checked the description'
            : 'Description is empty',
      },
      {
        id: 'keyword-in-intro',
        label: 'Keyword in first paragraph',
        passed: hasKw && firstPara.includes(kw),
        detail: !hasKw ? noKw : 'Use the keyword early in the article',
      },
      {
        id: 'keyword-in-h2',
        label: 'Keyword in a heading',
        passed: hasKw && h2s.some((h) => h.toLowerCase().includes(kw)),
        detail: !hasKw ? noKw : `${h2s.length} H2 heading(s) found`,
      },
      {
        id: 'keyword-density',
        label: 'Keyword density 0.5–2.5%',
        passed: hasKw && density >= 0.5 && density <= 2.5,
        detail: !hasKw ? noKw : `${density.toFixed(1)}%`,
      },
      {
        id: 'word-count',
        label: `Length ≥ ${target} words`,
        passed: wordCount >= target,
        detail: `${wordCount} words`,
      },
      {
        id: 'meta-length',
        label: 'Meta description 120–160 chars',
        passed: description.length >= 120 && description.length <= 160,
        detail: `${description.length} chars`,
      },
      {
        id: 'title-length',
        label: 'Title ≤ 70 chars',
        passed: title.length > 0 && title.length <= 70,
        detail: `${title.length} chars`,
      },
      {
        id: 'headings',
        label: 'At least 2 headings',
        passed: headingCount >= 2,
        detail: `${headingCount} heading(s)`,
      },
      {
        id: 'readability',
        label: 'Readable (Flesch ≥ 50)',
        passed: wordCount > 0 && flesch >= 50,
        detail:
          wordCount > 0 ? `Flesch ${Math.round(flesch)}` : 'No content yet',
      },
    ];

    const passed = checks.filter((c) => c.passed).length;
    const score = Math.round((passed / checks.length) * 100);

    return {
      score,
      checks,
      wordCount,
      keywordDensity: Math.round(density * 10) / 10,
    };
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type EditAction =
  | 'improve'
  | 'fix'
  | 'shorten'
  | 'lengthen'
  | 'continue'
  | 'tone';

export type Tone =
  | 'professional'
  | 'casual'
  | 'friendly'
  | 'witty'
  | 'confident';

export type ArticleLength = 'short' | 'medium' | 'long';

export interface ArticleInput {
  topic: string;
  targetKeyword?: string;
  relatedKeywords?: string[];
  tone?: Tone;
  length?: ArticleLength;
  audience?: string;
}

export interface PlanIdea {
  title: string;
  targetKeyword?: string;
}

export interface PlanIdeasInput {
  topic: string;
  audience?: string;
  tone?: Tone;
  count: number;
  seedKeywords?: string[];
}

export interface OutlineSection {
  heading: string;
  subheadings: string[];
}

export interface ArticleOutline {
  sections: OutlineSection[];
}

export interface GeneratedArticle {
  outline: ArticleOutline;
  contentHtml: string;
  titleOptions: string[];
  metaDescription: string;
}

const MAX_INPUT_CHARS = 12_000; // ~3k tokens
const MAX_OUTPUT_TOKENS = 1024;
const OUTLINE_MAX_TOKENS = 900;
const SECTION_MAX_TOKENS = 1000;
const PLAN_IDEAS_MAX_TOKENS = 1200;
// Per-call ceiling so a stalled OpenAI request fails the job instead of
// blocking the queue consumer (prefetch=1) indefinitely.
const PER_CALL_TIMEOUT_MS = 90_000;

// Tags the section writer is allowed to emit — a subset of what sanitizeContent
// keeps, chosen so generated articles render cleanly in the Tiptap editor.
const ALLOWED_HTML_TAGS =
  '<h2> <h3> <p> <ul> <ol> <li> <strong> <em> <blockquote> <a>';

const LENGTH_SPEC: Record<
  ArticleLength,
  { sectionCount: string; wordsPerSection: string }
> = {
  short: { sectionCount: '3 to 4', wordsPerSection: '120-180' },
  medium: { sectionCount: '5 to 7', wordsPerSection: '180-260' },
  long: { sectionCount: '8 to 10', wordsPerSection: '250-350' },
};

function buildEditPrompt(
  action: EditAction,
  text: string,
  tone?: Tone,
): string {
  switch (action) {
    case 'improve':
      return `Rewrite the following text to be clearer, more engaging, and well-structured. Preserve the original meaning, tone, and voice. Return ONLY the rewritten text — no preamble, no quotes, no explanations.\n\nText:\n${text}`;
    case 'fix':
      return `Fix any spelling, grammar, and punctuation errors in this text. Preserve the writer's voice and meaning exactly. Return ONLY the corrected text.\n\nText:\n${text}`;
    case 'shorten':
      return `Rewrite this text to be more concise. Keep the key points and tone. Aim for 30-50% shorter. Return ONLY the rewritten text.\n\nText:\n${text}`;
    case 'lengthen':
      return `Expand this text with more detail, examples, or supporting points. Match the original tone and voice. Return ONLY the expanded text.\n\nText:\n${text}`;
    case 'tone':
      if (!tone) throw new BadRequestException('tone required for tone action');
      return `Rewrite this text in a ${tone} tone. Preserve the meaning. Return ONLY the rewritten text.\n\nText:\n${text}`;
    case 'continue':
      return `Continue this piece of writing naturally — match the tone, style, and voice. Write 1-3 paragraphs that flow from where it ends. Return ONLY the new content, not the original.\n\nText:\n${text}`;
  }
}

function describeAudience(input: ArticleInput): string {
  return input.audience ? ` The target audience is: ${input.audience}.` : '';
}

function describeKeyword(input: ArticleInput): string {
  return input.targetKeyword
    ? ` Naturally target the SEO keyword "${input.targetKeyword}" throughout, including in headings where it reads well.`
    : '';
}

function describeRelatedKeywords(input: ArticleInput): string {
  const list = (input.relatedKeywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 10);
  return list.length
    ? ` Where it reads naturally, also incorporate these related keywords: ${list.join(', ')}. Do not keyword-stuff.`
    : '';
}

function buildOutlinePrompt(input: ArticleInput): string {
  const spec = LENGTH_SPEC[input.length ?? 'medium'];
  return `Create an SEO article outline for the topic: "${input.topic}".${describeKeyword(input)}${describeRelatedKeywords(input)}${describeAudience(input)} Use a ${input.tone ?? 'professional'} tone. Produce ${spec.sectionCount} top-level sections (H2), each with up to 3 subheadings (H3). Cover the topic comprehensively without overlapping sections, and order them logically. Return JSON of the form {"sections":[{"heading":"...","subheadings":["...","..."]}]}.`;
}

function buildPlanIdeasPrompt(input: PlanIdeasInput): string {
  const audience = input.audience
    ? ` The target audience is: ${input.audience}.`
    : '';
  const seeds = (input.seedKeywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 15);
  const seedLine = seeds.length
    ? ` Prioritise ideas that target or naturally relate to these seed keywords where sensible: ${seeds.join(', ')}.`
    : '';
  return `You are building an SEO topic cluster. The pillar topic/theme is: "${input.topic}".${audience}${seedLine} Propose exactly ${input.count} distinct article ideas that together cover this theme comprehensively for search — no two ideas should overlap or target the same primary keyword. For each idea, give a specific, compelling SEO title under 70 characters and a concise primary target keyword (a lowercase search phrase). Use a ${input.tone ?? 'professional'} angle. Order them from foundational to advanced. Return JSON of the form {"ideas":[{"title":"...","targetKeyword":"..."}]}.`;
}

function buildSectionPrompt(
  input: ArticleInput,
  outline: ArticleOutline,
  index: number,
): string {
  const spec = LENGTH_SPEC[input.length ?? 'medium'];
  const section = outline.sections[index];
  const outlineSummary = outline.sections
    .map((s, i) => `${i + 1}. ${s.heading}`)
    .join('\n');
  const subs = section.subheadings?.length
    ? ` Where they fit, use these H3 subheadings: ${section.subheadings.join(', ')}.`
    : '';
  return `You are writing ONE section of an article about "${input.topic}".${describeKeyword(input)}${describeRelatedKeywords(input)}${describeAudience(input)} Use a ${input.tone ?? 'professional'} tone.

Full outline (for context only — do NOT write the other sections and do not repeat their content):
${outlineSummary}

Write only the section titled "${section.heading}".${subs} Aim for about ${spec.wordsPerSection} words. Begin the output with an <h2> containing the section heading.`;
}

// LLMs sometimes wrap HTML in ```html fences despite instructions — strip them.
function stripCodeFences(html: string): string {
  return html
    .replace(/^\s*```[a-zA-Z]*\s*/, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    this.model = config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('OPENAI_API_KEY not set — AI endpoints will return 503');
    }
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI is not configured on this server',
      );
    }
    return this.client;
  }

  private truncate(text: string): string {
    if (text.length <= MAX_INPUT_CHARS) return text;
    return text.slice(0, MAX_INPUT_CHARS);
  }

  /**
   * Streams the edited text. The caller (controller) is responsible for piping
   * the chunks to the HTTP response.
   */
  async *streamEdit(
    action: EditAction,
    text: string,
    tone?: Tone,
  ): AsyncGenerator<string> {
    if (!text || text.trim().length === 0) {
      throw new BadRequestException('text is required');
    }
    const client = this.ensureClient();
    const prompt = buildEditPrompt(action, this.truncate(text), tone);

    const stream = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a skilled writing assistant. Respond with the edited text only — no preamble, no explanation, no quotes around the result.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async suggestTitles(content: string): Promise<string[]> {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('content is required');
    }
    const client = this.ensureClient();
    const stripped = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const res = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You generate compelling blog post titles. Respond with a JSON object: {"titles": ["title 1", "title 2", "title 3", "title 4", "title 5"]}. No other text.',
        },
        {
          role: 'user',
          content: `Generate 5 specific, intriguing, SEO-friendly titles for this content. Avoid clickbait. Each under 70 characters.\n\nContent:\n${this.truncate(stripped)}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const raw = res.choices[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(raw) as { titles?: unknown };
      if (!Array.isArray(parsed.titles)) return [];
      return parsed.titles
        .filter((t): t is string => typeof t === 'string')
        .slice(0, 5);
    } catch {
      this.logger.warn(`failed to parse title JSON: ${raw.slice(0, 200)}`);
      return [];
    }
  }

  async summarize(content: string): Promise<string> {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('content is required');
    }
    const client = this.ensureClient();
    const stripped = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const res = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You write concise meta descriptions for blog posts. Return ONLY the description — no preamble, no quotes.',
        },
        {
          role: 'user',
          content: `Write a 1-2 sentence description for this blog post, under 160 characters. Make it specific and inviting.\n\nContent:\n${this.truncate(stripped)}`,
        },
      ],
      max_tokens: 120,
      temperature: 0.6,
    });

    return (res.choices[0]?.message?.content || '').trim();
  }

  /**
   * Writes a punchy, single-tweet hook for a freshly published post — used by
   * the X (Twitter) auto-post adapter. Returns ONLY the hook text (no link);
   * the adapter appends the canonical URL and enforces the 280-char budget.
   * Throws when AI is unconfigured so the caller can fall back to a plain
   * title-and-link announcement.
   */
  async composeTweet(input: {
    title: string;
    description?: string;
    maxChars: number;
  }): Promise<string> {
    const client = this.ensureClient();
    const title = input.title.trim();
    const context = input.description?.trim()
      ? `Title: ${title}\nSummary: ${input.description.trim()}`
      : `Title: ${title}`;

    const res = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You write punchy tweets that make people want to click through to a blog post. Return ONLY the tweet text — no preamble, no surrounding quotes — and do NOT include any link or URL (it is appended separately). At most one tasteful hashtag, and only if it reads naturally.',
        },
        {
          role: 'user',
          content: `Write a single tweet (strictly under ${input.maxChars} characters) promoting this post. Hook the reader; don't just restate the title.\n\n${this.truncate(context)}`,
        },
      ],
      max_tokens: 160,
      temperature: 0.8,
    });

    return (res.choices[0]?.message?.content || '').trim();
  }

  /** Whether an OpenAI key is configured — lets callers skip doomed work. */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Brainstorms a content-plan's worth of article ideas (title + target
   * keyword) from a pillar topic. One JSON-mode call; used when creating an
   * autopilot ContentPlan.
   */
  async generatePlanIdeas(input: PlanIdeasInput): Promise<PlanIdea[]> {
    if (!input?.topic || input.topic.trim().length === 0) {
      throw new BadRequestException('topic is required');
    }
    const client = this.ensureClient();
    const count = Math.min(Math.max(input.count ?? 10, 1), 30);
    const res = await client.chat.completions.create(
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an SEO content strategist. Respond ONLY with a JSON object of the form {"ideas":[{"title":"...","targetKeyword":"..."}]}. No prose, no markdown.',
          },
          { role: 'user', content: buildPlanIdeasPrompt({ ...input, count }) },
        ],
        max_tokens: PLAN_IDEAS_MAX_TOKENS,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      },
      { timeout: PER_CALL_TIMEOUT_MS },
    );

    const raw = res.choices[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(raw) as { ideas?: unknown };
      if (!Array.isArray(parsed.ideas)) throw new Error('missing ideas array');
      const ideas: PlanIdea[] = parsed.ideas
        .filter(
          (i): i is Record<string, unknown> =>
            typeof i === 'object' && i !== null && 'title' in i,
        )
        .map((i) => ({
          title: typeof i.title === 'string' ? i.title.trim() : '',
          targetKeyword:
            typeof i.targetKeyword === 'string' && i.targetKeyword.trim()
              ? i.targetKeyword.trim()
              : undefined,
        }))
        .filter((i) => i.title.length > 0)
        .slice(0, count);
      if (ideas.length === 0) throw new Error('no valid ideas');
      return ideas;
    } catch (err) {
      this.logger.warn(
        `failed to parse plan ideas JSON: ${raw.slice(0, 200)} (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
      throw new BadRequestException('Failed to generate content plan ideas');
    }
  }

  async generateOutline(input: ArticleInput): Promise<ArticleOutline> {
    if (!input?.topic || input.topic.trim().length === 0) {
      throw new BadRequestException('topic is required');
    }
    const client = this.ensureClient();
    const res = await client.chat.completions.create(
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an SEO content strategist. Respond ONLY with a JSON object of the form {"sections":[{"heading":"...","subheadings":["..."]}]}. No prose, no markdown.',
          },
          { role: 'user', content: buildOutlinePrompt(input) },
        ],
        max_tokens: OUTLINE_MAX_TOKENS,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      },
      { timeout: PER_CALL_TIMEOUT_MS },
    );

    const raw = res.choices[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(raw) as { sections?: unknown };
      if (!Array.isArray(parsed.sections)) {
        throw new Error('missing sections array');
      }
      const sections: OutlineSection[] = parsed.sections
        .filter(
          (s): s is Record<string, unknown> =>
            typeof s === 'object' && s !== null && 'heading' in s,
        )
        .map((s) => ({
          heading: typeof s.heading === 'string' ? s.heading.trim() : '',
          subheadings: Array.isArray(s.subheadings)
            ? s.subheadings.filter((h): h is string => typeof h === 'string')
            : [],
        }))
        .filter((s) => s.heading.length > 0);
      if (sections.length === 0) throw new Error('no valid sections');
      return { sections };
    } catch (err) {
      this.logger.warn(
        `failed to parse outline JSON: ${raw.slice(0, 200)} (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
      throw new BadRequestException('Failed to generate a valid outline');
    }
  }

  async expandSection(
    input: ArticleInput,
    outline: ArticleOutline,
    sectionIndex: number,
  ): Promise<string> {
    const section = outline.sections[sectionIndex];
    if (!section) throw new BadRequestException('invalid section index');
    const client = this.ensureClient();
    const res = await client.chat.completions.create(
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert SEO writer. Return clean HTML for ONE article section using ONLY these tags: ${ALLOWED_HTML_TAGS}. Do not include <h1>, <html>, <body>, markdown, code fences, or any commentary — return HTML only.`,
          },
          {
            role: 'user',
            content: buildSectionPrompt(input, outline, sectionIndex),
          },
        ],
        max_tokens: SECTION_MAX_TOKENS,
        temperature: 0.7,
      },
      { timeout: PER_CALL_TIMEOUT_MS },
    );
    return stripCodeFences(res.choices[0]?.message?.content || '');
  }

  /**
   * Full article pipeline: outline → expand each section → title/meta. Slow
   * (one OpenAI call per section), so it runs inside a background job. The
   * optional onProgress callback lets the caller persist progress for polling.
   */
  async generateArticle(
    input: ArticleInput,
    onProgress?: (progress: number, stage: string) => void | Promise<void>,
  ): Promise<GeneratedArticle> {
    if (!input?.topic || input.topic.trim().length === 0) {
      throw new BadRequestException('topic is required');
    }
    this.ensureClient();

    await onProgress?.(5, 'outlining');
    const outline = await this.generateOutline(input);
    await onProgress?.(15, 'writing');

    const parts: string[] = [];
    const total = outline.sections.length;
    for (let i = 0; i < total; i++) {
      const html = await this.expandSection(input, outline, i);
      if (html) parts.push(html);
      // Sections span 15%→85% of the progress bar.
      await onProgress?.(15 + Math.round(((i + 1) / total) * 70), 'writing');
    }

    const contentHtml = parts.join('\n');
    if (!contentHtml.trim()) {
      throw new BadRequestException('Article generation produced no content');
    }

    await onProgress?.(90, 'finalizing');
    const [titleOptions, metaDescription] = await Promise.all([
      this.suggestTitles(contentHtml).catch(() => [] as string[]),
      this.summarize(contentHtml).catch(() => ''),
    ]);

    return { outline, contentHtml, titleOptions, metaDescription };
  }
}

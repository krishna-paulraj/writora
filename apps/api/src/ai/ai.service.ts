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

const MAX_INPUT_CHARS = 12_000; // ~3k tokens
const MAX_OUTPUT_TOKENS = 1024;

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
}

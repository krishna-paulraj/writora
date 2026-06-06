import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// Small, cheap, 1536-dim model — matches the vector(1536) column.
const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIMENSIONS = 1536;
const MAX_INPUT_CHARS = 8000; // ~2k tokens; plenty for title+keyword+excerpt
const PER_CALL_TIMEOUT_MS = 30_000;

/**
 * Thin wrapper around OpenAI embeddings, reusing the same OPENAI_API_KEY as the
 * article generator. Returns null (rather than throwing) when unconfigured so
 * callers can treat embeddings as best-effort.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly client: OpenAI | null;
  readonly model = EMBED_MODEL;
  readonly dimensions = EMBED_DIMENSIONS;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        'OPENAI_API_KEY not set — embeddings disabled (related-posts/backlinks degrade)',
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /** Embed a single text, or null if unconfigured / on failure. */
  async embed(text: string): Promise<number[] | null> {
    if (!this.client) return null;
    const input = text.slice(0, MAX_INPUT_CHARS).trim();
    if (!input) return null;
    try {
      const res = await this.client.embeddings.create(
        { model: EMBED_MODEL, input },
        { timeout: PER_CALL_TIMEOUT_MS },
      );
      return res.data[0]?.embedding ?? null;
    } catch (err) {
      this.logger.warn(
        `embedding failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /** Postgres pgvector literal for a parameterized `$N::vector` cast. */
  toVectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }
}

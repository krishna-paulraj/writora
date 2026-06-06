import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../storage/storage.service';
import { assertPublicUrl } from '../common/ssrf-guard';

export type ImageKind = 'featured' | 'inline';

export interface GenerateImageInput {
  /** A ready-to-use prompt. If omitted, one is built from the fields below. */
  prompt?: string;
  /** Site/user style; validated against the recraftv3 allowlist. */
  style?: string;
  kind?: ImageKind;
  title?: string;
  heading?: string;
  description?: string;
  keyword?: string;
}

export interface GeneratedImage {
  url: string;
}

// recraftv3 styles we expose. Anything else falls back to DEFAULT_STYLE.
const ALLOWED_STYLES = new Set([
  'digital_illustration',
  'realistic_image',
  'vector_illustration',
  'icon',
]);
const DEFAULT_STYLE = 'digital_illustration';

// recraftv3 supported sizes. Wide cover vs. square inline.
const FEATURED_SIZE = '1820x1024';
const INLINE_SIZE = '1024x1024';
const FEATURED_WIDTH = 1820;
const INLINE_WIDTH = 1024;
const WEBP_QUALITY = 85;

// Ceiling so a stalled Recraft request can't block the article queue consumer
// (prefetch=1) for too long. Kept tight because featured + inline generation is
// done inline in the consumer; moving it to a dedicated queue is a follow-up.
const PER_CALL_TIMEOUT_MS = 30_000;

interface RecraftResponse {
  data?: { url?: string; b64_json?: string }[];
}

/**
 * Generates blog imagery via Recraft.ai and re-hosts it in our own storage.
 *
 * Recraft returns a temporary CDN URL (expires ~24h), so every generated image
 * is fetched, transcoded to WebP, and stored through {@link StorageService}.
 * Used both automatically during article generation and on demand from the
 * editor (POST /ai/image). All public methods no-op-or-throw cleanly when the
 * API key is unset so callers can treat image generation as best-effort.
 */
@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly apiUrl: string;
  private readonly publicApiUrl: string;

  constructor(
    config: ConfigService,
    private storage: StorageService,
  ) {
    this.apiKey = config.get<string>('RECRAFT_API_KEY') || undefined;
    this.model = config.get<string>('RECRAFT_MODEL') || 'recraftv3';
    this.apiUrl = (
      config.get<string>('RECRAFT_API_URL') ||
      'https://external.api.recraft.ai/v1'
    ).replace(/\/$/, '');
    this.publicApiUrl = (config.get<string>('PUBLIC_API_URL') || '').replace(
      /\/$/,
      '',
    );
    if (!this.apiKey) {
      this.logger.warn(
        'RECRAFT_API_KEY not set — image generation is disabled',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Normalize an arbitrary style string to an allowed recraftv3 style. */
  resolveStyle(style?: string | null): string {
    return style && ALLOWED_STYLES.has(style) ? style : DEFAULT_STYLE;
  }

  /**
   * Generate a single image and return its (permanent) storage URL.
   * Throws 503 if unconfigured. The caller decides whether to swallow errors.
   */
  async generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Image generation is not configured on this server',
      );
    }
    const kind: ImageKind = input.kind ?? 'featured';
    const prompt = (
      input.prompt?.trim() || this.buildPrompt(kind, input)
    ).slice(0, 1000);
    if (!prompt) throw new BadRequestException('prompt is required');

    const style = this.resolveStyle(input.style);
    const size = kind === 'featured' ? FEATURED_SIZE : INLINE_SIZE;
    const width = kind === 'featured' ? FEATURED_WIDTH : INLINE_WIDTH;

    const sourceUrl = await this.requestRecraftImage(prompt, style, size);
    const buf = await this.fetchAndTranscode(sourceUrl, width);

    const key = `images/generated/${randomUUID()}.webp`;
    const result = await this.storage.put(key, buf, {
      contentType: 'image/webp',
    });
    return { url: this.absoluteUrl(result.url) };
  }

  // --- internals -----------------------------------------------------------

  private async requestRecraftImage(
    prompt: string,
    style: string,
    size: string,
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.apiUrl}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: this.model,
          style,
          size,
          n: 1,
          response_format: 'url',
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException(`Recraft request failed: ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Recraft returned ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    const json = (await res.json()) as RecraftResponse;
    const url = json.data?.[0]?.url;
    if (!url) {
      throw new ServiceUnavailableException('Recraft returned no image URL');
    }
    return url;
  }

  private async fetchAndTranscode(url: string, width: number): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
    try {
      // SSRF guard: the image URL comes from the Recraft response (external,
      // operator-configurable endpoint), so treat it as untrusted — block
      // private/reserved targets and don't follow redirects into them.
      await assertPublicUrl(url);
      const res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new ServiceUnavailableException(
          `Failed to download generated image (${res.status})`,
        );
      }
      const arrayBuf = await res.arrayBuffer();
      return await sharp(Buffer.from(arrayBuf))
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException(`Image processing failed: ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Local storage returns a "LOCAL:/uploads/..." placeholder that the upload
   * controller normally resolves with the request host. The article worker has
   * no request, so resolve against PUBLIC_API_URL instead. S3 URLs are already
   * absolute and pass through untouched.
   */
  private absoluteUrl(url: string): string {
    if (!url.startsWith('LOCAL:')) return url;
    const path = url.slice('LOCAL:'.length);
    return `${this.publicApiUrl}${path}`;
  }

  private buildPrompt(kind: ImageKind, input: GenerateImageInput): string {
    const subject =
      kind === 'inline'
        ? input.heading?.trim() || input.title?.trim() || ''
        : input.title?.trim() || '';
    const context = [input.title, input.description, input.keyword]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(' — ');

    const base =
      kind === 'featured'
        ? `Editorial blog cover illustration for an article titled "${subject}".`
        : `Supporting blog illustration for the section "${subject}".`;

    return [
      base,
      context && kind === 'inline' ? `Article context: ${context}.` : '',
      'Clean, modern, professional composition with a clear focal point.',
      'No text, no words, no letters, no captions, no watermarks.',
    ]
      .filter(Boolean)
      .join(' ');
  }
}

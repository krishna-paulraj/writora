import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { SaveKeywordDto } from './dto/save-keyword.dto';

const DFS_BASE = 'https://api.dataforseo.com/v3';
const RESEARCH_TTL = 86_400; // 24h — DataForSEO calls cost credits
const REQUEST_TIMEOUT_MS = 20_000;

export interface KeywordResult {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  competition: number | null;
  cpc: number | null;
  seed: string;
}

export interface ResearchOptions {
  locationCode?: number;
  languageCode?: string;
  limit?: number;
}

// Minimal shapes for the bits of the DataForSEO response we read.
interface DfsKeywordInfo {
  search_volume?: number;
  competition?: number;
  cpc?: number;
}
interface DfsItem {
  keyword?: string;
  search_volume?: number;
  keyword_info?: DfsKeywordInfo;
  keyword_properties?: { keyword_difficulty?: number };
  serp_info?: { keyword_difficulty?: number };
}
interface DfsTask {
  status_code?: number;
  status_message?: string;
  result?: Array<{ items?: DfsItem[] }>;
}
interface DfsResponse {
  status_code?: number;
  status_message?: string;
  tasks?: DfsTask[];
}

function numOrNull(v: number | undefined | null): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

@Injectable()
export class KeywordService implements OnModuleInit {
  private readonly logger = new Logger(KeywordService.name);
  private readonly login: string | null;
  private readonly password: string | null;
  private readonly locationCode: number;
  private readonly languageCode: string;

  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private cache: CacheService,
  ) {
    this.login = config.get<string>('DATAFORSEO_LOGIN') || null;
    this.password = config.get<string>('DATAFORSEO_PASSWORD') || null;
    this.locationCode =
      Number(config.get<string>('DATAFORSEO_LOCATION_CODE')) || 2840;
    this.languageCode = config.get<string>('DATAFORSEO_LANGUAGE_CODE') || 'en';
    if (!this.isConfigured()) {
      this.logger.warn(
        'DATAFORSEO_LOGIN/PASSWORD not set — keyword research will return 503',
      );
    }
  }

  async onModuleInit() {
    if (!this.isConfigured()) return;
    try {
      const ok = await this.checkCredentials();
      this.logger.log(
        ok
          ? 'DataForSEO credentials OK'
          : 'DataForSEO credentials check failed',
      );
    } catch (err) {
      this.logger.warn(
        `DataForSEO credential check error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  isConfigured(): boolean {
    return !!(this.login && this.password);
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Keyword research is not configured on this server',
      );
    }
  }

  private authHeader(): string {
    return (
      'Basic ' +
      Buffer.from(`${this.login}:${this.password}`).toString('base64')
    );
  }

  /** Validates credentials via the free /appendix/user_data endpoint (0 cost). */
  async checkCredentials(): Promise<boolean> {
    this.ensureConfigured();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${DFS_BASE}/appendix/user_data`, {
        method: 'GET',
        headers: { Authorization: this.authHeader() },
        signal: controller.signal,
      });
      if (!res.ok) return false;
      const data = (await res.json()) as DfsResponse;
      return data.tasks?.[0]?.status_code === 20000;
    } finally {
      clearTimeout(timeout);
    }
  }

  async research(
    seed: string,
    opts: ResearchOptions = {},
  ): Promise<KeywordResult[]> {
    this.ensureConfigured();
    const term = seed.trim().toLowerCase();
    if (!term) throw new BadRequestException('seed keyword is required');
    const loc = opts.locationCode ?? this.locationCode;
    const lang = opts.languageCode ?? this.languageCode;
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const cacheKey = `keyword:research:${term}:${loc}:${lang}:${limit}`;
    return this.cache.wrap<KeywordResult[]>(cacheKey, RESEARCH_TTL, () =>
      this.fetchIdeas(term, loc, lang, limit),
    );
  }

  private async fetchIdeas(
    seed: string,
    loc: number,
    lang: string,
    limit: number,
  ): Promise<KeywordResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(
        `${DFS_BASE}/dataforseo_labs/google/keyword_ideas/live`,
        {
          method: 'POST',
          headers: {
            Authorization: this.authHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              keywords: [seed],
              location_code: loc,
              language_code: lang,
              limit,
              include_serp_info: true,
            },
          ]),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        this.logger.warn(`DataForSEO HTTP ${res.status}`);
        throw new ServiceUnavailableException(
          'Keyword provider request failed',
        );
      }
      const data = (await res.json()) as DfsResponse;
      return this.parseIdeas(data, seed);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.warn(
        `DataForSEO fetch failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new ServiceUnavailableException('Keyword provider unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseIdeas(data: DfsResponse, seed: string): KeywordResult[] {
    // Request-level error (auth, unverified account, malformed request) — the
    // provider's message is useful (e.g. "verify your account"), so surface it.
    if (data.status_code !== undefined && data.status_code !== 20000) {
      this.logger.warn(
        `DataForSEO error ${data.status_code}: ${data.status_message ?? ''}`,
      );
      throw new ServiceUnavailableException(
        data.status_message || 'Keyword provider returned an error',
      );
    }
    const task = data.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      this.logger.warn(
        `DataForSEO task status ${task?.status_code ?? 'none'}: ${
          task?.status_message ?? ''
        }`,
      );
      throw new ServiceUnavailableException(
        'Keyword provider returned an error',
      );
    }
    const items = task.result?.[0]?.items ?? [];
    const out: KeywordResult[] = [];
    for (const item of items) {
      const keyword =
        typeof item.keyword === 'string' ? item.keyword.trim() : '';
      if (!keyword) continue;
      out.push({
        keyword,
        searchVolume: numOrNull(
          item.keyword_info?.search_volume ?? item.search_volume,
        ),
        competition: numOrNull(item.keyword_info?.competition),
        cpc: numOrNull(item.keyword_info?.cpc),
        difficulty: numOrNull(
          item.keyword_properties?.keyword_difficulty ??
            item.serp_info?.keyword_difficulty,
        ),
        seed,
      });
    }
    // Highest search volume first; unknown volume sinks to the bottom.
    out.sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1));
    return out;
  }

  async listSaved(userId: string) {
    return this.prisma.savedKeyword.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveKeyword(userId: string, dto: SaveKeywordDto) {
    const keyword = dto.keyword?.trim();
    if (!keyword) throw new BadRequestException('keyword is required');
    return this.prisma.savedKeyword.upsert({
      where: { userId_keyword: { userId, keyword } },
      create: {
        userId,
        keyword,
        searchVolume: dto.searchVolume ?? null,
        difficulty: dto.difficulty ?? null,
        competition: dto.competition ?? null,
        cpc: dto.cpc ?? null,
        seed: dto.seed ?? null,
      },
      update: {
        searchVolume: dto.searchVolume ?? null,
        difficulty: dto.difficulty ?? null,
        competition: dto.competition ?? null,
        cpc: dto.cpc ?? null,
        seed: dto.seed ?? null,
      },
    });
  }

  async deleteSaved(userId: string, id: string) {
    const row = await this.prisma.savedKeyword.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Saved keyword not found');
    if (row.userId !== userId) throw new ForbiddenException();
    await this.prisma.savedKeyword.delete({ where: { id } });
    return { ok: true as const };
  }
}

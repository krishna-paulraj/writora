import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { mkdirSync, writeFileSync, unlink } from 'node:fs';
import { dirname, join } from 'node:path';

export interface PutOptions {
  contentType: string;
  cacheControl?: string;
}

export interface PutResult {
  url: string;
  key: string;
}

/**
 * Object storage abstraction with two backends:
 *   - "s3": any S3-compatible bucket (AWS S3, Cloudflare R2, B2, Spaces, MinIO)
 *   - "local": disk under apps/api/uploads (dev default)
 *
 * Selection: if S3_BUCKET is set we use S3. Otherwise local disk.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly mode: 's3' | 'local';
  readonly localDir = join(process.cwd(), 'uploads');

  private readonly s3?: S3Client;
  private readonly bucket?: string;
  private readonly publicUrl?: string;
  private readonly acl?: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET');
    if (this.bucket) {
      const endpoint = this.config.get<string>('S3_ENDPOINT');
      const region = this.config.get<string>('S3_REGION') || 'auto';
      const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
      const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
      this.publicUrl = this.config
        .get<string>('S3_PUBLIC_URL')
        ?.replace(/\/$/, '');
      this.acl = this.config.get<string>('S3_ACL'); // e.g. "public-read" on AWS

      if (!accessKeyId || !secretAccessKey || !this.publicUrl) {
        throw new Error(
          'S3_BUCKET is set but S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, or S3_PUBLIC_URL is missing',
        );
      }

      this.s3 = new S3Client({
        region,
        endpoint,
        // Required for MinIO and some R2 setups; AWS ignores it gracefully.
        forcePathStyle:
          this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
        credentials: { accessKeyId, secretAccessKey },
      });
      this.mode = 's3';
      this.logger.log(`storage: s3 bucket=${this.bucket}`);
    } else {
      mkdirSync(this.localDir, { recursive: true });
      this.mode = 'local';
      this.logger.log(`storage: local dir=${this.localDir}`);
    }
  }

  async put(key: string, body: Buffer, opts: PutOptions): Promise<PutResult> {
    if (this.mode === 's3') {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket!,
          Key: key,
          Body: body,
          ContentType: opts.contentType,
          CacheControl:
            opts.cacheControl ?? 'public, max-age=31536000, immutable',
          ...(this.acl ? { ACL: this.acl as 'public-read' } : {}),
        }),
      );
      return { url: `${this.publicUrl}/${key}`, key };
    }

    // local
    const path = join(this.localDir, key);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    // URL is filled in by the controller using the request's host
    return { url: `LOCAL:/uploads/${key}`, key };
  }

  /**
   * Translate the local-mode placeholder URL into an absolute one using the
   * current request's host. Used by the upload controller.
   */
  resolveLocalUrl(placeholderUrl: string, host: string): string {
    if (!placeholderUrl.startsWith('LOCAL:')) return placeholderUrl;
    const path = placeholderUrl.slice('LOCAL:'.length);
    return `${host}${path}`;
  }

  async delete(key: string): Promise<void> {
    if (this.mode === 's3') {
      try {
        await this.s3!.send(
          new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }),
        );
      } catch (err) {
        this.logger.warn(
          `s3 delete ${key} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return;
    }
    const path = join(this.localDir, key);
    unlink(path, () => {
      // ignore errors — file may already be gone
    });
  }
}

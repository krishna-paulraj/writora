import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);
const MAX_BYTES = 12 * 1024 * 1024; // 12MB raw input; output is much smaller after sharp
const MAX_WIDTH = 2000;
const WEBP_QUALITY = 85;

@Controller('uploads')
export class UploadController {
  constructor(private storage: StorageService) {}

  // Per-IP cap: 60 uploads per hour. Generous for genuine editing sessions,
  // tight enough to stop someone scripting drag-drop abuse.
  @Throttle({ default: { limit: 60, ttl: 60 * 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          return cb(new BadRequestException('Unsupported file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const id = randomUUID();
    let key: string;
    let body: Buffer;
    let contentType: string;

    if (file.mimetype === 'image/svg+xml') {
      key = `images/${id}.svg`;
      body = file.buffer;
      contentType = 'image/svg+xml';
    } else if (file.mimetype === 'image/gif') {
      // Preserve animation
      key = `images/${id}.gif`;
      body = file.buffer;
      contentType = 'image/gif';
    } else {
      key = `images/${id}.webp`;
      contentType = 'image/webp';
      try {
        body = await sharp(file.buffer)
          .rotate() // honor EXIF orientation
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
      } catch {
        throw new BadRequestException('Failed to process image');
      }
    }

    const result = await this.storage.put(key, body, { contentType });
    const host = `${req.protocol}://${req.get('host')}`;
    return { url: this.storage.resolveLocalUrl(result.url, host) };
  }
}

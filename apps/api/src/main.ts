import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust the first hop (Vercel / Cloudflare / nginx) so req.ip reflects the
  // real client. Required for the throttler's IP-based keying to work behind
  // a proxy.
  app.set('trust proxy', 1);

  // crossOriginResourcePolicy is relaxed because /uploads/* is served from
  // this origin and consumed cross-origin by app/www.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cookieParser());

  const corsOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Serve uploaded files at /uploads/*. Multer writes to ./uploads relative to cwd.
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();

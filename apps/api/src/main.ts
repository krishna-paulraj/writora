import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody:true captures the unparsed body buffer (req.rawBody) so the Stripe
  // webhook can verify its HMAC signature; other routes parse JSON as usual.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

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

  // Global input validation. `whitelist` strips any property not declared (with
  // a validation decorator) on the DTO — the primary defense against
  // mass-assignment: undeclared columns like plan/subscriptionStatus/authorId
  // are silently dropped and never reach Prisma. We intentionally do NOT set
  // `forbidNonWhitelisted` (which 400s on extra fields) to stay backward-
  // compatible with existing clients. `transform` instantiates DTO classes
  // (needed for @Type/@ValidateNested).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Serve uploaded files at /uploads/*. Multer writes to ./uploads relative to cwd.
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();

-- Repair migration: recreate the DDL for objects that historically existed only
-- via `prisma db push` and were never captured in a migration. Without this, a
-- from-scratch `prisma migrate deploy` fails at 20260531_phase5_add_sites_additive
-- (it ALTERs "Subscriber"/"Category", which no migration created) and — even past
-- that — would stand up a database with no PasswordReset/EmailVerification/
-- WebhookEndpoint tables and several missing User/Blog columns.
--
-- Every statement is guarded (IF NOT EXISTS / pg_constraint lookup) so this is a
-- strict no-op on databases that already have the objects, and it is safe to
-- apply out of order on environments that already ran the later migrations.
-- Shapes are PRE-phase-5 (no siteId on Subscriber/Category): the phase 5
-- migrations add and enforce siteId themselves.

-- 1. User profile / verification / inbound-webhook columns (phase 5's backfill
--    reads bio/avatarUrl/twitterHandle/websiteUrl, so they must predate it).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twitterHandle" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inboundWebhookSecret" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_inboundWebhookSecret_key" ON "User"("inboundWebhookSecret");

-- 2. Blog scheduling / newsletter columns.
ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "newsletterSent" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Blog_scheduledAt_idx" ON "Blog"("scheduledAt");

-- 3. Category (pre-phase-5 shape; siteId + its index/unique/FK arrive in 20260531).
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_slug_key" ON "Category"("userId", "slug");

-- 4. Subscriber (pre-phase-5 shape).
CREATE TABLE IF NOT EXISTS "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "confirmToken" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_confirmToken_key" ON "Subscriber"("confirmToken");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_unsubscribeToken_key" ON "Subscriber"("unsubscribeToken");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscriber_authorId_email_key" ON "Subscriber"("authorId", "email");
CREATE INDEX IF NOT EXISTS "Subscriber_authorId_confirmedAt_idx" ON "Subscriber"("authorId", "confirmedAt");

-- 5. PasswordReset.
CREATE TABLE IF NOT EXISTS "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordReset_token_key" ON "PasswordReset"("token");
CREATE INDEX IF NOT EXISTS "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- 6. EmailVerification.
CREATE TABLE IF NOT EXISTS "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerification_token_key" ON "EmailVerification"("token");
CREATE INDEX IF NOT EXISTS "EmailVerification_userId_idx" ON "EmailVerification"("userId");

-- 7. WebhookEndpoint.
CREATE TABLE IF NOT EXISTS "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_userId_idx" ON "WebhookEndpoint"("userId");

-- 8. Foreign keys (ADD CONSTRAINT has no IF NOT EXISTS; guard via pg_constraint).
--    Category.userId is created CASCADE here; 20260703000000_audit_hardening
--    re-points whatever FK backs it to CASCADE by catalog lookup, so both fresh
--    and existing histories converge on the same constraint.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Category_userId_fkey') THEN
    ALTER TABLE "Category"
      ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscriber_authorId_fkey') THEN
    ALTER TABLE "Subscriber"
      ADD CONSTRAINT "Subscriber_authorId_fkey" FOREIGN KEY ("authorId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PasswordReset_userId_fkey') THEN
    ALTER TABLE "PasswordReset"
      ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailVerification_userId_fkey') THEN
    ALTER TABLE "EmailVerification"
      ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookEndpoint_userId_fkey') THEN
    ALTER TABLE "WebhookEndpoint"
      ADD CONSTRAINT "WebhookEndpoint_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

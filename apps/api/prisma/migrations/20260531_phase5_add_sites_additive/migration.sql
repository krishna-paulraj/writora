-- Phase 5 — Migration A: purely additive (reversible, zero-downtime).
-- Adds the Site table, User billing/usage columns, and a NULLABLE siteId on the
-- six site-owned tables. Backfill (B) and NOT NULL/FK enforcement (C) follow.

-- CreateTable: Site
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "blogTheme" TEXT NOT NULL DEFAULT 'default',
    "customDomain" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "twitterHandle" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- Unique indexes are safe to create now: the table is empty, and Postgres
-- treats NULLs as distinct so the nullable unique columns never collide.
CREATE UNIQUE INDEX "Site_slug_key" ON "Site"("slug");
CREATE UNIQUE INDEX "Site_subdomain_key" ON "Site"("subdomain");
-- NB: Site_customDomain_key is intentionally created in the backfill+enforce
-- migration, AFTER de-duplicating copied customDomains — creating it here would
-- make the verbatim backfill INSERT abort on any duplicate User.customDomain.
CREATE INDEX "Site_userId_idx" ON "Site"("userId");
CREATE INDEX "Site_userId_isPrimary_idx" ON "Site"("userId", "isPrimary");

ALTER TABLE "Site" ADD CONSTRAINT "Site_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: User billing/usage columns
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "aiUsageMonth" TEXT;
ALTER TABLE "User" ADD COLUMN "aiUsageCount" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- AlterTable: add NULLABLE siteId + plain index to each site-owned table
ALTER TABLE "Blog" ADD COLUMN "siteId" TEXT;
CREATE INDEX "Blog_siteId_idx" ON "Blog"("siteId");

ALTER TABLE "Subscriber" ADD COLUMN "siteId" TEXT;
CREATE INDEX "Subscriber_siteId_confirmedAt_idx" ON "Subscriber"("siteId", "confirmedAt");

ALTER TABLE "Category" ADD COLUMN "siteId" TEXT;
CREATE INDEX "Category_siteId_idx" ON "Category"("siteId");

ALTER TABLE "ArticleJob" ADD COLUMN "siteId" TEXT;
CREATE INDEX "ArticleJob_siteId_idx" ON "ArticleJob"("siteId");

ALTER TABLE "ContentPlan" ADD COLUMN "siteId" TEXT;
CREATE INDEX "ContentPlan_siteId_idx" ON "ContentPlan"("siteId");

ALTER TABLE "PublishTarget" ADD COLUMN "siteId" TEXT;
CREATE INDEX "PublishTarget_siteId_idx" ON "PublishTarget"("siteId");

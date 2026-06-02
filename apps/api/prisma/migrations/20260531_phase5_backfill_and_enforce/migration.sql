-- Phase 5 — Migration B+C (merged): backfill the default site, then enforce.
-- Backfill + de-dup + NOT NULL + uniques + FKs are ONE transactional, re-runnable
-- migration: Postgres runs DDL transactionally, so a mid-migration failure rolls
-- the whole thing back (nothing committed) and, after the data is fixed, a
-- `migrate resolve --rolled-back` + redeploy re-applies cleanly. Keeping it as a
-- single migration avoids a half-applied backfill that a later step can't redo.

-- 1) One PRIMARY Site per user that lacks one. gen_random_uuid() is core in
-- Postgres 13+. slug = username is unique, so it can't collide.
INSERT INTO "Site" (
    "id", "userId", "name", "slug", "isPrimary",
    "blogTheme", "customDomain", "bio", "avatarUrl", "twitterHandle", "websiteUrl",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, u."id", u."name", u."username", true,
    u."blogTheme", u."customDomain", u."bio", u."avatarUrl", u."twitterHandle", u."websiteUrl",
    now(), now()
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Site" s WHERE s."userId" = u."id" AND s."isPrimary" = true
);

-- 2) Stamp siteId on existing rows from the owner's primary site. Guarded by
-- `siteId IS NULL` so a re-run is a no-op.
UPDATE "Blog" b
   SET "siteId" = (SELECT s."id" FROM "Site" s WHERE s."userId" = b."authorId" AND s."isPrimary" = true LIMIT 1)
 WHERE b."siteId" IS NULL;
UPDATE "Subscriber" x
   SET "siteId" = (SELECT s."id" FROM "Site" s WHERE s."userId" = x."authorId" AND s."isPrimary" = true LIMIT 1)
 WHERE x."siteId" IS NULL;
UPDATE "ArticleJob" a
   SET "siteId" = (SELECT s."id" FROM "Site" s WHERE s."userId" = a."authorId" AND s."isPrimary" = true LIMIT 1)
 WHERE a."siteId" IS NULL;
UPDATE "Category" c
   SET "siteId" = (SELECT s."id" FROM "Site" s WHERE s."userId" = c."userId" AND s."isPrimary" = true LIMIT 1)
 WHERE c."siteId" IS NULL;
UPDATE "ContentPlan" p
   SET "siteId" = (SELECT s."id" FROM "Site" s WHERE s."userId" = p."userId" AND s."isPrimary" = true LIMIT 1)
 WHERE p."siteId" IS NULL;
UPDATE "PublishTarget" t
   SET "siteId" = (SELECT s."id" FROM "Site" s WHERE s."userId" = t."userId" AND s."isPrimary" = true LIMIT 1)
 WHERE t."siteId" IS NULL;

-- 3) De-duplicate customDomain BEFORE creating the unique index. User.customDomain
-- had no unique constraint, so production may contain duplicates; keep the oldest
-- Site per duplicate domain and NULL the rest (destructive but unavoidable).
UPDATE "Site" s
   SET "customDomain" = NULL
 WHERE s."customDomain" IS NOT NULL
   AND s."id" <> (
     SELECT s2."id" FROM "Site" s2
      WHERE s2."customDomain" = s."customDomain"
      ORDER BY s2."createdAt" ASC, s2."id" ASC
      LIMIT 1
   );

-- 4) Now safe to enforce customDomain uniqueness (index name matches Prisma).
CREATE UNIQUE INDEX "Site_customDomain_key" ON "Site"("customDomain");

-- 5) Guarded assertion: turn a silent NOT NULL failure into an actionable error.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Blog" WHERE "siteId" IS NULL)
     OR EXISTS (SELECT 1 FROM "Subscriber" WHERE "siteId" IS NULL)
     OR EXISTS (SELECT 1 FROM "Category" WHERE "siteId" IS NULL)
     OR EXISTS (SELECT 1 FROM "ArticleJob" WHERE "siteId" IS NULL)
     OR EXISTS (SELECT 1 FROM "ContentPlan" WHERE "siteId" IS NULL)
     OR EXISTS (SELECT 1 FROM "PublishTarget" WHERE "siteId" IS NULL)
  THEN
    RAISE EXCEPTION 'Phase 5 migration: NULL siteId rows remain after backfill';
  END IF;
END $$;

-- 6) Enforce NOT NULL.
ALTER TABLE "Blog" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "Subscriber" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "ArticleJob" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "ContentPlan" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "PublishTarget" ALTER COLUMN "siteId" SET NOT NULL;

-- 7) Site-scoped unique indexes (legacy authorId/userId uniques kept this phase).
CREATE UNIQUE INDEX "Blog_siteId_slug_key" ON "Blog"("siteId", "slug");
CREATE UNIQUE INDEX "Category_siteId_slug_key" ON "Category"("siteId", "slug");
CREATE UNIQUE INDEX "Subscriber_siteId_email_key" ON "Subscriber"("siteId", "email");

-- 8) siteId foreign keys (validated against the now-backfilled rows).
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleJob" ADD CONSTRAINT "ArticleJob_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPlan" ADD CONSTRAINT "ContentPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishTarget" ADD CONSTRAINT "PublishTarget_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

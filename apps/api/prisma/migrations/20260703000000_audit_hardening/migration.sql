-- Audit hardening migration.
--
-- 1. Blog.sideEffectsDispatchedAt: tracks whether publishDuePosts finished
--    fanning out post-publish side-effects, so a crash mid-fan-out is
--    reconcilable instead of silently dropping newsletters/webhooks/cross-posts.
-- 2. Index on Blog(published, updatedAt): serves the sitemap scan and the
--    side-effect reconciliation query.
-- 3. Blog.author / Category.user foreign keys switched to ON DELETE CASCADE so
--    the required User relations match the intent already used by the Site
--    cascade path (removes the ambiguous NoAction/Cascade dual-path). The FK
--    is dropped by its actual name looked up from the catalog, because the
--    original constraint name can vary across environments.

-- 1. Additive column (nullable → safe on a populated table).
ALTER TABLE "Blog" ADD COLUMN "sideEffectsDispatchedAt" TIMESTAMP(3);

-- Existing published posts predate the fan-out tracking; mark them dispatched
-- so the reconciler doesn't re-fire side-effects for historical content.
UPDATE "Blog" SET "sideEffectsDispatchedAt" = "publishedAt"
  WHERE "published" = true AND "publishedAt" IS NOT NULL;

-- 2. Additive index.
CREATE INDEX IF NOT EXISTS "Blog_published_updatedAt_idx" ON "Blog"("published", "updatedAt");

-- 3. Blog.authorId FK → CASCADE (drop whatever FK currently backs authorId→User).
DO $$
DECLARE cname text;
BEGIN
  SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
   WHERE con.conrelid = '"Blog"'::regclass
     AND con.contype = 'f'
     AND con.confrelid = '"User"'::regclass
     AND att.attname = 'authorId'
   LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "Blog" DROP CONSTRAINT %I', cname);
  END IF;
END $$;
ALTER TABLE "Blog"
  ADD CONSTRAINT "Blog_authorId_fkey" FOREIGN KEY ("authorId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Category.userId FK → CASCADE.
DO $$
DECLARE cname text;
BEGIN
  SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
   WHERE con.conrelid = '"Category"'::regclass
     AND con.contype = 'f'
     AND con.confrelid = '"User"'::regclass
     AND att.attname = 'userId'
   LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "Category" DROP CONSTRAINT %I', cname);
  END IF;
END $$;
ALTER TABLE "Category"
  ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

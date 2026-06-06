-- Adds the BlogView -> Blog foreign key, split out of 20260318_add_analytics so
-- the migration history replays cleanly on a fresh database (Blog is created in
-- the later 20260318_add_blog_model). Guarded with NOT EXISTS so it is a no-op
-- on databases where the FK was already created by the original add_analytics
-- migration (i.e. every environment provisioned before this fix).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlogView_blogId_fkey'
  ) THEN
    ALTER TABLE "BlogView"
      ADD CONSTRAINT "BlogView_blogId_fkey"
      FOREIGN KEY ("blogId") REFERENCES "Blog"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

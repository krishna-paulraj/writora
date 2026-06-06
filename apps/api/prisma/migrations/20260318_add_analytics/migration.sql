-- Add custom domain to User
ALTER TABLE "User" ADD COLUMN "customDomain" TEXT;

-- Create BlogView table
CREATE TABLE "BlogView" (
    "id" TEXT NOT NULL,
    "blogId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogView_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "BlogView_blogId_idx" ON "BlogView"("blogId");
CREATE INDEX "BlogView_createdAt_idx" ON "BlogView"("createdAt");
CREATE INDEX "BlogView_blogId_createdAt_idx" ON "BlogView"("blogId", "createdAt");

-- NOTE: The "BlogView" -> "Blog" foreign key was moved to a later migration
-- (20260607_add_blogview_blog_fk) because the "Blog" table is created in
-- 20260318_add_blog_model, which sorts AFTER this migration. Adding the FK here
-- made the history non-replayable on a fresh database ("relation Blog does not
-- exist"). The FK is added idempotently once Blog exists.

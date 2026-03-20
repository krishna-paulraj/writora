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

-- Add foreign key
ALTER TABLE "BlogView" ADD CONSTRAINT "BlogView_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

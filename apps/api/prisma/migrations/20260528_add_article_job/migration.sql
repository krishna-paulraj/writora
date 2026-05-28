-- CreateTable: ArticleJob
CREATE TABLE "ArticleJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "topic" TEXT NOT NULL,
    "targetKeyword" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "length" TEXT NOT NULL DEFAULT 'medium',
    "audience" TEXT,
    "category" TEXT,
    "keywordData" JSONB,
    "contentPlanId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "outline" JSONB,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "blogId" TEXT,
    "error" TEXT,
    "authorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleJob_blogId_key" ON "ArticleJob"("blogId");

-- CreateIndex
CREATE INDEX "ArticleJob_authorId_status_idx" ON "ArticleJob"("authorId", "status");

-- CreateIndex
CREATE INDEX "ArticleJob_status_idx" ON "ArticleJob"("status");

-- AddForeignKey
ALTER TABLE "ArticleJob" ADD CONSTRAINT "ArticleJob_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleJob" ADD CONSTRAINT "ArticleJob_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

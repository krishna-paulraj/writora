-- CreateTable: ContentPlan
CREATE TABLE "ContentPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "audience" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "length" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT,
    "cadence" TEXT NOT NULL DEFAULT 'weekly',
    "status" TEXT NOT NULL DEFAULT 'active',
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "keywordData" JSONB,
    "totalTarget" INTEGER,
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ContentPlanItem
CREATE TABLE "ContentPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetKeyword" TEXT,
    "keywords" JSONB,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "position" INTEGER NOT NULL DEFAULT 0,
    "articleJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentPlan_userId_idx" ON "ContentPlan"("userId");

-- CreateIndex
CREATE INDEX "ContentPlan_status_nextRunAt_idx" ON "ContentPlan"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "ContentPlanItem_planId_status_idx" ON "ContentPlanItem"("planId", "status");

-- CreateIndex
CREATE INDEX "ContentPlanItem_planId_position_idx" ON "ContentPlanItem"("planId", "position");

-- CreateIndex
CREATE INDEX "ArticleJob_contentPlanId_idx" ON "ArticleJob"("contentPlanId");

-- AddForeignKey
ALTER TABLE "ContentPlan" ADD CONSTRAINT "ContentPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ContentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleJob" ADD CONSTRAINT "ArticleJob_contentPlanId_fkey" FOREIGN KEY ("contentPlanId") REFERENCES "ContentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

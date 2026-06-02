-- CreateTable: PublishTarget
CREATE TABLE "PublishTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "lastPublishAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PublishRecord
CREATE TABLE "PublishRecord" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "blogId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishTarget_userId_idx" ON "PublishTarget"("userId");

-- CreateIndex
CREATE INDEX "PublishTarget_userId_enabled_autoPublish_idx" ON "PublishTarget"("userId", "enabled", "autoPublish");

-- CreateIndex
CREATE UNIQUE INDEX "PublishRecord_targetId_blogId_key" ON "PublishRecord"("targetId", "blogId");

-- CreateIndex
CREATE INDEX "PublishRecord_blogId_idx" ON "PublishRecord"("blogId");

-- CreateIndex
CREATE INDEX "PublishRecord_targetId_idx" ON "PublishRecord"("targetId");

-- AddForeignKey
ALTER TABLE "PublishTarget" ADD CONSTRAINT "PublishTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "PublishTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

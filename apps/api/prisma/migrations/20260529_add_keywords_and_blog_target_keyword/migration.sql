-- AlterTable: add target keyword to Blog
ALTER TABLE "Blog" ADD COLUMN "targetKeyword" TEXT;

-- CreateTable: SavedKeyword
CREATE TABLE "SavedKeyword" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "searchVolume" INTEGER,
    "difficulty" INTEGER,
    "competition" DOUBLE PRECISION,
    "cpc" DOUBLE PRECISION,
    "seed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedKeyword_userId_keyword_key" ON "SavedKeyword"("userId", "keyword");

-- CreateIndex
CREATE INDEX "SavedKeyword_userId_idx" ON "SavedKeyword"("userId");

-- AddForeignKey
ALTER TABLE "SavedKeyword" ADD CONSTRAINT "SavedKeyword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

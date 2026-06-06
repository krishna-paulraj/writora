-- Ledger of cross-site backlinks (one row per from→to post pair).
CREATE TABLE "BacklinkEdge" (
    "id" TEXT NOT NULL,
    "fromBlogId" TEXT NOT NULL,
    "toBlogId" TEXT NOT NULL,
    "fromSiteId" TEXT NOT NULL,
    "toSiteId" TEXT NOT NULL,
    "anchorText" TEXT NOT NULL,
    "rel" TEXT NOT NULL DEFAULT 'dofollow',
    "score" DOUBLE PRECISION NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'block',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacklinkEdge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BacklinkEdge_fromBlogId_toBlogId_key" ON "BacklinkEdge"("fromBlogId", "toBlogId");
CREATE INDEX "BacklinkEdge_fromBlogId_status_idx" ON "BacklinkEdge"("fromBlogId", "status");
CREATE INDEX "BacklinkEdge_toBlogId_status_idx" ON "BacklinkEdge"("toBlogId", "status");
CREATE INDEX "BacklinkEdge_toSiteId_idx" ON "BacklinkEdge"("toSiteId");

ALTER TABLE "BacklinkEdge"
  ADD CONSTRAINT "BacklinkEdge_fromBlogId_fkey"
  FOREIGN KEY ("fromBlogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BacklinkEdge"
  ADD CONSTRAINT "BacklinkEdge_toBlogId_fkey"
  FOREIGN KEY ("toBlogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

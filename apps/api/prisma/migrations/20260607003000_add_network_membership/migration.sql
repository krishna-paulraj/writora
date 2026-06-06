-- Per-site opt-in to the cross-site backlink network.
CREATE TABLE "NetworkMembership" (
    "siteId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "relPolicy" TEXT NOT NULL DEFAULT 'dofollow',
    "maxOutboundPerPost" INTEGER NOT NULL DEFAULT 3,
    "niche" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkMembership_pkey" PRIMARY KEY ("siteId")
);
CREATE INDEX "NetworkMembership_enabled_idx" ON "NetworkMembership"("enabled");

ALTER TABLE "NetworkMembership"
  ADD CONSTRAINT "NetworkMembership_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

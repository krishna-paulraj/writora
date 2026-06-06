-- Stripe webhook idempotency ledger.
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProcessedStripeEvent_createdAt_idx" ON "ProcessedStripeEvent"("createdAt");

-- JWT revocation: token version embedded in access tokens, bumped on reset.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- One ContentPlanItem per generated job + index for the hot job-state sync.
CREATE UNIQUE INDEX "ContentPlanItem_articleJobId_key" ON "ContentPlanItem"("articleJobId");

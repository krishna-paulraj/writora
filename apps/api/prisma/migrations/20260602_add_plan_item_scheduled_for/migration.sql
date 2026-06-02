-- Interactive content planner: give each ContentPlanItem a real per-article date.
-- Additive and idempotent. The scheduler dispatches an item once scheduledFor<=now,
-- replacing the old plan-level cadence tick with a user-draggable per-item date.

-- AlterTable: nullable so existing rows are untouched until backfilled.
ALTER TABLE "ContentPlanItem" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- Index supporting the scheduler's due-item scans (status + date).
CREATE INDEX "ContentPlanItem_status_scheduledFor_idx"
  ON "ContentPlanItem"("status", "scheduledFor");

-- Backfill PLANNED items to the forecast the old UI implied:
--   scheduledFor = plan.nextRunAt + (rankAmongPlanned * cadenceDays)
-- so item 0 keeps plan.nextRunAt exactly and later items fan out by cadence.
-- Guarded on scheduledFor IS NULL, so re-running is a no-op. Items past the
-- planned stage (queued/generating/done/failed/skipped) and plans with no
-- nextRunAt are intentionally left NULL (never date-dispatched).
WITH ranked AS (
  SELECT
    i."id",
    p."nextRunAt" AS plan_next,
    CASE p."cadence"
      WHEN 'daily'        THEN 1
      WHEN 'every_3_days' THEN 3
      WHEN 'weekly'       THEN 7
      WHEN 'biweekly'     THEN 14
      WHEN 'monthly'      THEN 30
      ELSE 7
    END AS cadence_days,
    ROW_NUMBER() OVER (PARTITION BY i."planId" ORDER BY i."position" ASC) - 1 AS rnk
  FROM "ContentPlanItem" i
  JOIN "ContentPlan" p ON p."id" = i."planId"
  WHERE i."status" = 'planned'
    AND i."scheduledFor" IS NULL
    AND p."nextRunAt" IS NOT NULL
)
UPDATE "ContentPlanItem" t
   SET "scheduledFor" = r.plan_next + (r.rnk * r.cadence_days) * INTERVAL '1 day'
  FROM ranked r
 WHERE t."id" = r."id";

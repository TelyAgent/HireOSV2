-- AlterTable
ALTER TABLE "InterviewTask" ADD COLUMN     "debriefConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "planConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "reviewConfirmedAt" TIMESTAMP(3);

-- Backfill: tasks that already moved past a stage before these columns existed count as
-- having confirmed it, so the new flow gating never locks work that is already under way.
UPDATE "InterviewTask" t SET "planConfirmedAt" = NOW()
WHERE EXISTS (SELECT 1 FROM "InterviewRound" r WHERE r."taskId" = t."id" AND (r."scheduledAt" IS NOT NULL OR r."status" = 'completed'));

UPDATE "InterviewTask" t SET "reviewConfirmedAt" = NOW()
WHERE t."decision" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "ParseJob" p WHERE p."taskId" = t."id" AND p."type" IN ('debrief_scores', 'decision_summary'));

UPDATE "InterviewTask" t SET "debriefConfirmedAt" = NOW()
WHERE t."decision" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "ParseJob" p WHERE p."taskId" = t."id" AND p."type" = 'decision_summary');

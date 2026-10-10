-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "closeReason" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "handedOffAt" TIMESTAMP(3),
ADD COLUMN     "interviewTaskId" TEXT,
ADD COLUMN     "statusBeforeHold" TEXT;

-- Backfill: Case.status used to stay 'linked' forever (the task list derived progress from the
-- latest invitation instead). Write the equivalent persisted status for existing cases once.
UPDATE "Case" c SET "status" = CASE
    WHEN s."releasedAt" IS NOT NULL THEN 'released'
    WHEN s."finalizedAt" IS NOT NULL THEN 'finalized'
    WHEN i."status" = 'submitted' THEN 'review_pending'
    WHEN i."status" = 'opened' THEN 'awaiting_submission'
    WHEN i."status" = 'sent' THEN 'invited'
    ELSE c."status"
  END
FROM (
  SELECT DISTINCT ON ("caseId") "id", "caseId", "status"
  FROM "Invitation"
  ORDER BY "caseId", "createdAt" DESC
) i
LEFT JOIN "Submission" s ON s."invitationId" = i."id"
WHERE i."caseId" = c."id" AND c."status" = 'linked';

-- A released case's written-test task is done.
UPDATE "Task" t SET "status" = 'completed'
FROM "Case" c
WHERE t."caseId" = c."id" AND c."status" = 'released' AND t."status" <> 'completed';
